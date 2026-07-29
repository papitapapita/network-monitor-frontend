import { test, expect, uniqueName } from './fixtures/test';
import { confirmDialog, field, idFromUrl, searchFor } from './fixtures/helpers';

/**
 * Vendors: Create, Get, List, Update, Delete — all driven through the UI
 * against the real backend.
 */
test.describe('vendors', () => {
  test('creates a vendor and lands on its detail page', async ({ page, api }) => {
    const name = uniqueName('vendor');

    await page.goto('/vendors/create');
    await field(page, 'Nombre').fill(name);

    // The slug auto-derives from the name; uniqueName() is already slug-safe.
    await expect(field(page, 'Slug')).toHaveValue(name);

    await page.locator('textarea[name="description"]').fill('Created by an E2E test.');
    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    await page.waitForURL(/\/vendors\/[0-9a-f-]{36}$/);
    api.track('vendors', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('shows an existing vendor on its detail page', async ({ page, api }) => {
    const vendor = await api.create<{ id: string; name: string; slug: string }>('vendors', {
      name: uniqueName('vendor'),
      slug: uniqueName('vendor'),
      description: 'Arranged by an E2E test.',
    });

    await page.goto(`/vendors/${vendor.id}`);

    await expect(page.getByRole('heading', { name: vendor.name })).toBeVisible();
    // The slug renders twice (page header and the info card), hence .first().
    await expect(page.getByText(vendor.slug).first()).toBeVisible();
  });

  test('lists vendors and finds one by search', async ({ page, api }) => {
    const vendor = await api.create<{ id: string; name: string }>('vendors', {
      name: uniqueName('vendor'),
      slug: uniqueName('vendor'),
    });

    await page.goto('/vendors');
    await searchFor(page, vendor.name);

    const row = page.getByRole('row').filter({ hasText: vendor.name });
    await expect(row).toBeVisible();

    // The row navigates to the detail page.
    await row.click();
    await page.waitForURL(`**/vendors/${vendor.id}`);
  });

  test('updates a vendor name', async ({ page, api }) => {
    const vendor = await api.create<{ id: string; name: string }>('vendors', {
      name: uniqueName('vendor'),
      slug: uniqueName('vendor'),
    });
    const newName = uniqueName('vendor-renamed');

    await page.goto(`/vendors/${vendor.id}`);
    await page.getByRole('button', { name: 'Editar' }).click();

    await field(page, 'Nombre').fill(newName);
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible();

    // Survives a reload — i.e. it really persisted, not just local state.
    await page.reload();
    await expect(page.getByRole('heading', { name: newName })).toBeVisible();
  });

  test('deletes a vendor', async ({ page, api }) => {
    const vendor = await api.create<{ id: string; name: string }>('vendors', {
      name: uniqueName('vendor'),
      slug: uniqueName('vendor'),
    });

    await page.goto(`/vendors/${vendor.id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar fabricante');

    // Deleting redirects back to the list.
    await page.waitForURL('**/vendors');
    api.untrack('vendors', vendor.id);

    await searchFor(page, vendor.name);
    await expect(page.getByRole('row').filter({ hasText: vendor.name })).toHaveCount(0);
  });
});

/**
 * Vendor conventions (see BACKEND_API.md, DEV-001..DEV-006).
 *
 * "Accepts" tests submit values right at a rule's edge and confirm the real
 * backend created the record — proving the frontend's understanding of the
 * rule matches the backend's, not just that the form's own JS agrees with
 * itself.
 *
 * "Rejects" tests are split by where the rejection actually happens:
 *   - DEV-001, DEV-002, DEV-004, DEV-006 are pre-validated by the form's own
 *     `validate()` before any request is sent, so those tests are only
 *     proving the client-side guard fires correctly with real DOM
 *     interaction — no request reaches the backend, same as clicking through
 *     the app by hand would.
 *   - DEV-003 and DEV-005 are enforced by the backend only, so submitting
 *     always makes a real request; these tests only pass if the backend
 *     rejected it AND the frontend correctly relayed and translated the
 *     real response.
 */
test.describe('vendor conventions', () => {
  test('DEV-001: accepts a name at the 100-character limit', async ({ page, api }) => {
    const name = uniqueName('vendor').padEnd(100, 'x');
    expect(name).toHaveLength(100);

    await page.goto('/vendors/create');
    await field(page, 'Nombre').fill(name);
    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    await page.waitForURL(/\/vendors\/[0-9a-f-]{36}$/);
    api.track('vendors', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('DEV-002: accepts a slug with multiple hyphenated segments', async ({ page, api }) => {
    const name = uniqueName('vendor');
    const slug = `acme-networks-${uniqueName('slug')}`;
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

    await page.goto('/vendors/create');
    await field(page, 'Nombre').fill(name);
    await field(page, 'Slug').fill(slug); // manual edit overrides the auto-derived slug
    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    await page.waitForURL(/\/vendors\/[0-9a-f-]{36}$/);
    api.track('vendors', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText(slug).first()).toBeVisible();
  });

  test('DEV-004: accepts a description at the 500-character limit', async ({ page, api }) => {
    const name = uniqueName('vendor');
    const description = uniqueName('desc').padEnd(500, 'x');
    expect(description).toHaveLength(500);

    await page.goto('/vendors/create');
    await field(page, 'Nombre').fill(name);
    await page.locator('textarea[name="description"]').fill(description);
    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    await page.waitForURL(/\/vendors\/[0-9a-f-]{36}$/);
    api.track('vendors', idFromUrl(page.url()));

    // Confirms the backend stored and returned the description whole — not
    // truncated somewhere along the round trip.
    await expect(page.getByText(description)).toBeVisible();
  });

  test('DEV-001: rejects a blank name', async ({ page }) => {
    await page.goto('/vendors/create');

    // Give the slug a valid value so only the name check can fire. Also
    // forces Playwright to wait out hydration before the evaluate() below,
    // so it doesn't race the initial render.
    await field(page, 'Slug').fill(uniqueName('vendor'));

    // The <input> also carries an HTML `required` attribute, which makes the
    // browser's own constraint validation block the click before our onSubmit
    // handler — and therefore validate() — ever runs. Strip it so this test
    // exercises the JS required-check itself, not the browser's native one.
    await page.evaluate(() => document.querySelector('input[name="name"]')?.removeAttribute('required'));

    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    await expect(page.getByText('El nombre es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/vendors\/create$/);
  });

  test('DEV-001: rejects a name over the 100-character limit', async ({ page }) => {
    await page.goto('/vendors/create');

    // The <input> also carries an HTML maxlength=100, which would silently
    // truncate anything typed past the limit before validate() ever saw it
    // (confirmed: Playwright's fill() honours maxlength like real typing).
    // Strip it so this test exercises the JS length check itself.
    await page.evaluate(() => document.querySelector('input[name="name"]')?.removeAttribute('maxlength'));

    await field(page, 'Nombre').fill(uniqueName('vendor').padEnd(101, 'x'));
    await field(page, 'Slug').fill(uniqueName('vendor'));
    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    await expect(page.getByText('El nombre no puede superar los 100 caracteres')).toBeVisible();
    await expect(page).toHaveURL(/\/vendors\/create$/);
  });

  test('DEV-002: rejects a slug with invalid characters', async ({ page }) => {
    await page.goto('/vendors/create');
    await field(page, 'Nombre').fill(uniqueName('vendor'));
    await field(page, 'Slug').fill('TP_Link'); // uppercase + underscore both violate the pattern

    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    await expect(page.getByText('Solo minúsculas, números y guiones (ej: tp-link)')).toBeVisible();
    await expect(page).toHaveURL(/\/vendors\/create$/);
  });

  test('DEV-004: rejects a description over the 500-character limit', async ({ page }) => {
    await page.goto('/vendors/create');
    await field(page, 'Nombre').fill(uniqueName('vendor'));

    // Same maxlength truncation issue as the name field above.
    await page.evaluate(() => document.querySelector('textarea[name="description"]')?.removeAttribute('maxlength'));
    await page.locator('textarea[name="description"]').fill('x'.repeat(501));

    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    await expect(page.getByText('La descripción no puede superar los 500 caracteres')).toBeVisible();
    await expect(page).toHaveURL(/\/vendors\/create$/);
  });

  test('DEV-006: rejects a blank slug', async ({ page }) => {
    await page.goto('/vendors/create');
    await field(page, 'Nombre').fill(uniqueName('vendor'));

    // Same native `required` short-circuit as the blank-name test above.
    await page.evaluate(() => document.querySelector('input[name="slug"]')?.removeAttribute('required'));
    await field(page, 'Slug').fill(''); // clears the auto-derived value

    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    await expect(page.getByText('El slug es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/vendors\/create$/);
  });

  test('DEV-003: rejects a slug that already belongs to another vendor', async ({ page, api }) => {
    const existing = await api.create<{ id: string; slug: string }>('vendors', {
      name: uniqueName('vendor'),
      slug: uniqueName('vendor'),
    });

    await page.goto('/vendors/create');
    await field(page, 'Nombre').fill(uniqueName('vendor'));
    await field(page, 'Slug').fill(existing.slug); // manual edit forces the collision

    await page.getByRole('button', { name: 'Crear Fabricante' }).click();

    // Nothing client-side knows about this collision, so this only passes if
    // the request reached the backend and the response came back translated.
    await expect(page.getByText(`Ya existe un fabricante con el slug "${existing.slug}"`)).toBeVisible();
    await expect(page).toHaveURL(/\/vendors\/create$/);
  });

  test('DEV-005: refuses to delete a vendor that has device models', async ({ page, api }) => {
    const vendor = await api.create<{ id: string; name: string }>('vendors', {
      name: uniqueName('vendor'),
      slug: uniqueName('vendor'),
    });
    await api.create('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });

    await page.goto(`/vendors/${vendor.id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar fabricante');

    // The backend's own count is what's on screen, so the vendor stays put.
    await expect(page.getByText(/No se puede eliminar el fabricante: tiene 1 modelo de dispositivo asociado/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/vendors/${vendor.id}$`));
    await expect(page.getByRole('heading', { name: vendor.name })).toBeVisible();
  });
});
