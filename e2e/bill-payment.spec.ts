import { test, expect } from './fixtures/test';
import type { Page } from '@playwright/test';
import { field, selectDropdown } from './fixtures/helpers';

/**
 * Recording a bill's payment (BIL-300…303). Paying is final and can
 * reactivate a real customer's services, so the bill and the write are
 * answered here.
 */

const CUSTOMER = {
  id: 'cust-e2e', fullName: 'Cliente de Prueba', phone: '3001234567', email: null, cedula: null,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
};

const BILL = {
  id: 'bill-e2e', customerId: CUSTOMER.id, period: '2026-10', status: 'PENDING',
  issueDate: '2026-10-10T00:00:00.000Z', dueDate: '2026-10-15T00:00:00.000Z',
  paidAt: null, payment: null, total: 30000,
  lineItems: [{
    contractedServiceId: 'cs-e2e', servicePlanId: 'plan-e2e', planName: 'Hogar 50MB', monthlyPrice: 60000,
    amount: 30000, serviceFrom: '2026-10-17', serviceTo: '2026-10-31',
  }],
  createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z',
};

const ok = (data: unknown) => ({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

async function stubBill(page: Page) {
  const pays: Array<Record<string, unknown>> = [];
  await page.route(/\/api\/customers\/cust-e2e$/, (route) => route.fulfill(ok(CUSTOMER)));
  await page.route(/\/api\/bills\/bill-e2e$/, (route) => route.fulfill(ok(BILL)));
  await page.route(/\/api\/bills\/bill-e2e\/pay$/, async (route) => {
    const body = route.request().postDataJSON();
    pays.push(body);
    return route.fulfill(ok({
      ...BILL, status: 'PAID', paidAt: body.paidAt,
      payment: { method: body.method, reference: body.reference, amount: BILL.total, paidAt: body.paidAt, recordedByUserId: 'user-e2e' },
    }));
  });
  return pays;
}

test('a prorated line shows the days it charges and its share of the price', async ({ page }) => {
  await stubBill(page);
  await page.goto('/bills/bill-e2e');

  const row = page.getByRole('row', { name: /Hogar 50MB/ });
  await expect(row.getByText('proporcional')).toBeVisible();
  await expect(row.getByText(/60\.000/)).toBeVisible();
  await expect(row.getByText(/30\.000/)).toBeVisible();
});

test('a payment needs its method, and is recorded with its reference and date', async ({ page }) => {
  const pays = await stubBill(page);
  await page.goto('/bills/bill-e2e');

  await page.getByRole('button', { name: 'Registrar Pago' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Registrar pago', exact: true }).click();
  await expect(dialog.getByText('Indica cómo se pagó')).toBeVisible();
  expect(pays).toEqual([]);

  await selectDropdown(page, 'Medio de pago', 'Nequi', dialog);
  await field(dialog, 'Referencia').fill('  M123456  ');
  await field(dialog, 'Fecha de pago').fill('2026-10-05T09:30');
  await dialog.getByRole('button', { name: 'Registrar pago', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Pago' })).toBeVisible();
  await expect(page.getByText('M123456')).toBeVisible();
  expect(pays).toHaveLength(1);
  expect(pays[0]).toMatchObject({ method: 'NEQUI', reference: 'M123456' });
  expect(new Date(pays[0].paidAt as string).getTime()).toBe(new Date(2026, 9, 5, 9, 30).getTime());
});
