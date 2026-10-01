import { test, expect } from './fixtures/test';
import type { Page } from '@playwright/test';
import type { ApiClient } from './fixtures/api';
import { patchInstallation } from './fixtures/agents';

/**
 * What the install runs (GET /api/installation). Its values are fixed by the
 * server's environment, so the switches are flipped on the response here.
 */

test('a module that is off leaves the menu, and its pages say so', async ({ page }) => {
  await patchInstallation(page, (i) => { i.modules.tickets = false; });
  await page.goto('/tickets');
  await expect(page.getByText('No disponible en esta instalación')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tickets' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Técnicos' })).toHaveCount(0);
});

test('an off-site server offers no network scan', async ({ page }) => {
  await patchInstallation(page, (i) => { i.serverOnSite = false; });
  await page.goto('/network-scan');
  await expect(page.getByText(/no está en la red monitoreada/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Escaneo' })).toHaveCount(0);
});

/**
 * WLS-029 on a real access point: AP VANGUARDIA carries a wireless config.
 * Nothing is clicked — the poll, reboot and diagnosis would reach the radio.
 */
test.describe('the wireless tab of a configured radio', () => {
  const name = 'AP VANGUARDIA';

  async function openWirelessTab(page: Page, api: ApiClient) {
    const { devices } = await api.get<{ devices: Array<{ id: string; name: string }> }>(`devices?search=${encodeURIComponent(name)}&limit=5`);
    const device = devices.find((d) => d.name === name);
    test.skip(!device, `no device named ${name}`);
    await page.goto(`/devices/${device!.id}`);
    await page.getByRole('button', { name: 'Inalámbrico', exact: true }).click();
    // The tab keeps an SSE stream open, so wait on the content, not the network.
    await expect(page.getByRole('heading', { name: 'Métricas Actuales' })).toBeVisible();
  }

  test('on site: poll, reboot and diagnosis are offered', async ({ page, api }) => {
    await openWirelessTab(page, api);
    const main = page.locator('main');
    await expect(main.getByRole('button', { name: 'Reiniciar equipo' })).toBeVisible();
    await expect(main.getByText('Diagnóstico en vivo')).toBeVisible();
    await expect(main.getByText(/no está en la red monitoreada/)).toHaveCount(0);
  });

  test('off site: none of them, and it says why', async ({ page, api }) => {
    await patchInstallation(page, (i) => { i.serverOnSite = false; });
    await openWirelessTab(page, api);
    const main = page.locator('main');
    await expect(main.getByText(/El servidor no está en la red monitoreada, así que el sondeo manual/)).toBeVisible();
    await expect(main.getByRole('button', { name: /Sondear ahora|Reiniciar equipo/ })).toHaveCount(0);
    await expect(main.getByText('Diagnóstico en vivo')).toHaveCount(0);
  });
});
