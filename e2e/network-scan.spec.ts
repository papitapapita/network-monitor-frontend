import { test, expect } from './fixtures/test';
import { field } from './fixtures/helpers';

/**
 * A scan probes every host in the CIDR block on the real network, so the run
 * is opt-in:
 *
 *   E2E_RUN_NETWORK_SCAN=1 E2E_SCAN_SEGMENT=192.168.1.0/30 npm run e2e
 *
 * Without those, the client-side behaviour is still covered — validation,
 * the disabled submit, the CIDR rules — none of which sends a packet.
 */
const RUN_SCAN = process.env.E2E_RUN_NETWORK_SCAN === '1';
const SEGMENT = process.env.E2E_SCAN_SEGMENT ?? '192.168.1.0/30';

test.describe('network scan', () => {
  test('cannot submit an empty segment', async ({ page }) => {
    await page.goto('/network-scan');

    await expect(page.getByRole('heading', { name: 'Escaneo de Red' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Escanear' })).toBeDisabled();
  });

  test('rejects a malformed CIDR without hitting the network', async ({ page }) => {
    await page.goto('/network-scan');

    await field(page, 'Segmento CIDR').fill('not-a-cidr');
    await page.getByRole('button', { name: 'Escanear' }).click();

    await expect(page.getByText(/Ingresa un bloque CIDR válido/)).toBeVisible();
  });

  test('rejects an out-of-range prefix', async ({ page }) => {
    await page.goto('/network-scan');

    // /33 fails the client-side regex, so nothing is sent.
    await field(page, 'Segmento CIDR').fill('192.168.1.0/33');
    await page.getByRole('button', { name: 'Escanear' }).click();

    await expect(page.getByText(/Ingresa un bloque CIDR válido/)).toBeVisible();
  });

  test('surfaces the backend rejection for a block wider than /22', async ({ page }) => {
    await page.goto('/network-scan');

    // isValidCidr() accepts any /0–/32 despite the "máximo /22" hint, so this
    // reaches the backend, which 400s it. Cheap: rejected before any probing.
    await field(page, 'Segmento CIDR').fill('10.0.0.0/8');
    await page.getByRole('button', { name: 'Escanear' }).click();

    await expect(page.getByText(/CIDR range too large|1024/i).first()).toBeVisible();
  });

  test('scans a real segment', async ({ page }) => {
    test.skip(!RUN_SCAN, 'Set E2E_RUN_NETWORK_SCAN=1 to probe the real network.');
    // A real scan walks the whole block; give it room.
    test.setTimeout(180_000);

    await page.goto('/network-scan');
    await field(page, 'Segmento CIDR').fill(SEGMENT);
    await page.getByRole('button', { name: 'Escanear' }).click();

    await expect(page.getByText(`Segmento:`)).toBeVisible({ timeout: 150_000 });
    await expect(page.getByText(SEGMENT).first()).toBeVisible();
  });
});
