import { test, expect, uniqueName } from './fixtures/test';
import { ApiClient } from './fixtures/api';

/**
 * The two live-throughput SSE streams, through the UI that consumes them.
 *
 * These assert the transport as much as the rendering: the frames only parse,
 * and the connection only reaches "En vivo", if the auth header, the event
 * names and the frame parsing are all right. What they deliberately do not
 * assert is any particular throughput number — those come from whatever the
 * poller last stored, which no test can arrange.
 */

async function arrangeWirelessDevice(api: ApiClient) {
  const vendor = await api.create<{ id: string }>('vendors', {
    name: uniqueName('vendor'),
    slug: uniqueName('vendor'),
  });
  const model = await api.create<{ id: string }>('device-models', {
    vendorId: vendor.id,
    model: uniqueName('model'),
    deviceType: 'RADIO',
    isWireless: true,
  });
  return api.create<{ id: string; name: string }>('devices', {
    name: uniqueName('device'),
    deviceModelId: model.id,
    status: 'INVENTORY',
    serialNumber: uniqueName('sn'),
    category: 'WIRELESS_CPE',
  });
}

test.describe('live throughput', () => {
  test('the fleet page connects to its stream', async ({ page }) => {
    await page.goto('/wireless');

    await expect(page.getByRole('heading', { name: 'Tráfico en vivo' })).toBeVisible();

    // The opening frame arrived and parsed: anything less leaves the indicator
    // on "Conectando…" or drops it to "Sin conexión". Exact, or it also matches
    // the page's own "Tráfico en vivo" title.
    await expect(page.getByText('En vivo', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Sesión expirada|Network error/)).toHaveCount(0);

    // Devices that have never been polled are absent from the stream, so an
    // empty fleet says so rather than rendering an empty table.
    const rows = page.locator('tbody tr');
    if ((await rows.count()) === 0) {
      await expect(
        page.getByText('Ningún equipo inalámbrico ha sido sondeado todavía.')
      ).toBeVisible();
    }
  });

  test('a device with no readings says so, and offers a retry', async ({ page, api }) => {
    const device = await arrangeWirelessDevice(api);
    // The card only appears once monitoring is configured — same gate as the
    // rest of the tab. The device has still never been polled, so the stream
    // answers 404.
    await api.post(`/devices/${device.id}/wireless/config`, {
      intervalSecs: 3600,
      enabled: false,
    });

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Inalámbrico' }).click();

    await expect(
      page.getByText('Este equipo todavía no tiene lecturas: no ha sido sondeado ni una vez.')
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();

    // A refusal is not a crash: the rest of the tab still works.
    await expect(page.getByRole('heading', { name: 'Configuración Inalámbrica' })).toBeVisible();
  });

  test('a device without a wireless config shows no live card', async ({ page, api }) => {
    const device = await arrangeWirelessDevice(api);

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Inalámbrico' }).click();

    await expect(page.getByText('Este dispositivo no tiene configuración de monitoreo inalámbrico.')).toBeVisible();
    // No config means no poller, so there is nothing live to show — and no
    // stream slot spent finding that out.
    await expect(page.getByRole('heading', { name: 'Tráfico en vivo' })).toHaveCount(0);
  });
});
