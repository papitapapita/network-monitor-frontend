import { test, expect } from './fixtures/test';
import type { Page } from '@playwright/test';
import { field } from './fixtures/helpers';
import { E2E } from '../playwright.config';

/**
 * Staff accounts and passwords (IDN-140…144). Reads are real; writes are
 * answered here: the API has no user delete, and changing the harness
 * account's password would lock the rest of the suite out.
 */

async function answerUserWrites(page: Page, seen: string[]) {
  await page.route(/\/api\/users(\/.*)?$/, (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.continue();
    seen.push(`${req.method()} ${new URL(req.url()).pathname} ${req.postData() ?? ''}`);
    const now = new Date().toISOString();

    if (req.url().endsWith('/me/password')) {
      if (req.postDataJSON().currentPassword !== E2E.password) {
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Current password is incorrect' }) });
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { token: 'e2e-new-token' } }) });
    }

    const body = req.postDataJSON() ?? {};
    return route.fulfill({
      status: req.method() === 'POST' ? 201 : 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {
        id: 'e2e-user', email: body.email ?? 'someone@example.com', role: body.role ?? 'OPERATOR',
        disabled: !!body.disabled, disabledAt: null, twoFactorEnabled: false, createdAt: now, updatedAt: now,
      } }),
    });
  });
}

test('an administrator lists and creates accounts, but not their own or the vendor’s', async ({ page }) => {
  const seen: string[] = [];
  await answerUserWrites(page, seen);
  await page.goto('/users');

  await expect(page.getByRole('cell', { name: E2E.email }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: `Editar ${E2E.email}` })).toHaveCount(0);
  if (E2E.vendorEmail) await expect(page.getByText(E2E.vendorEmail)).toHaveCount(0);

  // Inviting is the default: no password typed, the person picks their own.
  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  let dialog = page.getByRole('dialog');
  await field(dialog, 'Correo').fill('e2e-invitado@example.com');
  await dialog.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(page.getByText('Invitación enviada a e2e-invitado@example.com')).toBeVisible();
  const invite = seen.find((s) => s.startsWith('POST /api/users ') && s.includes('e2e-invitado'));
  expect(invite).toBeDefined();
  expect(invite).not.toContain('"password"');

  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  dialog = page.getByRole('dialog');
  await field(dialog, 'Correo').fill('e2e-tecnico@example.com');
  await dialog.getByText('Asignar una contraseña ahora').click();
  await field(dialog, 'Contraseña').fill('corta');
  await dialog.getByRole('button', { name: 'Crear usuario' }).click();
  await expect(dialog.getByText(/Entre 12 y 200/)).toBeVisible();

  await field(dialog, 'Contraseña').fill('una-clave-larga');
  await dialog.getByRole('button', { name: 'Crear usuario' }).click();
  await expect(page.getByText('Usuario e2e-tecnico@example.com creado')).toBeVisible();
  expect(seen.some((s) => s.startsWith('POST /api/users ') && s.includes('"role":"OPERATOR"'))).toBe(true);
});

test('two-factor is reset only on accounts that have it, and an administrator’s only by the vendor', async ({ page }) => {
  const seen: string[] = [];
  await answerUserWrites(page, seen);
  const now = new Date().toISOString();
  const account = (email: string, role: string, twoFactorEnabled: boolean) => ({
    id: `e2e-${email}`, email, role, disabled: false, disabledAt: null, twoFactorEnabled, createdAt: now, updatedAt: now,
  });
  await page.route(/\/api\/users$/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { users: [
      account('con-2fa@example.com', 'OPERATOR', true),
      account('sin-2fa@example.com', 'OPERATOR', false),
      account('otro-admin@example.com', 'ADMIN', true),
    ] } }) });
  });
  await page.goto('/users');

  await expect(page.getByRole('button', { name: 'Restablecer verificación de sin-2fa@example.com' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Restablecer verificación de otro-admin@example.com' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Restablecer verificación de con-2fa@example.com' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restablecer' }).click();
  await expect(page.getByText(/Verificación de con-2fa@example.com restablecida/)).toBeVisible();
  expect(seen.some((s) => s.startsWith('POST /api/users/e2e-con-2fa@example.com/two-factor/reset'))).toBe(true);
});

test('changing my password keeps this session signed in', async ({ page }) => {
  await answerUserWrites(page, []);
  await page.goto('/settings');

  await field(page, 'Contraseña actual').fill('not-the-password');
  await field(page, 'Nueva contraseña').fill('otra-clave-larga');
  await field(page, 'Repite la nueva contraseña').fill('otra-clave-larga');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText('La contraseña actual no es correcta.')).toBeVisible();

  await field(page, 'Contraseña actual').fill(E2E.password);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText(/Contraseña cambiada/)).toBeVisible();
  // The answer resets the session cookie; nothing on this side has to change.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cambiar mi contraseña' })).toBeVisible();
});

test('the data purge is the vendor’s only', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Cambiar mi contraseña' })).toBeVisible();
  await expect(page.getByText('Mantenimiento (proveedor)')).toHaveCount(0);
});

test.describe('vendor', () => {
  test.skip(!E2E.vendorEmail, 'E2E_VENDOR_EMAIL / E2E_VENDOR_PASSWORD not set');
  test.use({ storageState: E2E.vendorStorageState });

  test('sees the purge and can edit the customer’s administrator', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Mantenimiento (proveedor)')).toBeVisible();
    await page.goto('/users');
    await expect(page.getByRole('button', { name: `Editar ${E2E.email}` })).toBeVisible();
  });
});
