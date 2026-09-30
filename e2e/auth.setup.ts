import { test as setup, expect } from '@playwright/test';
import { E2E } from '../playwright.config';
import { field } from './fixtures/helpers';

/**
 * Logs in through the real login form once per run and saves the resulting
 * session (the app keeps its JWT in localStorage under `nms_token`).
 *
 * Every other spec starts already authenticated, so no test pays the login
 * cost — and a failure here tells you the auth flow itself is broken.
 */
setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  // field() anchors the label, so the "Mostrar contraseña" toggle beside the
  // input does not match too.
  await field(page, 'Correo electrónico').fill(E2E.email);
  await field(page, 'Contraseña').fill(E2E.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  // The app redirects to the dashboard on success.
  await page.waitForURL(`${E2E.baseURL}/`);

  // Confirm the token actually landed, so we never save an empty session.
  const token = await page.evaluate(() => localStorage.getItem('nms_token'));
  expect(token, 'login did not store nms_token').toBeTruthy();

  await page.context().storageState({ path: E2E.storageState });
});

/**
 * The vendor's session, for the tests that exercise what only the vendor may
 * do (agent pairing, the data purge). Skipped without credentials — and so
 * are those tests.
 */
setup('authenticate vendor', async ({ page }) => {
  setup.skip(!E2E.vendorEmail || !E2E.vendorPassword, 'E2E_VENDOR_EMAIL / E2E_VENDOR_PASSWORD not set');

  await page.goto('/login');
  await field(page, 'Correo electrónico').fill(E2E.vendorEmail!);
  await field(page, 'Contraseña').fill(E2E.vendorPassword!);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL(`${E2E.baseURL}/`);

  const user = await page.evaluate(() => JSON.parse(localStorage.getItem('nms_user') ?? 'null'));
  expect(user?.role, 'E2E_VENDOR_EMAIL is not the VENDOR account').toBe('VENDOR');

  await page.context().storageState({ path: E2E.vendorStorageState });
});
