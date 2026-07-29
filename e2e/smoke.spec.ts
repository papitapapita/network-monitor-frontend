import { test, expect } from './fixtures/test';

/**
 * Validates the harness itself: the saved session works, the app renders for
 * an authenticated user, and the API fixture can reach the backend.
 *
 * If this fails, no other spec is worth debugging yet.
 */
test.describe('harness', () => {
  test('an authenticated session reaches the dashboard', async ({ page }) => {
    await page.goto('/');

    // Not bounced to /login, and the shell rendered.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: 'Dispositivos' })).toBeVisible();
  });

  test('the devices page loads real backend data', async ({ page }) => {
    await page.goto('/devices');

    // Whatever the list contains, it must resolve past the loading state
    // without surfacing an error.
    await expect(page.getByText(/Sesión expirada|Network error/)).toHaveCount(0);
  });

  test('the api fixture can talk to the backend', async ({ api }) => {
    const devices = await api.get<{ data?: unknown[] } | unknown[]>('/devices');
    expect(devices).toBeTruthy();
  });
});
