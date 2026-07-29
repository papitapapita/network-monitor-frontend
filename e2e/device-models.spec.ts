import { test, expect, uniqueName } from './fixtures/test';
import { ApiClient } from './fixtures/api';
import { confirmDialog, field, idFromUrl, searchFor } from './fixtures/helpers';

/** Every model needs a vendor, so each test arranges its own. */
async function makeVendor(api: ApiClient) {
  return api.create<{ id: string; name: string }>('vendors', {
    name: uniqueName('vendor'),
    slug: uniqueName('vendor'),
  });
}

test.describe('device models', () => {
  test('creates a device model and lands on its detail page', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const model = uniqueName('model');

    await page.goto('/device-models/create');

    // Fabricante is a native <select> here (the device form uses a Combobox).
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    await field(page, 'Modelo').fill(model);
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });
    await field(page, 'Modelo inalámbrico').check();

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await page.waitForURL(/\/device-models\/[0-9a-f-]{36}$/);
    api.track('device-models', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name: `${vendor.name} — ${model}` })).toBeVisible();
    await expect(page.getByText('ROUTER').first()).toBeVisible();
  });

  test('shows an existing device model on its detail page', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const created = await api.create<{ id: string; model: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'SWITCH',
      isWireless: false,
    });

    await page.goto(`/device-models/${created.id}`);

    await expect(page.getByRole('heading', { name: `${vendor.name} — ${created.model}` })).toBeVisible();
    await expect(page.getByText('SWITCH').first()).toBeVisible();
  });

  test('lists device models and finds one by search', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const created = await api.create<{ id: string; model: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });

    await page.goto('/device-models');
    await searchFor(page, created.model);

    const row = page.getByRole('row').filter({ hasText: created.model });
    await expect(row).toBeVisible();

    await row.click();
    await page.waitForURL(`**/device-models/${created.id}`);
  });

  test('updates a device model', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const created = await api.create<{ id: string; model: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });
    const newModel = uniqueName('model-renamed');

    await page.goto(`/device-models/${created.id}`);
    await page.getByRole('button', { name: 'Editar' }).click();

    await field(page, 'Modelo').fill(newModel);
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Switch' });
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();

    await expect(page.getByRole('heading', { name: `${vendor.name} — ${newModel}` })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: `${vendor.name} — ${newModel}` })).toBeVisible();
    await expect(page.getByText('SWITCH').first()).toBeVisible();
  });

  test('deletes a device model', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const created = await api.create<{ id: string; model: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });

    await page.goto(`/device-models/${created.id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar modelo');

    await page.waitForURL('**/device-models');
    api.untrack('device-models', created.id);

    await searchFor(page, created.model);
    await expect(page.getByRole('row').filter({ hasText: created.model })).toHaveCount(0);
  });
});
