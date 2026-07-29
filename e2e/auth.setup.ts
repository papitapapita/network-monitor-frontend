import { test as setup, expect } from '@playwright/test';
import { E2E } from '../playwright.config';

/**
 * Logs in through the real login form once per run and saves the resulting
 * session (the app keeps its JWT in localStorage under `nms_token`).
 *
 * Every other spec starts already authenticated, so no test pays the login
 * cost — and a failure here tells you the auth flow itself is broken.
 */
setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Correo electrónico').fill(E2E.email);
  await page.getByLabel('Contraseña').fill(E2E.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  // The app redirects to the dashboard on success.
  await page.waitForURL(`${E2E.baseURL}/`);

  // Confirm the token actually landed, so we never save an empty session.
  const token = await page.evaluate(() => localStorage.getItem('nms_token'));
  expect(token, 'login did not store nms_token').toBeTruthy();

  await page.context().storageState({ path: E2E.storageState });
});
