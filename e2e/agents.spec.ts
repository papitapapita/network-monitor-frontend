import { test, expect } from './fixtures/test';
import { field } from './fixtures/helpers';
import { fakeAgent, iso, patchInstallation, stubAgents } from './fixtures/agents';
import { E2E } from '../playwright.config';

/**
 * Probe agents (ADR 0002). Every agent route is answered by `stubAgents` —
 * see its comment for why real agents are never created from here.
 */

test.describe('customer admin', () => {
  test('sees agents read-only: no create, re-key or revoke', async ({ page }) => {
    await stubAgents(page, [fakeAgent({ id: 'a1', name: 'Oficina principal', deviceCount: 3 })]);
    await page.goto('/agents');
    await expect(page.getByRole('cell', { name: 'Oficina principal' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo agente' })).toHaveCount(0);

    await page.goto('/agents/a1');
    await expect(page.getByRole('button', { name: 'Revocar' })).toHaveCount(0);
    // Moving devices is ADMIN/OPERATOR work, not the vendor's alone.
    await expect(page.getByRole('heading', { name: 'Mover dispositivos' })).toBeVisible();
  });

  test('with two agents a new device must say which one reaches it', async ({ page }) => {
    await stubAgents(page, [fakeAgent({ id: 'a1', name: 'Oficina principal' }), fakeAgent({ id: 'a2', name: 'Cliente Norte' })]);
    await page.goto('/devices/create');
    await page.getByPlaceholder('Router-Core-01').fill('e2e-no-se-guarda');
    await page.getByRole('button', { name: /Crear|Guardar/ }).last().click();
    // Refused client-side, before any request, like the backend would (DEV-166).
    await expect(page.getByText('Elige qué agente sondea este dispositivo, o «Servidor»').first()).toBeVisible();
  });

  test('an offline agent explains itself and lists its outages', async ({ page }) => {
    const since = Date.now() - 3 * 3_600_000;
    await stubAgents(page, [fakeAgent({ id: 'a1', name: 'Cliente Norte', lastSeenAt: iso(since), offlineSince: iso(since + 300_000) })]);
    await page.goto('/agents/a1');
    await expect(page.getByText(/No reporta desde/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Historial de desconexiones/ })).toBeVisible();
  });

  test('a self-update that failed is a warning; one that installed is just a fact', async ({ page }) => {
    const at = iso(Date.now() - 3_600_000);
    const agents = [
      fakeAgent({ id: 'a1', name: 'Cliente Norte', agentVersion: '0.3.0',
        lastUpdate: { version: '0.4.0', outcome: 'ROLLED_BACK', reason: 'the new version never reached the backend', at } }),
      fakeAgent({ id: 'a2', name: 'Oficina principal', agentVersion: '0.4.0',
        lastUpdate: { version: '0.4.0', outcome: 'INSTALLED', reason: null, at } }),
    ];
    await stubAgents(page, agents);

    await page.goto('/agents/a1');
    await expect(page.getByText('La actualización a la versión 0.4.0 se revirtió')).toBeVisible();
    await expect(page.getByText(/the new version never reached the backend/)).toBeVisible();
    await expect(page.getByText(/Sigue midiendo con la versión 0\.3\.0/)).toBeVisible();

    await page.goto('/agents/a2');
    await expect(page.getByText('0.4.0 · instalada')).toBeVisible();
    await expect(page.getByText(/La actualización a la versión/)).toHaveCount(0);
  });
});

test.describe('vendor', () => {
  test.skip(!E2E.vendorEmail, 'E2E_VENDOR_EMAIL / E2E_VENDOR_PASSWORD not set');
  test.use({ storageState: E2E.vendorStorageState });

  test('creates an agent, gets the key once, and moves the server devices to it once paired', async ({ page }) => {
    await patchInstallation(page, (i) => { i.agentPairingAvailable = true; });
    await stubAgents(page, [], { pairAfterReads: 2 });
    await page.route(/\/api\/devices\/agent-assignment$/, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { assigned: ['d1', 'd2'], failed: [] } }) }));

    await page.goto('/agents');
    await page.getByRole('button', { name: 'Nuevo agente' }).click();
    await field(page.getByRole('dialog'), 'Nombre').fill('Oficina principal');
    await page.getByRole('button', { name: 'Crear y obtener clave' }).click();

    await expect(page.getByTestId('pairing-key')).toHaveValue(/^pk1\./);
    await expect(page.getByText('no se volverá a mostrar')).toBeVisible();
    await expect(page.getByTestId('agent-paired')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Mover a este agente los dispositivos del servidor' }).click();
    await expect(page.getByText('2 dispositivos movidos.')).toBeVisible();
  });

  test('without AGENT_PUBLIC_URL, creating an agent is disabled and says why', async ({ page }) => {
    await patchInstallation(page, (i) => { i.agentPairingAvailable = false; });
    await stubAgents(page, []);
    await page.goto('/agents');
    await expect(page.getByRole('button', { name: /no puede emitir claves/ })).toBeDisabled();
    await expect(page.getByText(/AGENT_PUBLIC_URL/).first()).toBeVisible();
  });

  test('downloads the installer for a pending agent', async ({ page }) => {
    await patchInstallation(page, (i) => { i.installersAvailable = true; });
    await stubAgents(page, [fakeAgent({ id: 'a1', name: 'Sede Sur', status: 'PENDING', pairingExpiresAt: iso(Date.now() + 86_400_000), lastSeenAt: null, enrolledAt: null })]);
    await page.route(/\/api\/installation\/installers$/, (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { installers: [
        { fileName: 'nms-agent-setup-0.1.0.exe', platform: 'windows', version: '0.1.0', sizeBytes: 11, modifiedAt: iso(Date.now()) },
      ] } }) }));
    await page.route(/\/api\/installation\/installers\/.+/, (route) =>
      route.fulfill({ headers: { 'content-length': '11', 'content-type': 'application/octet-stream' }, body: 'hello agent' }));

    await page.goto('/agents/a1');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar v0.1.0' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('nms-agent-setup-0.1.0.exe');
  });
});
