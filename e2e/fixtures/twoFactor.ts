import { Page, expect } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { generateSync } from 'otplib';
import { E2E } from '../../playwright.config';
import { field } from './helpers';

/**
 * Signing in takes a code from an authenticator app (IDN-166), so the e2e run
 * plays the app. The first run against an account that never set two-factor
 * up does the setup through the UI and keeps the secret here; later runs read
 * it back. `E2E_TOTP_SECRET` / `E2E_VENDOR_TOTP_SECRET` override the file for
 * accounts set up by hand.
 *
 * If the file is lost after setup, reset the account's two-factor from
 * /users (or the backend) and the next run sets it up again.
 */
const SECRETS_FILE = 'e2e/.auth/totp.json';
const PERIOD_MS = 30_000;

interface StoredSecret {
  secret: string;
  recoveryCodes: string[];
  /** The 30-second step of the last code sent; the backend refuses a code twice. */
  lastStep?: number;
}

function readSecrets(): Record<string, StoredSecret> {
  if (!existsSync(SECRETS_FILE)) return {};
  return JSON.parse(readFileSync(SECRETS_FILE, 'utf-8'));
}

function writeSecret(email: string, entry: StoredSecret) {
  const all = readSecrets();
  all[email] = entry;
  mkdirSync(dirname(SECRETS_FILE), { recursive: true });
  writeFileSync(SECRETS_FILE, JSON.stringify(all, null, 2));
}

function envSecret(email: string): string | null {
  if (email === E2E.email) return process.env.E2E_TOTP_SECRET ?? null;
  if (email === E2E.vendorEmail) return process.env.E2E_VENDOR_TOTP_SECRET ?? null;
  return null;
}

/** A code for the current step — waiting out the step when the last run already spent it. */
async function freshCode(page: Page, email: string, secret: string): Promise<string> {
  const stored = readSecrets()[email];
  let step = Math.floor(Date.now() / PERIOD_MS);
  if (stored?.lastStep !== undefined && stored.lastStep >= step) {
    await page.waitForTimeout((step + 1) * PERIOD_MS - Date.now() + 500);
    step = Math.floor(Date.now() / PERIOD_MS);
  }
  writeSecret(email, { secret, recoveryCodes: stored?.recoveryCodes ?? [], lastStep: step });
  return generateSync({ secret });
}

/** Signs in through the real login form, through whichever two-factor step the account is at. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  // field() anchors the label, so the "Mostrar contraseña" toggle beside the
  // input does not match too.
  await field(page, 'Correo electrónico').fill(email);
  await field(page, 'Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  const setupHeading = page.getByRole('heading', { name: 'Configura la verificación en dos pasos' });
  const verifyHeading = page.getByRole('heading', { name: 'Verificación en dos pasos' });
  await expect(setupHeading.or(verifyHeading)).toBeVisible();

  if (await setupHeading.isVisible()) {
    await page.getByRole('button', { name: '¿No puedes escanear? Escribe la clave' }).click();
    const secret = (await page.locator('code').first().textContent())?.trim();
    expect(secret, 'setup did not show the secret').toBeTruthy();
    writeSecret(email, { secret: secret!, recoveryCodes: [] });

    await field(page, 'Código de verificación').fill(await freshCode(page, email, secret!));

    const codes = await page.getByRole('list', { name: 'Códigos de recuperación' }).getByRole('listitem').allTextContents();
    writeSecret(email, { ...readSecrets()[email], recoveryCodes: codes });
    await page.getByText('Guardé estos códigos').click();
    await page.getByRole('button', { name: 'Continuar' }).click();
  } else {
    const secret = envSecret(email) ?? readSecrets()[email]?.secret;
    if (!secret) {
      throw new Error(
        `${email} already has two-factor on, but there is no secret for it in ${SECRETS_FILE} or the env. ` +
          'Reset its two-factor (POST /api/users/:id/two-factor/reset) and run again.',
      );
    }
    await field(page, 'Código de verificación').fill(await freshCode(page, email, secret));
  }

  await page.waitForURL(`${E2E.baseURL}/`);
}
