import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against a REAL running frontend and a REAL backend.
 * Nothing is mocked — these tests create and delete actual records.
 *
 * Override any of these with env vars:
 *   E2E_BASE_URL   frontend under test   (default http://localhost:3001)
 *   E2E_API_URL    backend API root      (default http://localhost:3000/api)
 *   E2E_EMAIL      login user            (default admin@example.com)
 *   E2E_PASSWORD   login password        (default changeme)
 */
export const E2E = {
  baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
  apiURL: process.env.E2E_API_URL ?? 'http://localhost:3000/api',
  email: process.env.E2E_EMAIL ?? 'admin@example.com',
  password: process.env.E2E_PASSWORD ?? 'changeme',
  storageState: 'e2e/.auth/state.json',
};

export default defineConfig({
  testDir: './e2e',
  // colombia.spec.ts is an ad-hoc debugging script, not a real test.
  testIgnore: ['**/colombia.spec.ts'],

  // Tests share one backend database, so they must not race each other.
  // Keep this serial unless every spec is provably isolated.
  fullyParallel: false,
  workers: 1,

  // Never let a stray .only sneak into CI.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  // The backend rate-limits writes (20 per 60s window) and the whole suite runs
  // serially through one of those windows, so a write-heavy test can spend most
  // of a minute inside ApiClient's 429 backoff before it does anything. That
  // wait counts against the test timeout, hence the headroom.
  timeout: 120_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: E2E.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },

  projects: [
    // Logs in once, saves the session, and every other project reuses it.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: E2E.storageState },
      dependencies: ['setup'],
    },
  ],

  // Starts `npm run dev` only if nothing is already serving on the port.
  webServer: {
    command: 'npm run dev',
    url: E2E.baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
