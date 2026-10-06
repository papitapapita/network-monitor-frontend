import { test as setup, expect } from '@playwright/test';
import { E2E } from '../playwright.config';
import { signIn } from './fixtures/twoFactor';

/**
 * Logs in through the real login form — password, then the two-factor code —
 * once per run and saves the resulting session: the `nms_session` cookie, and
 * `nms_user` in localStorage.
 *
 * Every other spec starts already authenticated, so no test pays the login
 * cost — and a failure here tells you the auth flow itself is broken.
 */
setup('authenticate', async ({ page }) => {
  await signIn(page, E2E.email, E2E.password);

  // Confirm the cookie actually landed, so we never save an empty session.
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === 'nms_session'), 'login did not set the nms_session cookie').toBe(true);

  await page.context().storageState({ path: E2E.storageState });
});

/**
 * The vendor's session, for the tests that exercise what only the vendor may
 * do (agent pairing, the data purge). Skipped without credentials — and so
 * are those tests.
 */
setup('authenticate vendor', async ({ page }) => {
  setup.skip(!E2E.vendorEmail || !E2E.vendorPassword, 'E2E_VENDOR_EMAIL / E2E_VENDOR_PASSWORD not set');

  await signIn(page, E2E.vendorEmail!, E2E.vendorPassword!);

  const user = await page.evaluate(() => JSON.parse(localStorage.getItem('nms_user') ?? 'null'));
  expect(user?.role, 'E2E_VENDOR_EMAIL is not the VENDOR account').toBe('VENDOR');

  await page.context().storageState({ path: E2E.vendorStorageState });
});
