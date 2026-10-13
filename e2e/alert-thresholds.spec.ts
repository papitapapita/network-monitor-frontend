import type { Page } from '@playwright/test';
import { test, expect, uniqueName } from './fixtures/test';
import { field } from './fixtures/helpers';

/**
 * Wireless alert thresholds (WLS-200..202): the install's set on /settings,
 * and one device's overrides on its wireless tab. A save changes when every
 * real radio alerts, so the threshold routes are answered here.
 */

const DEFAULTS = {
  signalDbm: { warning: -70, critical: -80 },
  snrDb: { warning: 15, critical: 10 },
  ccqPercent: { warning: 75, critical: 50 },
  latencyMs: { warning: 50, critical: 150 },
  cpuPercent: 80,
  memoryPercent: 85,
  clockDriftSeconds: 300,
  saturationPercent: 80,
  clientDropPercent: 50,
  minCapacityMbps: { '20': 50, '40': 100, '80': 200 },
  maxDistanceKm: { '20': 15, '40': 10, '80': 5 },
};

const ok = (data: unknown) => ({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

async function stubInstall(page: Page) {
  const saves: unknown[] = [];
  await page.route(/\/api\/wireless\/alert-thresholds$/, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill(ok({ thresholds: DEFAULTS, defaults: DEFAULTS }));
    const body = route.request().postDataJSON();
    saves.push(body);
    return route.fulfill(ok({ thresholds: body, defaults: DEFAULTS }));
  });
  return saves;
}

const card = (page: Page) => page.getByRole('region', { name: 'Umbrales de alerta inalámbrica' });

test('an administrator raises the signal warning and checks 160 MHz too', async ({ page }) => {
  const saves = await stubInstall(page);
  await page.goto('/settings');

  const signal = card(page).getByRole('group', { name: 'Señal' });
  await expect(field(signal, 'Advertencia (dBm)')).toHaveValue('-70');
  await field(signal, 'Advertencia (dBm)').fill('-65');
  const distance = card(page).getByRole('group', { name: 'Distancia máxima' });
  await distance.getByRole('button', { name: '+ 160 MHz' }).click();
  await distance.getByLabel('Distancia máxima a 160 MHz').fill('2.5');
  await card(page).getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(page.getByText(/Umbrales guardados/)).toBeVisible();
  expect(saves).toEqual([
    {
      ...DEFAULTS,
      signalDbm: { warning: -65, critical: -80 },
      maxDistanceKm: { ...DEFAULTS.maxDistanceKm, '160': 2.5 },
    },
  ]);
});

test('a warning past its critical value is caught before it is sent', async ({ page }) => {
  const saves = await stubInstall(page);
  await page.goto('/settings');

  const latency = card(page).getByRole('group', { name: 'Latencia' });
  await field(latency, 'Advertencia (ms)').fill('200');
  await card(page).getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(latency.getByText('La advertencia debe ser menor que la crítica.')).toBeVisible();
  expect(saves).toEqual([]);
});

test('a long backhaul overrides only its 40 MHz distance', async ({ page, api }) => {
  const vendor = await api.create<{ id: string }>('vendors', { name: uniqueName('vendor'), slug: uniqueName('vendor') });
  const model = await api.create<{ id: string }>('device-models', {
    vendorId: vendor.id,
    model: uniqueName('model'),
    deviceType: 'RADIO',
    isWireless: true,
  });
  const device = await api.create<{ id: string }>('devices', {
    name: uniqueName('device'),
    deviceModelId: model.id,
    status: 'INVENTORY',
    ownerType: 'COMPANY',
    serialNumber: uniqueName('sn'),
    category: 'WIRELESS_CPE',
  });
  // Disabled so the poller never chases a radio that does not exist.
  await api.post(`/devices/${device.id}/wireless/config`, {
    ipAddress: `198.18.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    intervalSecs: 3600,
    enabled: false,
  });

  const saves: unknown[] = [];
  const answer = (overrides: Record<string, unknown>) => ({
    deviceId: device.id,
    overrides,
    install: DEFAULTS,
    effective: { ...DEFAULTS, ...overrides, maxDistanceKm: { ...DEFAULTS.maxDistanceKm, ...(overrides.maxDistanceKm as object) } },
  });
  await page.route(new RegExp(`/api/devices/${device.id}/wireless/alert-thresholds$`), async (route) => {
    if (route.request().method() === 'GET') return route.fulfill(ok(answer({})));
    const body = route.request().postDataJSON();
    saves.push(body);
    return route.fulfill(ok(answer(body.overrides)));
  });

  await page.goto(`/devices/${device.id}?tab=wireless`);
  await expect(page.getByText('Los de la instalación')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Ver', exact: true }).click();

  const distance = page.getByRole('group', { name: 'Distancia máxima' });
  await expect(distance.getByLabel('Distancia máxima a 40 MHz')).toBeDisabled();
  await distance.getByText('Personalizar').click();
  await distance.getByLabel('Distancia máxima a 40 MHz').fill('20');
  // The install checks 20 MHz, so a device cannot stop checking it.
  await expect(distance.getByRole('button', { name: 'Dejar de revisar 20 MHz' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(page.getByText(/Umbrales del equipo guardados/)).toBeVisible();
  expect(saves).toEqual([{ overrides: { maxDistanceKm: { '40': 20 } } }]);
  await expect(page.getByText('1 personalizado')).toBeVisible();
});
