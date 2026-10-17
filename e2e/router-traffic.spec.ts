import { test, expect } from './fixtures/test';
import type { Page } from '@playwright/test';

/**
 * The main routers' live traffic (MON-060 … MON-066). The stubbed specs answer
 * the stream with fixed frames, so no router is logged into; the last one
 * reads the real stream and asserts only that it connects.
 */

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

async function stubStream(page: Page, body: string) {
  await page.route(/\/api\/routers\/traffic\/stream/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body })
  );
}

const AT = '2026-10-17T15:00:00.000Z';

test('each router shows its interfaces, and one that cannot be read says why', async ({ page }) => {
  await stubStream(
    page,
    frame('router-traffic-snapshot', {
      intervalSeconds: 2,
      routers: [
        { deviceId: 'r1', deviceName: 'Core Norte', at: null, error: null, interfaces: [] },
        { deviceId: 'r2', deviceName: 'Core Sur', at: AT, error: 'The router has no username and password saved', interfaces: [] },
      ],
    }) +
      frame('router-traffic', {
        deviceId: 'r1',
        deviceName: 'Core Norte',
        at: AT,
        error: null,
        interfaces: [
          { name: 'ether1-wan', type: 'ether', running: true, rxBps: 120_000_000, txBps: 8_500_000 },
          { name: 'ether5', type: 'ether', running: false, rxBps: 0, txBps: 0 },
        ],
      })
  );
  await page.goto('/routers');

  await expect(page.getByRole('heading', { name: 'Routers principales' })).toBeVisible();
  await expect(page.getByText('ether1-wan')).toBeVisible();
  await expect(page.getByText('120.0 Mbps')).toBeVisible();
  await expect(page.getByText('1 de 2 interfaces con enlace')).toBeVisible();

  // A link that is down is hidden until asked for.
  await expect(page.getByText('ether5')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Mostrar interfaces sin enlace' }).check();
  await expect(page.getByText('ether5')).toBeVisible();

  await expect(page.getByText(/no tiene usuario y contraseña guardados/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir el dispositivo' })).toHaveAttribute('href', '/devices/r2?tab=settings');
});

test('an install with no main router says how to get one', async ({ page }) => {
  await stubStream(page, frame('router-traffic-snapshot', { intervalSeconds: 2, routers: [] }));
  await page.goto('/routers');

  await expect(page.getByText(/No hay routers principales/)).toBeVisible();
});

test('the page connects to the real stream', async ({ page }) => {
  await page.goto('/routers');
  await expect(page.getByText('En vivo', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Sesión expirada|Network error/)).toHaveCount(0);
});
