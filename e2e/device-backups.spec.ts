import type { Page } from '@playwright/test';
import { test, expect, uniqueName } from './fixtures/test';
import { ApiClient } from './fixtures/api';
import { patchInstallation } from './fixtures/agents';

/**
 * Configuration backups on the device page (BACKEND_API.md, Device Backups).
 * The device is real, so its page and tabs are; the backup routes are
 * answered here, because a real «Respaldar ahora» would log into a device.
 */

type Created = { id: string; name: string };

async function arrangeDevice(api: ApiClient, deviceType: string, category: string | null = null) {
  const vendor = await api.create<Created>('vendors', { name: uniqueName('vendor'), slug: uniqueName('vendor') });
  const model = await api.create<Created>('device-models', {
    vendorId: vendor.id,
    model: uniqueName('model'),
    deviceType,
    isWireless: false,
  });
  return api.create<Created>('devices', {
    name: uniqueName('device'),
    deviceModelId: model.id,
    status: 'INVENTORY',
    ownerType: 'COMPANY',
    serialNumber: uniqueName('sn'),
    ...(category ? { category } : {}),
  });
}

const backup = (deviceId: string, id: string, takenAt: string, trigger = 'SCHEDULED') => ({
  id,
  deviceId,
  format: 'ROUTEROS_EXPORT',
  sizeBytes: 2048,
  trigger,
  takenAt,
  lastCheckedAt: takenAt,
});

/** Answers the list with `listed`, and records each POST, diff and download asked for. */
async function stubBackups(page: Page, deviceId: string, listed: object, backUp?: { status: number; body: object }) {
  const calls = { posts: 0, diffs: [] as string[], downloads: [] as string[] };
  await page.route(new RegExp(`/api/devices/${deviceId}/backups(\\?.*)?$`), async (route) => {
    if (route.request().method() === 'POST') {
      calls.posts++;
      return route.fulfill({ status: backUp?.status ?? 201, json: backUp?.body ?? {} });
    }
    return route.fulfill({ json: listed });
  });
  await page.route(new RegExp(`/api/devices/${deviceId}/backups/diff\\?`), async (route) => {
    calls.diffs.push(new URL(route.request().url()).search);
    return route.fulfill({
      json: {
        from: backup(deviceId, 'b-old', '2026-10-05T08:00:00.000Z'),
        to: backup(deviceId, 'b-new', '2026-10-06T08:00:00.000Z'),
        identical: false,
        added: 1,
        removed: 1,
        hunks: [{
          fromStart: 4, fromLines: 3, toStart: 4, toLines: 3,
          lines: [
            { kind: 'context', text: '/ip address' },
            { kind: 'removed', text: 'add address=10.0.0.1/24 interface=ether1' },
            { kind: 'added', text: 'add address=10.0.0.2/24 interface=ether1' },
          ],
        }],
      },
    });
  });
  await page.route(new RegExp(`/api/devices/${deviceId}/backups/[^/]+/download$`), async (route) => {
    calls.downloads.push(route.request().url());
    return route.fulfill({
      contentType: 'text/plain; charset=utf-8',
      headers: { 'Content-Disposition': 'attachment; filename="router-20261006-0800Z.rsc"' },
      body: '/system identity\nset name=router\n',
    });
  });
  return calls;
}

test('a router lists its versions, and an administrator compares and downloads them', async ({ page, api }) => {
  const device = await arrangeDevice(api, 'ROUTER');
  const calls = await stubBackups(page, device.id, {
    deviceId: device.id,
    state: {
      lastAttemptAt: '2026-10-06T08:00:00.000Z', lastOutcome: 'SAVED', lastError: null,
      lastSuccessAt: '2026-10-06T08:00:00.000Z', failingSince: null, consecutiveFailures: 0,
    },
    backups: [
      backup(device.id, 'b-new', '2026-10-06T08:00:00.000Z'),
      backup(device.id, 'b-old', '2026-10-05T08:00:00.000Z', 'MANUAL'),
    ],
  });

  await page.goto(`/devices/${device.id}`);
  await page.getByRole('button', { name: 'Respaldos' }).click();

  const versions = page.getByRole('table', { name: 'Versiones guardadas' });
  await expect(versions.getByRole('row')).toHaveCount(3);
  await expect(versions.getByText('Manual')).toBeVisible();

  // Only the newer row has an older version to compare with.
  await expect(versions.getByRole('button', { name: 'Ver cambios' })).toHaveCount(1);
  await versions.getByRole('button', { name: 'Ver cambios' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cambios de configuración' });
  await expect(dialog.getByText('add address=10.0.0.2/24 interface=ether1')).toBeVisible();
  expect(calls.diffs).toEqual(['?from=b-old&to=b-new']);
  await page.keyboard.press('Escape');

  const download = page.waitForEvent('download');
  await versions.getByRole('button', { name: /Descargar respaldo/ }).first().click();
  expect((await download).suggestedFilename()).toMatch(/\.rsc$/);
  expect(calls.downloads).toHaveLength(1);
});

test('a backup the device refuses says why in Spanish, and a failing streak shows on the tab', async ({ page, api }) => {
  const device = await arrangeDevice(api, 'SWITCH');
  const calls = await stubBackups(
    page,
    device.id,
    {
      deviceId: device.id,
      state: {
        lastAttemptAt: '2026-10-06T08:00:00.000Z', lastOutcome: 'FAILED',
        lastError: 'No HTTP credentials are configured for this device',
        lastSuccessAt: null, failingSince: '2026-10-04T08:00:00.000Z', consecutiveFailures: 3,
      },
      backups: [],
    },
    { status: 409, body: { error: 'Cannot back up this device: No HTTP credentials are configured for this device' } }
  );

  await page.goto(`/devices/${device.id}?tab=backups`);
  await expect(page.getByText('3 intentos fallidos seguidos', { exact: false })).toBeVisible();
  await expect(page.getByText(/no tiene credenciales HTTP/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Respaldar ahora' }).click();
  await expect(page.getByText(/No se puede respaldar: El equipo no tiene credenciales HTTP/)).toBeVisible();
  expect(calls.posts).toBe(1);
});

test('off site, a router behind no agent cannot be backed up from here', async ({ page, api }) => {
  const device = await arrangeDevice(api, 'ROUTER');
  await patchInstallation(page, (data) => { data.serverOnSite = false; });
  await stubBackups(page, device.id, { deviceId: device.id, state: null, backups: [] });

  await page.goto(`/devices/${device.id}?tab=backups`);
  await expect(page.getByText(/no está detrás de un agente, así que no se respalda/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Respaldar ahora' })).toBeDisabled();
});

test('a customer CPE has no backups tab', async ({ page, api }) => {
  const device = await arrangeDevice(api, 'ANTENNA', 'CPE');
  await page.goto(`/devices/${device.id}`);
  await expect(page.getByRole('button', { name: 'Credenciales' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Respaldos' })).toHaveCount(0);
});
