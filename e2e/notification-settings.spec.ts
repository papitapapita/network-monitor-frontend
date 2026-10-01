import { test, expect } from './fixtures/test';
import type { Page, Request } from '@playwright/test';
import { field } from './fixtures/helpers';

/**
 * The install's notification settings (NOT-200). A save changes where every
 * real alert goes and a test message reaches a real chat, so the writes are
 * answered here; the read is answered too, so the form starts from known
 * values.
 */

const SAVED = { telegramChatId: '-1001234567890', downAlertDelayMinutes: 15, wirelessAlertsEnabled: true };

const ok = (data: unknown) => ({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
const fail = (status: number, error: string) =>
  ({ status, contentType: 'application/json', body: JSON.stringify({ success: false, error }) });

/** Answers the settings routes; returns what each write sent. */
async function stubSettings(page: Page, test: (body: { telegramChatId?: string }) => object = (b) => ok({ telegramChatId: b.telegramChatId ?? SAVED.telegramChatId })) {
  const writes: { saves: unknown[]; tests: unknown[] } = { saves: [], tests: [] };
  await page.route(/\/api\/notification-settings$/, async (route) => {
    const req: Request = route.request();
    if (req.method() === 'GET') return route.fulfill(ok(SAVED));
    const body = req.postDataJSON();
    writes.saves.push(body);
    return route.fulfill(ok(body));
  });
  await page.route(/\/api\/notification-settings\/test$/, async (route) => {
    const body = route.request().postDataJSON();
    writes.tests.push(body);
    return route.fulfill(test(body));
  });
  return writes;
}

async function withSubscription(page: Page, state: object) {
  await page.route(/\/api\/subscription$/, (route) => route.fulfill(ok(state)));
}

test('an administrator saves all three settings at once', async ({ page }) => {
  const writes = await stubSettings(page);
  await page.goto('/settings');

  const delay = field(page, 'Retraso de alerta de caída (minutos)');
  await expect(delay).toHaveValue('15');
  await delay.fill('30');
  await page.getByRole('checkbox', { name: 'Enviar alertas inalámbricas' }).uncheck();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(page.getByText(/Configuración de notificaciones guardada/)).toBeVisible();
  expect(writes.saves).toEqual([{ telegramChatId: '-1001234567890', downAlertDelayMinutes: 30, wirelessAlertsEnabled: false }]);
});

test('a bad chat id or delay is caught before it is sent', async ({ page }) => {
  const writes = await stubSettings(page);
  await page.goto('/settings');

  await field(page, 'Chat de Telegram').fill('mi grupo');
  await field(page, 'Retraso de alerta de caída (minutos)').fill('2000');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(page.getByText(/id numérico de chat/)).toBeVisible();
  await expect(page.getByText(/entre 0 y 1440/)).toBeVisible();
  expect(writes.saves).toEqual([]);
});

test('clearing the chat asks first, because alerts stop reaching anyone', async ({ page }) => {
  const writes = await stubSettings(page);
  await page.goto('/settings');

  await field(page, 'Chat de Telegram').fill('');
  await expect(page.getByText('Sin chat configurado: las alertas no le llegan a nadie.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar sin chat' }).click();

  await expect(page.getByText(/Configuración de notificaciones guardada/)).toBeVisible();
  expect(writes.saves).toEqual([{ ...SAVED, telegramChatId: null }]);
});

test('the test message goes to the chat as typed, and Telegram’s refusal is shown', async ({ page }) => {
  let refuse = false;
  const writes = await stubSettings(page, (body) =>
    refuse
      ? fail(502, 'Test message not delivered: Telegram API error: Bad Request: chat not found')
      : ok({ telegramChatId: body.telegramChatId }));
  await page.goto('/settings');

  await field(page, 'Chat de Telegram').fill('@alertas_red');
  await page.getByRole('button', { name: 'Enviar mensaje de prueba' }).click();
  await expect(page.getByText('Mensaje de prueba enviado a @alertas_red.')).toBeVisible();

  refuse = true;
  await page.getByRole('button', { name: 'Enviar mensaje de prueba' }).click();
  await expect(page.getByText(/chat not found/)).toBeVisible();

  expect(writes.tests).toEqual([{ telegramChatId: '@alertas_red' }, { telegramChatId: '@alertas_red' }]);
  // Testing is not saving.
  expect(writes.saves).toEqual([]);
});

test('read-only: the settings show, but nothing changes them', async ({ page }) => {
  await stubSettings(page);
  await withSubscription(page, { state: 'READ_ONLY', paidThrough: null, graceEndsAt: null, lockedAt: null, readOnly: true, locked: false });
  await page.goto('/settings');

  await expect(field(page, 'Chat de Telegram')).toHaveValue('-1001234567890');
  await expect(field(page, 'Chat de Telegram')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Enviar mensaje de prueba' })).toHaveCount(0);
  await expect(page.getByText('Solo un administrador puede cambiarlos.')).toBeVisible();
});

test('a device with no delay of its own shows the install’s', async ({ page, api }) => {
  const { devices } = await api.get<{ devices: Array<{ id: string }> }>('devices?limit=1');
  test.skip(devices.length === 0, 'no device to open');
  await stubSettings(page);
  await page.route(/\/api\/devices\/[^/]+\/notification-policy$/, (route) =>
    route.fulfill(ok({ deviceId: devices[0].id, quietHoursStart: null, quietHoursEnd: null, alertDelayMinutes: null, updatedAt: null })));

  await page.goto(`/devices/${devices[0].id}`);
  await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
  await expect(page.getByText('15 min (de la instalación)')).toBeVisible();
});
