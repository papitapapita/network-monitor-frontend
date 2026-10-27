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

async function arrangeDevice(api: ApiClient, deviceType: string, category: string | null = null, ownerType = 'COMPANY') {
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
    ownerType,
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

/** Answers the list with `listed`, and records each POST and download asked for. */
async function stubBackups(page: Page, deviceId: string, listed: object, backUp?: { status: number; body: object }) {
  const calls = { posts: 0, downloads: [] as string[] };
  await page.route(new RegExp(`/api/devices/${deviceId}/backups(\\?.*)?$`), async (route) => {
    if (route.request().method() === 'POST') {
      calls.posts++;
      return route.fulfill({ status: backUp?.status ?? 201, json: backUp?.body ?? {} });
    }
    return route.fulfill({ json: listed });
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

test('a routerboard shows its one kept copy, and an administrator downloads it', async ({ page, api }) => {
  const device = await arrangeDevice(api, 'ROUTERBOARD');
  const calls = await stubBackups(page, device.id, {
    deviceId: device.id,
    state: {
      lastAttemptAt: '2026-10-06T08:00:00.000Z', lastOutcome: 'UNCHANGED', lastError: null,
      lastSuccessAt: '2026-10-06T08:00:00.000Z', failingSince: null, consecutiveFailures: 0,
    },
    backups: [backup(device.id, 'b-new', '2026-10-05T08:00:00.000Z', 'MANUAL')],
  });

  await page.goto(`/devices/${device.id}`);
  await page.getByRole('button', { name: 'Respaldos' }).click();

  await expect(page.getByText('Configuración guardada')).toBeVisible();
  await expect(page.getByText('(manual)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver cambios' })).toHaveCount(0);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Descargar respaldo/ }).click();
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

test('off site, a routerboard behind no agent cannot be backed up from here', async ({ page, api }) => {
  const device = await arrangeDevice(api, 'ROUTERBOARD');
  await patchInstallation(page, (data) => { data.serverOnSite = false; });
  await stubBackups(page, device.id, { deviceId: device.id, state: null, backups: [] });

  await page.goto(`/devices/${device.id}?tab=backups`);
  await expect(page.getByText(/no está detrás de un agente, así que no se respalda/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Respaldar ahora' })).toBeDisabled();
});

test("a customer's antenna has no backups tab", async ({ page, api }) => {
  const device = await arrangeDevice(api, 'ANTENNA', 'WIRELESS_CPE', 'CLIENT');
  await page.goto(`/devices/${device.id}`);
  await expect(page.getByRole('button', { name: 'Configuración' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Respaldos' })).toHaveCount(0);
});

test('a Wi-Fi router model has no backups tab', async ({ page, api }) => {
  const device = await arrangeDevice(api, 'ROUTER');
  await page.goto(`/devices/${device.id}`);
  await expect(page.getByRole('button', { name: 'Configuración' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Respaldos' })).toHaveCount(0);
});
