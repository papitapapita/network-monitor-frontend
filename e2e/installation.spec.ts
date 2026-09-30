import { test, expect } from './fixtures/test';
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
