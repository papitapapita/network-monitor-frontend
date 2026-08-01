import { test, expect, uniqueName } from './fixtures/test';
import { ApiClient } from './fixtures/api';
import { confirmDialog, field, idFromUrl, searchFor, selectCombobox } from './fixtures/helpers';

/**
 * A device needs a vendor + model, so every test arranges its own rather than
 * depending on whatever happens to be in the database.
 */
async function arrangeModel(api: ApiClient) {
  const vendor = await api.create<{ id: string; name: string }>('vendors', {
    name: uniqueName('vendor'),
    slug: uniqueName('vendor'),
  });
  const model = await api.create<{ id: string; model: string; deviceType: string }>('device-models', {
    vendorId: vendor.id,
    model: uniqueName('model'),
    deviceType: 'ROUTER',
    isWireless: false,
  });
  return { vendor, model };
}

async function arrangeDevice(api: ApiClient, overrides: Record<string, unknown> = {}) {
  const { vendor, model } = await arrangeModel(api);
  const device = await api.create<{ id: string; name: string }>('devices', {
    name: uniqueName('device'),
    deviceModelId: model.id,
    status: 'INVENTORY',
    ownerType: 'COMPANY',
    serialNumber: uniqueName('sn'),
    ...overrides,
  });
  return { vendor, model, device };
}

/**
 * A MAC belongs to at most one device, so a test about that rule needs one no
 * other record in the shared database already holds. `02` marks it locally
 * administered, which no real NIC hands out.
 */
function uniqueMac(): string {
  const octets = Array.from({ length: 5 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
  );
  return ['02', ...octets].join(':');
}

test.describe('devices', () => {
  test('creates a device and lands on its detail page', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const name = uniqueName('device');

    await page.goto('/devices/create');

    await field(page, 'Nombre').fill(name);
    await selectCombobox(page, 'Fabricante', vendor.name);
    // Model options render as "<model> (<TYPE>)".
    await selectCombobox(page, 'Modelo', `${model.model} (ROUTER)`);

    await field(page, 'Tipo de Propietario').selectOption({ label: 'Empresa' });
    // INVENTORY needs a serial number or MAC, enforced by the backend.
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await page.waitForURL(/\/devices\/[0-9a-f-]{36}$/);
    api.track('devices', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('shows an existing device on its detail page', async ({ page, api }) => {
    const { device } = await arrangeDevice(api, { ipAddress: '192.168.77.10' });

    await page.goto(`/devices/${device.id}`);

    await expect(page.getByRole('heading', { name: device.name })).toBeVisible();
    await expect(page.getByText('192.168.77.10').first()).toBeVisible();
  });

  test('lists devices and opens one from the row', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);

    await page.goto('/devices');
    await searchFor(page, device.name);

    const row = page.getByRole('row').filter({ hasText: device.name });
    await expect(row).toBeVisible();

    await row.click();
    await page.waitForURL(`**/devices/${device.id}`);
  });

  test('rejects a MAC that already belongs to another device, in Spanish', async ({ page, api }) => {
    const mac = uniqueMac();
    await arrangeDevice(api, { macAddress: mac });
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');

    await field(page, 'Nombre').fill(uniqueName('device'));
    await selectCombobox(page, 'Fabricante', vendor.name);
    await selectCombobox(page, 'Modelo', `${model.model} (ROUTER)`);
    await field(page, 'Tipo de Propietario').selectOption({ label: 'Empresa' });
    await field(page, 'Dirección MAC').fill(mac);

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    // The backend says "MAC address ... is already assigned to another device";
    // the operator must read it in the language the rest of the UI speaks.
    await expect(
      page.getByText(`La dirección MAC "${mac}" ya está asignada a otro dispositivo`).first()
    ).toBeVisible();
    await expect(page.getByText(/already assigned/)).toHaveCount(0);
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('rejects moving a taken MAC onto a device from its detail page', async ({ page, api }) => {
    const mac = uniqueMac();
    await arrangeDevice(api, { macAddress: mac });
    const { device } = await arrangeDevice(api);

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Editar' }).click();
    await field(page, 'Dirección MAC').fill(mac);
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();

    await expect(
      page.getByText(`La dirección MAC "${mac}" ya está asignada a otro dispositivo`).first()
    ).toBeVisible();
    await expect(page.getByText(/already assigned/)).toHaveCount(0);
  });

  test('deletes a device', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar dispositivo');

    await page.waitForURL('**/devices');
    api.untrack('devices', device.id);

    await searchFor(page, device.name);
    await expect(page.getByRole('row').filter({ hasText: device.name })).toHaveCount(0);
  });
});

test.describe('device credentials', () => {
  /** Opens a device's Credenciales tab. */
  async function openCredentials(page: import('@playwright/test').Page, deviceId: string) {
    await page.goto(`/devices/${deviceId}`);
    await page.getByRole('button', { name: 'Credenciales' }).click();
    await expect(page.getByText('Credenciales HTTP / API Web')).toBeVisible();
  }

  test('sets credentials on a device that has none', async ({ page, api }) => {
    const { device } = await arrangeDevice(api, { ipAddress: '192.168.77.11' });

    await openCredentials(page, device.id);

    // With no credentials stored the action reads "Configurar".
    await page.getByTestId('credentials-edit').click();

    await field(page, 'Usuario').fill('e2e-admin');
    await field(page, 'Contraseña').fill('e2e-secret');
    await field(page, 'Puerto HTTP').fill('8080');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    // Saved values are shown back, and the actions switch to Editar/Eliminar.
    // Test ids here because the page header carries its own "Eliminar".
    await expect(page.getByText('e2e-admin')).toBeVisible();
    await expect(page.getByTestId('credentials-edit')).toHaveText('Editar');
    await expect(page.getByTestId('credentials-delete')).toBeVisible();
  });

  test('reads back credentials after a reload', async ({ page, api }) => {
    const { device } = await arrangeDevice(api, { ipAddress: '192.168.77.12' });

    // Arrange through the API so this test only exercises the read path.
    await api.put(`/devices/${device.id}/credentials`, {
      httpUsername: 'e2e-reader',
      httpPassword: 'e2e-secret',
      httpPort: 8080,
    });

    await openCredentials(page, device.id);

    await expect(page.getByText('e2e-reader')).toBeVisible();
    await expect(page.getByText('8080')).toBeVisible();
  });

  test('deletes credentials', async ({ page, api }) => {
    const { device } = await arrangeDevice(api, { ipAddress: '192.168.77.13' });

    await api.put(`/devices/${device.id}/credentials`, {
      httpUsername: 'e2e-doomed',
      httpPassword: 'e2e-secret',
      httpPort: 8080,
    });

    await openCredentials(page, device.id);
    await expect(page.getByText('e2e-doomed')).toBeVisible();

    await page.getByTestId('credentials-delete').click();
    // This confirmation is inline, not a modal dialog.
    await expect(page.getByText(/¿Eliminar las credenciales/)).toBeVisible();
    await page.getByTestId('credentials-delete-confirm').click();

    await expect(page.getByText('e2e-doomed')).toHaveCount(0);
    await expect(page.getByTestId('credentials-edit')).toHaveText('Configurar');
  });
});
