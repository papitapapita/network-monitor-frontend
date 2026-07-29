import { test, expect, uniqueName } from './fixtures/test';
import { confirmDialog, field, idFromUrl, searchFor } from './fixtures/helpers';

/** Villavicencio-ish, so created pins land somewhere plausible on the map. */
const LAT = 4.132689;
const LON = -73.625153;

test.describe('locations', () => {
  test('deletes a location from the list', async ({ page, api }) => {
    const loc = await api.create<{ id: string; name: string }>('locations', {
      name: uniqueName('loc'),
      type: 'TOWER',
    });

    await page.goto('/locations');
    await searchFor(page, loc.name);

    const row = page.getByRole('row').filter({ hasText: loc.name });
    await expect(row).toBeVisible();
    await row.getByRole('checkbox').click();

    await page.getByRole('button', { name: 'Eliminar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();

    await expect(page.getByRole('row').filter({ hasText: loc.name })).toHaveCount(0);
    api.untrack('locations', loc.id);
  });

  test('surfaces the 409 when the location still has devices', async ({ page, api }) => {
    const vendor = await api.create<{ id: string }>('vendors', {
      name: uniqueName('vendor'),
      slug: uniqueName('vendor'),
    });
    const model = await api.create<{ id: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });
    const loc = await api.create<{ id: string; name: string }>('locations', {
      name: uniqueName('loc'),
      type: 'TOWER',
    });
    await api.create<{ id: string }>('devices', {
      name: uniqueName('dev'),
      deviceModelId: model.id,
      locationId: loc.id,
      status: 'INVENTORY',
      ownerType: 'COMPANY',
      serialNumber: uniqueName('sn'),
    });

    await page.goto('/locations');
    await searchFor(page, loc.name);

    const row = page.getByRole('row').filter({ hasText: loc.name });
    await expect(row).toBeVisible();
    await row.getByRole('checkbox').click();

    await page.getByRole('button', { name: 'Eliminar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();

    // The whole point of the fix: the failure is reported instead of vanishing.
    await expect(page.getByRole('alert').filter({ hasText: /Cannot delete|No se puede/ })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: loc.name })).toBeVisible();
  });

  test('creates a location from the create page', async ({ page, api }) => {
    const name = uniqueName('location');

    await page.goto('/locations');
    await page.getByRole('button', { name: 'Agregar Ubicación' }).click();
    await page.waitForURL('**/locations/create');

    await field(page, 'Nombre').fill(name);
    await field(page, 'Tipo').selectOption({ label: 'Torre' });
    // The backend rejects a partial address, so all three parts go together.
    await field(page, 'Dirección').fill('Calle 1 # 2-3');
    await field(page, 'Municipio').fill('Villavicencio');
    await field(page, 'Barrio').fill('Centro');
    await field(page, 'Latitud').fill(String(LAT));
    await field(page, 'Longitud').fill(String(LON));

    await page.getByRole('button', { name: 'Crear Ubicación' }).click();

    await page.waitForURL(/\/locations\/[0-9a-f-]{36}$/);
    api.track('locations', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('shows an existing location on its detail page', async ({ page, api }) => {
    const loc = await api.create<{ id: string; name: string }>('locations', {
      name: uniqueName('loc'),
      type: 'DATACENTER',
      // The backend requires street + municipality + neighborhood together.
      address: 'Calle 1 # 2-3',
      municipality: 'Villavicencio',
      neighborhood: 'Centro',
      latitude: LAT,
      longitude: LON,
    });

    await page.goto(`/locations/${loc.id}`);

    await expect(page.getByRole('heading', { name: loc.name })).toBeVisible();
    await expect(page.getByText('Villavicencio').first()).toBeVisible();
  });

  test('lists locations and opens one from the row', async ({ page, api }) => {
    const loc = await api.create<{ id: string; name: string }>('locations', {
      name: uniqueName('loc'),
      type: 'OFFICE',
    });

    await page.goto('/locations');
    await searchFor(page, loc.name);

    const row = page.getByRole('row').filter({ hasText: loc.name });
    await expect(row).toBeVisible();

    await row.click();
    await page.waitForURL(`**/locations/${loc.id}`);
  });

  test('updates a location from its detail page', async ({ page, api }) => {
    const loc = await api.create<{ id: string; name: string }>('locations', {
      name: uniqueName('loc'),
      type: 'OFFICE',
    });
    const newName = uniqueName('loc-renamed');

    await page.goto(`/locations/${loc.id}`);
    await page.getByRole('button', { name: 'Editar' }).click();

    await expect(page.getByText('Editar Ubicación')).toBeVisible();
    await field(page, 'Nombre').fill(newName);
    await field(page, 'Tipo').selectOption({ label: 'Torre' });
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible();

    // Survives a reload — i.e. it really persisted.
    await page.reload();
    await expect(page.getByRole('heading', { name: newName })).toBeVisible();
  });

  test('deletes a location from its detail page', async ({ page, api }) => {
    const loc = await api.create<{ id: string; name: string }>('locations', {
      name: uniqueName('loc'),
      type: 'OTHER',
    });

    await page.goto(`/locations/${loc.id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar ubicación');

    await page.waitForURL('**/locations');
    api.untrack('locations', loc.id);

    await searchFor(page, loc.name);
    await expect(page.getByRole('row').filter({ hasText: loc.name })).toHaveCount(0);
  });

  test('shows located pins on the map', async ({ page, api }) => {
    const loc = await api.create<{ id: string; name: string }>('locations', {
      name: uniqueName('loc'),
      type: 'TOWER',
      latitude: LAT,
      longitude: LON,
    });

    await page.goto('/map');

    // Leaflet renders asynchronously.
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();

    // The map endpoint must include what we just created.
    const map = await api.get<{ total: number; pins: Array<{ id: string }> }>('/locations/map');
    expect(map.pins.some((p) => p.id === loc.id)).toBe(true);
  });
});
