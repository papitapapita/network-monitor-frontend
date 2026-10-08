import { test, expect } from './fixtures/test';

/**
 * The fleet live-throughput SSE stream, through the UI that consumes it.
 *
 * These assert the transport as much as the rendering: the frames only parse,
 * and the connection only reaches "En vivo", if the auth header, the event
 * names and the frame parsing are all right. What they deliberately do not
 * assert is any particular throughput number — those come from whatever the
 * poller last stored, which no test can arrange.
 */

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
});
