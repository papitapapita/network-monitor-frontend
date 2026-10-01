import { test, expect } from './fixtures/test';
import type { Page } from '@playwright/test';
import { field } from './fixtures/helpers';

/**
 * The subscription stages (R17). The backend's stage follows the vendor's
 * SUBSCRIPTION_PAID_UNTIL and the calendar, so it cannot be moved on demand —
 * GET /api/subscription is answered here instead.
 */

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

function stage(state: string, paidDaysFromNow = 0) {
  const paid = Date.now() + paidDaysFromNow * DAY;
  const enforced = state !== 'NOT_ENFORCED';
  return {
    state,
    paidThrough: enforced ? iso(paid) : null,
    graceEndsAt: enforced ? iso(paid + 3 * DAY) : null,
    lockedAt: enforced ? iso(paid + 10 * DAY) : null,
    readOnly: state === 'READ_ONLY' || state === 'LOCKED',
    locked: state === 'LOCKED',
  };
}

async function withSubscription(page: Page, current: () => object) {
  await page.route(/\/api\/subscription$/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: current() }) }));
}

test('grace: a warning, and everything still works', async ({ page }) => {
  await withSubscription(page, () => stage('GRACE', -1));
  await page.goto('/devices');
  await expect(page.getByText('Pago pendiente.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agregar Dispositivo' })).toBeVisible();
});

test('read-only: says alerts are off and offers no writes', async ({ page }) => {
  await withSubscription(page, () => stage('READ_ONLY', -5));
  await page.goto('/devices');
  // An empty alert feed must not read as a quiet network.
  await expect(page.getByText(/las alertas están apagadas/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Agregar Dispositivo' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Seleccionar todo' })).toHaveCount(0);

  await page.goto('/devices/create');
  await expect(page.getByText('Sistema en solo lectura')).toBeVisible();
});

test('read-only: a device’s page offers no edit, delete or poll on any tab', async ({ page, api }) => {
  const { devices } = await api.get<{ devices: Array<{ id: string; name: string }> }>('devices?limit=1');
  test.skip(devices.length === 0, 'no device to open');
  await withSubscription(page, () => stage('READ_ONLY', -5));
  await page.goto(`/devices/${devices[0].id}`);
  await expect(page.getByRole('heading', { name: devices[0].name })).toBeVisible();

  const writes = /^(Editar|Eliminar|Reemplazar|Intercambiar|Sondear ahora|Configurar|Crear configuración|Restablecer|Reiniciar)/;
  for (const tab of ['Detalles', 'Sondeo', 'Notificaciones', 'Credenciales']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main').getByRole('button', { name: writes })).toHaveCount(0);
  }
});

test('locked: only the lock screen, no way into the app', async ({ page }) => {
  await withSubscription(page, () => stage('LOCKED', -12));
  await page.goto('/devices');
  await expect(page.getByRole('heading', { name: 'Acceso bloqueado' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Panel' })).toHaveCount(0);
});

test('a 402 on a write switches the app to read-only at once', async ({ page }) => {
  let current = stage('NOT_ENFORCED');
  await withSubscription(page, () => current);
  // The write is refused here rather than by the backend, which is not lapsed.
  await page.route(/\/api\/notification-mutes$/, (route) => {
    if (route.request().method() === 'GET') return route.continue();
    current = stage('READ_ONLY', -5);
    return route.fulfill({ status: 402, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Subscription expired: the service is read-only until payment is received' }) });
  });

  await page.goto('/settings');
  await field(page, 'Silenciar otra métrica').fill('e2e_metric');
  await page.getByRole('button', { name: 'Añadir' }).click();
  await expect(page.getByText(/suscripción está vencida/).first()).toBeVisible();
  await expect(page.getByText(/las alertas están apagadas/)).toBeVisible();
});
