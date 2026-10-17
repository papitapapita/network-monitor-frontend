import { test, expect } from './fixtures/test';
import type { Page } from '@playwright/test';

/**
 * The on-demand network sweep (MON-080 … MON-084). The stubbed specs answer
 * the stream with fixed frames, so nothing is pinged; the last one runs the
 * real sweep and asserts only that it finishes.
 */

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const AT = '2026-10-17T15:00:00.000Z';

const result = (over: Record<string, unknown>) => ({
  ipAddress: '10.0.0.1',
  category: 'CPE',
  locationId: null,
  locationName: 'Torre Norte',
  agentName: null,
  outcome: 'UP',
  latencyMs: 4,
  attempts: 1,
  reason: null,
  detail: null,
  at: AT,
  ...over,
});

async function stubSweep(page: Page, status: number, body: string) {
  await page.route(/\/api\/network\/sweep\/stream/, (route) =>
    route.fulfill({
      status,
      contentType: status === 200 ? 'text/event-stream' : 'application/json',
      body,
    })
  );
}

test('a sweep lists the dead first and folds an offline agent into one line', async ({ page }) => {
  await stubSweep(
    page,
    200,
    frame('sweep-start', { startedAt: AT, total: 5, toPing: 4, filters: {} }) +
      frame('sweep-result', result({ deviceId: 's1', deviceName: 'CPE Sin IP', ipAddress: null, outcome: 'SKIPPED', latencyMs: null, attempts: 0, reason: 'NO_IP_ADDRESS', detail: 'No IP address' })) +
      frame('sweep-result', result({ deviceId: 'u1', deviceName: 'AP Centro', outcome: 'UP' })) +
      frame('sweep-result', result({ deviceId: 'd1', deviceName: 'CPE Caído', outcome: 'DOWN', latencyMs: null, attempts: 3 })) +
      frame('sweep-result', result({ deviceId: 'e1', deviceName: 'CPE Remoto 1', agentName: 'Torre Sur', outcome: 'ERROR', latencyMs: null, attempts: 0, detail: 'The agent is not connected' })) +
      frame('sweep-result', result({ deviceId: 'e2', deviceName: 'CPE Remoto 2', agentName: 'Torre Sur', outcome: 'ERROR', latencyMs: null, attempts: 0, detail: 'The agent is not connected' })) +
      frame('sweep-done', { startedAt: AT, finishedAt: AT, durationMs: 3200, total: 5, up: 1, down: 1, error: 2, skipped: 1, cancelled: false })
  );
  await page.goto('/network-sweep');
  await page.getByRole('button', { name: 'Barrer red' }).click();

  await expect(page.getByText('Agente Torre Sur desconectado')).toBeVisible();
  await expect(page.getByText('2 equipos sin revisar')).toBeVisible();

  // Down before up, and the agent's devices are not rows of their own.
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('CPE Caído');
  await expect(rows.nth(0)).toContainText('Sin respuesta');
  await expect(rows.nth(1)).toContainText('AP Centro');

  await page.getByRole('button', { name: 'Ver el equipo omitido' }).click();
  await expect(page.getByText('Sin dirección IP')).toBeVisible();

  // Kept in the browser: a reload still shows it.
  await page.reload();
  await expect(page.getByText(/Último barrido guardado en este navegador/)).toBeVisible();
  await expect(page.getByText('CPE Caído')).toBeVisible();
});

test('a sweep already running says so', async ({ page }) => {
  await stubSweep(page, 409, JSON.stringify({ success: false, error: 'A network sweep is already running' }));
  await page.goto('/network-sweep');
  await page.getByRole('button', { name: 'Barrer red' }).click();

  await expect(page.getByText(/Ya hay un barrido en curso/)).toBeVisible();
});

test('the real sweep finishes', async ({ page }) => {
  await page.goto('/network-sweep');
  await page.getByRole('button', { name: 'Barrer red' }).click();
  await expect(page.getByText(/^Terminó /)).toBeVisible({ timeout: 60_000 });
});
