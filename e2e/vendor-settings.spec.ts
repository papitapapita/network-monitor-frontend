import { test, expect } from './fixtures/test';
import type { Page } from '@playwright/test';
import { field } from './fixtures/helpers';
import { E2E } from '../playwright.config';

/**
 * The vendor's settings (INS-028). Saving them moves the real install's
 * subscription and retention, so the route is answered here, and the
 * session is shown as the vendor's by rewriting the stored role — the
 * dashboard reads it from there. One test at the end reads the real route
 * with the real vendor session, when there is one.
 */

const SAVED = {
  vendorTelegramChatId: null,
  subscriptionPaidUntil: '2026-10-31',
  subscriptionGraceDays: 3,
  subscriptionReadOnlyDays: 7,
  pingResultRetentionDays: 30,
  alertRetentionDays: 90,
  wirelessSnapshotRetentionDays: 30,
  wirelessAlertRecordRetentionDays: 90,
  issuer: null,
  whatsApp: null,
  enforcementRouter: null,
};

const ok = (data: unknown) => ({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

async function asVendor(page: Page) {
  await page.addInitScript(() => {
    const user = JSON.parse(localStorage.getItem('nms_user') ?? 'null');
    if (user) localStorage.setItem('nms_user', JSON.stringify({ ...user, role: 'VENDOR' }));
  });
}

/** Answers the settings route; returns each PUT body. */
async function stubVendorSettings(page: Page) {
  const saves: Record<string, unknown>[] = [];
  await page.route(/\/api\/installation\/settings$/, (route) => {
    if (route.request().method() === 'GET') return route.fulfill(ok(SAVED));
    const body = route.request().postDataJSON();
    saves.push(body);
    return route.fulfill(ok(body));
  });
  return saves;
}

const stage = (state: string) => ({
  state,
  paidThrough: '2026-09-01T05:00:00.000Z',
  graceEndsAt: '2026-09-04T05:00:00.000Z',
  lockedAt: '2026-09-11T05:00:00.000Z',
  readOnly: state === 'READ_ONLY' || state === 'LOCKED',
  locked: state === 'LOCKED',
});

test('the customer’s administrator has no way in', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Configuración del proveedor/ })).toHaveCount(0);

  await page.goto('/settings/installation');
  await expect(page.getByText('Solo para el proveedor')).toBeVisible();
});

test('recording a month moves the last paid day, previews the stages and re-reads the subscription', async ({ page }) => {
  await asVendor(page);
  const saves = await stubVendorSettings(page);
  let subscriptionReads = 0;
  await page.route(/\/api\/subscription$/, (route) => {
    subscriptionReads++;
    return route.fulfill(ok({ state: 'NOT_ENFORCED', paidThrough: null, graceEndsAt: null, lockedAt: null, readOnly: false, locked: false }));
  });

  await page.goto('/settings');
  await page.getByRole('link', { name: /Configuración del proveedor/ }).click();
  await expect(field(page, 'Último día pagado')).toHaveValue('2026-10-31');

  await field(page, 'Último día pagado').fill('2026-12-31');
  await page.getByRole('button', { name: 'Registrar un mes' }).click();
  // Jan 31 + 1 month is clamped to the month's end.
  await expect(field(page, 'Último día pagado')).toHaveValue('2027-01-31');
  await page.getByRole('button', { name: 'Registrar un mes' }).click();
  await expect(field(page, 'Último día pagado')).toHaveValue('2027-02-28');

  const stages = page.getByRole('list', { name: 'Etapas' });
  await expect(stages).toContainText('Servicio completo hasta el 28 de febrero de 2027');
  await expect(stages).toContainText('Gracia hasta el 3 de marzo de 2027');
  await expect(stages).toContainText('Solo lectura hasta el 10 de marzo de 2027');
  await expect(stages).toContainText('Bloqueada desde el 11 de marzo de 2027');

  const readsBefore = subscriptionReads;
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Configuración del proveedor guardada.')).toBeVisible();
  expect(saves).toEqual([{ ...SAVED, subscriptionPaidUntil: '2027-02-28' }]);
  expect(subscriptionReads).toBeGreaterThan(readsBefore);
});

