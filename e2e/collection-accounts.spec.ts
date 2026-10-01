import { test, expect } from './fixtures/test';
import type { Page } from '@playwright/test';

/**
 * BIL-232: a cuenta de cobro prints the vendor's issuer, so its PDF answers
 * 409 until the vendor sets one. The account and the refusal are answered
 * here — the install's real issuer may well be configured.
 */

const ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = {
  id: ID, code: 7, number: 'CC-0007', status: 'PENDING',
  customerId: null, customerName: 'Cliente e2e', customerDocument: null, customerPhone: null, customerEmail: null, customerAddress: null,
  lineItems: [{ description: 'Instalación', unitPrice: 100000, quantity: 1, lineTotal: 100000 }],
  total: 100000, issueDate: '2026-10-01', dueDate: null, notes: null, paidAt: null, cancelledAt: null, createdBy: null,
  createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z',
};

async function stubAccountWithoutIssuer(page: Page) {
  await page.route(new RegExp(`/api/collection-accounts/${ID}$`), (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: ACCOUNT }) }));
  await page.route(new RegExp(`/api/collection-accounts/${ID}/pdf$`), (route) =>
    route.fulfill({ status: 409, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'Cannot print the cuenta de cobro: the issuer is not configured' }) }));
}

test('no issuer: the PDF says what is missing and who sets it', async ({ page }) => {
  await stubAccountWithoutIssuer(page);
  await page.goto(`/collection-accounts/${ID}`);
  await page.getByRole('button', { name: 'Descargar PDF' }).click();

  await expect(page.getByText('Falta configurar el emisor.')).toBeVisible();
  await expect(page.getByText('Pídele al proveedor del sistema que lo configure.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Configurar el emisor' })).toHaveCount(0);
});

test('no issuer: the vendor is taken straight to it', async ({ page }) => {
  await page.addInitScript(() => {
    const user = JSON.parse(localStorage.getItem('nms_user') ?? 'null');
    if (user) localStorage.setItem('nms_user', JSON.stringify({ ...user, role: 'VENDOR' }));
  });
  await stubAccountWithoutIssuer(page);
  await page.goto(`/collection-accounts/${ID}`);
  await page.getByRole('button', { name: 'Descargar PDF' }).click();

  const link = page.getByRole('link', { name: 'Configurar el emisor' });
  await expect(link).toHaveAttribute('href', '/settings/installation#emisor');

  await page.route(/\/api\/installation\/settings$/, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: {
    vendorTelegramChatId: null, subscriptionPaidUntil: null, subscriptionGraceDays: 3, subscriptionReadOnlyDays: 7,
    pingResultRetentionDays: 30, alertRetentionDays: 90, wirelessSnapshotRetentionDays: 30, wirelessAlertRecordRetentionDays: 90,
    issuer: null, whatsApp: null, enforcementRouter: null,
  } }) }));
  await link.click();
  await expect(page.locator('#emisor')).toBeInViewport();
});
