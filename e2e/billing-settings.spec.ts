import { test, expect } from './fixtures/test';
import type { Page } from '@playwright/test';
import { field, selectDropdown } from './fixtures/helpers';

/**
 * The install's billing cycle (BIL-280). A save changes when every real
 * customer is billed and cut, so the write is answered here; the read is
 * answered too, so the form starts from known values.
 */

const SAVED = {
  automaticBillingEnabled: true,
  billingMode: 'ADVANCE',
  issueLeadDays: 5,
  graceDays: 3,
  automaticCutEnabled: false,
  reminderWhatsAppTemplate: null,
  billWhatsAppTemplate: null,
};

const ok = (data: unknown) => ({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

/** Answers the settings route; returns what each save sent. */
async function stubSettings(page: Page, saved: object = SAVED) {
  const saves: unknown[] = [];
  await page.route(/\/api\/billing-settings$/, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill(ok(saved));
    const body = route.request().postDataJSON();
    saves.push(body);
    return route.fulfill(ok(body));
  });
  return saves;
}

const billing = (page: Page) => page.getByRole('region', { name: 'Facturación' });

test('an administrator saves all seven settings at once', async ({ page }) => {
  const saves = await stubSettings(page);
  await page.goto('/settings');

  const card = billing(page);
  await expect(field(card, 'Días de anticipación')).toHaveValue('5');
  await selectDropdown(page, 'Modalidad de cobro', 'Vencido — la factura de octubre cobra septiembre', card);
  await field(card, 'Días de gracia').fill('7');
  await field(card, 'Plantilla de WhatsApp para recordatorios').fill('recordatorio_pago');
  await field(card, 'Plantilla de WhatsApp para facturas').fill('factura_emitida');
  await card.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(page.getByText(/Configuración de facturación guardada/)).toBeVisible();
  expect(saves).toEqual([
    { ...SAVED, billingMode: 'ARREARS', graceDays: 7, reminderWhatsAppTemplate: 'recordatorio_pago', billWhatsAppTemplate: 'factura_emitida' },
  ]);
});

test('out-of-range days or a bad template name are caught before they are sent', async ({ page }) => {
  const saves = await stubSettings(page);
  await page.goto('/settings');

  const card = billing(page);
  await field(card, 'Días de anticipación').fill('0');
  await field(card, 'Días de gracia').fill('15');
  await field(card, 'Plantilla de WhatsApp para recordatorios').fill('Recordatorio Pago');
  await card.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(card.getByText(/entre 1 y 14/)).toBeVisible();
  await expect(card.getByText(/entre 0 y 14/)).toBeVisible();
  await expect(card.getByText(/Solo minúsculas/)).toBeVisible();
  expect(saves).toEqual([]);
});

test('turning the automatic cut on asks first, because it suspends customers', async ({ page }) => {
  const saves = await stubSettings(page);
  await page.goto('/settings');

  const card = billing(page);
  await card.getByRole('checkbox', { name: 'Corte automático' }).check();
  await card.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Activar corte' }).click();

  await expect(page.getByText(/Configuración de facturación guardada/)).toBeVisible();
  expect(saves).toEqual([{ ...SAVED, automaticCutEnabled: true }]);
});

test('with automatic billing off, the cycle settings wait for it', async ({ page }) => {
  await stubSettings(page, { ...SAVED, automaticBillingEnabled: false });
  await page.goto('/settings');

  const card = billing(page);
  await expect(field(card, 'Días de anticipación')).toBeDisabled();
  await expect(card.getByRole('checkbox', { name: 'Corte automático' })).toBeDisabled();
  await card.getByRole('checkbox', { name: 'Facturación automática' }).check();
  await expect(field(card, 'Días de anticipación')).toBeEnabled();
});