test('a group is sent complete or not at all, and its rules are checked first', async ({ page }) => {
  await asVendor(page);
  const saves = await stubVendorSettings(page);
  await page.goto('/settings/installation');

  const issuer = page.locator('#emisor');
  await issuer.getByRole('checkbox', { name: 'Configurado' }).check();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(issuer.getByText('Obligatorio').first()).toBeVisible();
  expect(saves).toEqual([]);

  const values: Record<string, string> = {
    'Nombre o razón social': 'Redes del Llano SAS',
    'Número de documento': '900123456-7',
    'Dirección': 'Calle 1 # 2-3',
    'Ciudad': 'Villavicencio',
    'Teléfono de contacto': '3001234567',
    'Correo de contacto': 'no es un correo',
  };
  for (const [label, value] of Object.entries(values)) await field(issuer, label).fill(value);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(issuer.getByText('Un correo electrónico')).toBeVisible();
  expect(saves).toEqual([]);

  await field(issuer, 'Correo de contacto').fill('cobros@redesllano.co');
  const whatsApp = page.locator('#whatsapp');
  await whatsApp.getByRole('checkbox', { name: 'Configurado' }).check();
  await field(whatsApp, 'ID del número de teléfono').fill('123456789012345');
  await field(whatsApp, 'Nombre de la plantilla').fill('Aviso Corte');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(whatsApp.getByText('Minúsculas, dígitos y guiones bajos')).toBeVisible();

  await field(whatsApp, 'Nombre de la plantilla').fill('aviso_corte');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Configuración del proveedor guardada.')).toBeVisible();
  expect(saves).toEqual([{
    ...SAVED,
    issuer: {
      name: 'Redes del Llano SAS', documentLabel: 'NIT', document: '900123456-7', address: 'Calle 1 # 2-3',
      city: 'Villavicencio', contactPhone: '3001234567', contactEmail: 'cobros@redesllano.co', accentColorHex: '#1F4E79',
    },
    whatsApp: { phoneNumberId: '123456789012345', templateName: 'aviso_corte', templateLanguage: 'es', apiVersion: 'v21.0' },
  }]);
});

test('shortening a retention window asks first, because older data goes at the next purge', async ({ page }) => {
  await asVendor(page);
  const saves = await stubVendorSettings(page);
  await page.goto('/settings/installation');

  await field(page, 'Alertas resueltas (días)').fill('30');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText(/alertas resueltas \(de 90 a 30 días\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  expect(saves).toEqual([]);

  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar y acortar' }).click();
  await expect(page.getByText('Configuración del proveedor guardada.')).toBeVisible();
  expect(saves).toEqual([{ ...SAVED, alertRetentionDays: 30 }]);
});

test('locked: the vendor records the payment from the lock screen and the app comes back', async ({ page }) => {
  await asVendor(page);
  const saves = await stubVendorSettings(page);
  let current = stage('LOCKED');
  await page.route(/\/api\/subscription$/, (route) => route.fulfill(ok(current)));
  await page.route(/\/api\/installation\/settings$/, (route) => {
    if (route.request().method() === 'GET') return route.fallback();
    current = stage('ACTIVE');
    return route.fallback();
  });

  await page.goto('/devices');
  await expect(page.getByRole('heading', { name: 'Acceso bloqueado' })).toBeVisible();
  await page.getByRole('link', { name: 'Registrar pago' }).click();

  await expect(page.getByText('Instalación bloqueada.')).toBeVisible();
  // Only the settings: no menu into the rest of the app.
  await expect(page.getByRole('link', { name: 'Panel' })).toHaveCount(0);
  await field(page, 'Último día pagado').fill('2026-11-30');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(page.getByText('Instalación bloqueada.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Panel' })).toBeVisible();
  expect(saves).toHaveLength(1);
});

test.describe('with the real vendor session', () => {
  test.use({ storageState: E2E.vendorStorageState });
  test.skip(!E2E.vendorEmail, 'E2E_VENDOR_EMAIL / E2E_VENDOR_PASSWORD not set');

  test('the real settings load (nothing is saved)', async ({ page }) => {
    await page.goto('/settings/installation');
    await expect(page.getByRole('heading', { name: 'Configuración del proveedor' })).toBeVisible();
    await expect(field(page, 'Alertas resueltas (días)')).not.toHaveValue('');
    await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
  });
});
