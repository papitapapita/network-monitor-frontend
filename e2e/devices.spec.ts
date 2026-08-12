import { Locator, Page } from '@playwright/test';
import { test, expect, uniqueName } from './fixtures/test';
import { ApiClient } from './fixtures/api';
import {
  captureCreate,
  confirmDialog,
  field,
  idFromUrl,
  pickFromCombobox,
  searchFor,
  selectCombobox,
} from './fixtures/helpers';

type Vendor = { id: string; name: string };
type Model = { id: string; model: string; deviceType: string };

/**
 * A device needs a vendor + model, so every test arranges its own rather than
 * depending on whatever happens to be in the database.
 */
async function arrangeModel(api: ApiClient, modelOverrides: Record<string, unknown> = {}) {
  const vendor = await api.create<Vendor>('vendors', {
    name: uniqueName('vendor'),
    slug: uniqueName('vendor'),
  });
  const model = await api.create<Model>('device-models', {
    vendorId: vendor.id,
    model: uniqueName('model'),
    deviceType: 'ROUTER',
    isWireless: false,
    ...modelOverrides,
  });
  return { vendor, model };
}

async function arrangeDevice(
  api: ApiClient,
  overrides: Record<string, unknown> = {},
  modelOverrides: Record<string, unknown> = {}
) {
  const { vendor, model } = await arrangeModel(api, modelOverrides);
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

/** An ACTIVE device needs somewhere to be (DEV-055), so tests about it arrange one. */
async function arrangeLocation(api: ApiClient) {
  return api.create<{ id: string; name: string }>('locations', {
    name: uniqueName('loc'),
    type: 'TOWER',
  });
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

/**
 * An IP belongs to at most one device too (DEV-049), so it needs the same
 * treatment as the MAC above. Drawn from 198.18/15, the benchmarking range —
 * it routes nowhere, so a device that ends up monitored pings into a void
 * rather than at somebody's equipment.
 */
function uniqueIp(): string {
  const octet = () => Math.floor(Math.random() * 256);
  return `198.18.${octet()}.${octet()}`;
}

/** Same idea for IPv6: the documentation prefix, which is likewise unroutable. */
function uniqueIpv6(): string {
  const group = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `2001:0db8:${group()}:${group()}::1`;
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

  test('DEV-047: rejects a MAC that already belongs to another device, in Spanish', async ({ page, api }) => {
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

  test('DEV-047: rejects moving a taken MAC onto a device from its detail page', async ({ page, api }) => {
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

  test('DEV-053: keeps an inventory device from losing its last identifier', async ({ page, api }) => {
    // The IP is the trap: an INVENTORY device needs a serial number or a MAC
    // whatever else it holds, and the backend states that rule in English.
    const { device } = await arrangeDevice(api, { ipAddress: '192.168.77.20' });

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Editar' }).click();
    await field(page, 'Número de Serie').fill('');
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();

    await expect(page.getByText('Se requiere número de serie o dirección MAC')).toBeVisible();
    await expect(page.getByText(/must have at least a serial number/)).toHaveCount(0);

    // A MAC answers the same rule, so filling one clears the complaint.
    await field(page, 'Dirección MAC').fill(uniqueMac());
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();
    await expect(page.getByText('Se requiere número de serie o dirección MAC')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
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

test.describe('devices table columns', () => {
  /** Opens the "Columnas" dropdown and toggles one entry. */
  async function toggleColumn(page: import('@playwright/test').Page, label: string) {
    await page.getByRole('button', { name: 'Columnas' }).click();
    await page.getByRole('menuitemcheckbox', { name: label, exact: true }).click();
    await page.keyboard.press('Escape');
  }

  test('adds an optional column and sorts by it', async ({ page, api }) => {
    const mac = uniqueMac();
    const { device } = await arrangeDevice(api, { macAddress: mac });

    await page.goto('/devices');
    await expect(page.getByRole('columnheader', { name: 'Dirección MAC' })).toHaveCount(0);

    await toggleColumn(page, 'Dirección MAC');

    await expect(page.getByRole('columnheader', { name: 'Dirección MAC' })).toBeVisible();
    await searchFor(page, device.name);
    await expect(page.getByRole('row').filter({ hasText: device.name })).toContainText(mac);

    // The added column sorts like any other: alphabetically on the first click,
    // reversed on the second.
    const macCells = page.locator('tbody tr td:last-child');
    await field(page, 'Buscar').fill('');
    await page.getByRole('columnheader', { name: 'Dirección MAC' }).click();
    const ascending = (await macCells.allInnerTexts()).filter((t) => t !== '—');
    expect(ascending).toEqual([...ascending].sort());

    await page.getByRole('columnheader', { name: 'Dirección MAC' }).click();
    const descending = (await macCells.allInnerTexts()).filter((t) => t !== '—');
    expect(descending).toEqual([...ascending].reverse());
  });

  test('remembers the chosen columns and restores the defaults', async ({ page }) => {
    await page.goto('/devices');
    await toggleColumn(page, 'Número de serie');
    await expect(page.getByRole('columnheader', { name: 'Número de serie' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('columnheader', { name: 'Número de serie' })).toBeVisible();

    await page.getByRole('button', { name: 'Columnas' }).click();
    await page.getByRole('menuitem', { name: 'Restablecer' }).click();
    await expect(page.getByRole('columnheader', { name: 'Número de serie' })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Nombre' })).toBeVisible();
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

// ── Device conventions (DEV-040..DEV-066) ──────────────────────────────────

/**
 * Reads a value out of the detail page's definition list by its label. Anchored
 * on both ends because several labels are prefixes of others ("Dirección IP" vs
 * "Dirección MAC", "Modelo" vs nothing else here, but the pattern holds).
 */
function detailValue(page: Page, label: string): Locator {
  return page
    .locator('dt')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd');
}

/** Fills the three fields every device needs; tests then add only their own. */
async function fillRequiredFields(
  page: Page,
  { vendor, model }: { vendor: Vendor; model: Model },
  name = uniqueName('device')
): Promise<string> {
  await field(page, 'Nombre').fill(name);
  await selectCombobox(page, 'Fabricante', vendor.name);
  // Model options render as "<model> (<TYPE>)".
  await selectCombobox(page, 'Modelo', `${model.model} (${model.deviceType})`);
  return name;
}

/**
 * Submits the create form, waits for the redirect and registers the new device
 * for cleanup — the API client never saw it, so it cannot know to delete it.
 *
 * What the detail page shows afterwards is a fresh read: the redirect mounts it
 * from scratch and it fetches the device by id, so a value asserted there came
 * back from the backend rather than from the form that sent it. No reload
 * needed — and each one costs three more reads against a rate-limited API.
 */
async function submitCreate(page: Page, api: ApiClient): Promise<string> {
  await page.getByRole('button', { name: 'Crear Dispositivo' }).click();
  await page.waitForURL(/\/devices\/[0-9a-f-]{36}$/);
  const id = idFromUrl(page.url());
  api.track('devices', id);
  return id;
}

/** The create form's location picker carries no label of its own. */
function locationPicker(page: Page): Locator {
  return page.getByPlaceholder('Escribir ubicación...');
}

/** Opens a device's detail page and puts the details tab into edit mode. */
async function openEdit(page: Page, deviceId: string): Promise<void> {
  await page.goto(`/devices/${deviceId}`);
  await page.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('heading', { name: 'Editar Dispositivo' })).toBeVisible();
}

async function saveEdit(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Guardar Cambios' }).click();
}

/**
 * Reads an option list's labels and the domain values behind them. Both come
 * off the DOM node rather than from `allInnerTexts()`, which is empty for the
 * options of a closed <select> — they have no layout to read text from.
 */
async function optionsOf(select: Locator): Promise<{ labels: string[]; values: string[] }> {
  // `evaluateAll` does not wait for anything, and the create form only renders
  // once its vendor/model/location options have loaded.
  await expect(select).toBeVisible();
  return select.locator('option').evaluateAll((els) => ({
    labels: els.map((el) => el.textContent?.trim() ?? ''),
    values: els.map((el) => (el as HTMLOptionElement).value),
  }));
}

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Device conventions (DEV-040..DEV-066).
 *
 * Same split as the vendor and device-model suites:
 *   - Most field rules (DEV-040..DEV-046, DEV-048, DEV-050..DEV-057) are caught
 *     by the form's own `validate()` before anything is sent, so those tests
 *     prove the client-side guard fires under real DOM interaction. Where a
 *     native `required` / `maxlength` / `max` would short-circuit the click
 *     first, the attribute is stripped so the JS check is what actually runs.
 *   - DEV-047, DEV-049, DEV-060 and DEV-066 are backend-enforced, so every one
 *     of those tests makes a real request and only passes if the backend
 *     rejected it AND the frontend relayed the real response in Spanish.
 *   - The rest are round trips: submit at the rule's edge, reload, and read back
 *     what the backend actually stored — which is the only way to see a default
 *     (DEV-042, DEV-058, DEV-059) or a normalisation (DEV-046, DEV-048) that
 *     belongs to the domain rather than to the form.
 *
 * DEV-061 (rows load without revalidation) has no test here on purpose: it can
 * only be observed by writing a row the backend itself refuses to write, so
 * nothing an operator can do through the UI reaches it.
 *
 * DEV-064 is superseded by WLS-003 and lives in the wireless book now.
 *
 * A note on reads: the backend allows 100 GETs per resource per minute, and a
 * dense serial run of this block gets within reach of that on `device-models`
 * (the create form, the detail page and the edit form each fetch one). The
 * browser does not retry a 429 the way `ApiClient` does — it just renders an
 * empty picker or drops the wireless tab — so tests here avoid reloading a page
 * that has already read what they are about to assert.
 */
test.describe('device conventions', () => {
  // ── DEV-040 — a device requires a model and a name ──────────────────────
  test('DEV-040: rejects a device with no name', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await selectCombobox(page, 'Fabricante', vendor.name);
    await selectCombobox(page, 'Modelo', `${model.model} (${model.deviceType})`);

    // The <input> carries a native `required`, which blocks the submit before
    // our onSubmit — and therefore validate() — ever runs. Strip it so this
    // exercises the JS required-check itself.
    await page.evaluate(() => document.querySelector('input[name="name"]')?.removeAttribute('required'));

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('El nombre es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-040: rejects a device with no vendor and no model', async ({ page }) => {
    await page.goto('/devices/create');
    // The vendor and model pickers are Comboboxes: their `required` is a visual
    // asterisk only, so validate() is what refuses this, with nothing stripped.
    await field(page, 'Nombre').fill(uniqueName('device'));

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('El fabricante es requerido')).toBeVisible();
    await expect(page.getByText('El modelo es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-040: rejects a device whose vendor is chosen but model is not', async ({ page, api }) => {
    const { vendor } = await arrangeModel(api);

    await page.goto('/devices/create');
    await field(page, 'Nombre').fill(uniqueName('device'));
    await selectCombobox(page, 'Fabricante', vendor.name);

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('El modelo es requerido')).toBeVisible();
    await expect(page.getByText('El fabricante es requerido')).toHaveCount(0);
  });

  test('DEV-040: refuses to clear the name of an existing device', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);

    await openEdit(page, device.id);
    await field(page, 'Nombre').fill('');
    await saveEdit(page);

    await expect(page.getByText('El nombre es requerido')).toBeVisible();

    // Nothing was sent, so the device keeps the name it had.
    await page.reload();
    await expect(page.getByRole('heading', { name: device.name })).toBeVisible();
  });

  test('DEV-040: accepts a device carrying nothing but a name, a model and a serial', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    const name = await fillRequiredFields(page, { vendor, model });
    // The serial is not DEV-040's doing — an INVENTORY device needs one
    // identifier or the other (DEV-053), and INVENTORY is the default.
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    await submitCreate(page, api);

    await expect(page.getByRole('heading', { name })).toBeVisible();

    // Everything else really was optional.
    await expect(detailValue(page, 'Dirección IP')).toHaveText('—');
    await expect(detailValue(page, 'Dirección MAC')).toHaveText('—');
    await expect(detailValue(page, 'Categoría')).toHaveText('—');
    await expect(detailValue(page, 'Ubicación')).toHaveText('—');
    await expect(detailValue(page, 'Fecha de Instalación')).toHaveText('—');
    await expect(detailValue(page, 'Descripción')).toHaveText('—');
  });

  // ── DEV-041 — a device name is non-empty and at most 150 characters ─────
  test('DEV-041: accepts a name at the 150-character limit', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const name = uniqueName('device').padEnd(150, 'x');
    expect(name).toHaveLength(150);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model }, name);
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    await submitCreate(page, api);

    // Confirms the backend stored the name whole, not truncated on the way.
    await expect(detailValue(page, 'Nombre')).toHaveText(name);
  });

  test('DEV-041: rejects a name over the 150-character limit', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });

    // The <input> carries maxlength=150, which would silently truncate anything
    // past the limit before validate() ever saw it. Strip it so the JS length
    // check is what runs.
    await page.evaluate(() => document.querySelector('input[name="name"]')?.removeAttribute('maxlength'));
    await field(page, 'Nombre').fill(uniqueName('device').padEnd(151, 'x'));

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('El nombre no puede superar los 150 caracteres')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-041: rejects a whitespace-only name', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    // Spaces satisfy the native `required`, so this reaches validate() as-is —
    // and it is the trim that rejects it.
    await field(page, 'Nombre').fill('   ');

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('El nombre es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-041: trims the surrounding whitespace off a name', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const name = uniqueName('device');

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model }, `   ${name}   `);
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    await submitCreate(page, api);

    await expect(detailValue(page, 'Nombre')).toHaveText(name);
  });

  // ── DEV-042 — four statuses, INVENTORY by default ───────────────────────
  test('DEV-042: offers exactly the five statuses, plus the default', async ({ page }) => {
    await page.goto('/devices/create');

    const { labels, values } = await optionsOf(field(page, 'Estado'));
    expect(labels).toEqual([
      'Por defecto (Inventario)',
      'Inventario',
      'Comisionamiento',
      'Activo',
      'Dañado',
      'Dado de baja',
    ]);
    // The labels are Spanish; what gets submitted must be the domain's set.
    expect(values).toEqual([
      '',
      'INVENTORY',
      'COMMISSIONING',
      'ACTIVE',
      'DAMAGED',
      'DECOMMISSIONED',
    ]);
  });

  test('DEV-042: a device created without a status lands in INVENTORY', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));
    // Left at "Por defecto (Inventario)", which sends no status at all.
    await expect(field(page, 'Estado')).toHaveValue('');

    await submitCreate(page, api);

    // The detail page read the device back, so this is the backend's default,
    // not the form's guess.
    await expect(detailValue(page, 'Estado')).toHaveText('Inventario');
  });

  test('DEV-042: round-trips a chosen status through the backend', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Estado').selectOption({ label: 'Dañado' });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    await submitCreate(page, api);

    await expect(detailValue(page, 'Estado')).toHaveText('Dañado');
  });

  // ── DEV-043 — an optional category, one of six deployment roles ─────────
  test('DEV-043: offers exactly the six categories, and none', async ({ page }) => {
    await page.goto('/devices/create');

    const { labels, values } = await optionsOf(field(page, 'Categoría'));
    expect(labels).toEqual([
      'Ninguna',
      'CPE (Cliente)',
      'CPE Inalámbrico',
      'Punto de Acceso',
      'Gateway (Salida a Internet)',
      'Switch de Agregación',
      'Otro',
    ]);
    expect(values).toEqual([
      '',
      'CPE',
      'WIRELESS_CPE',
      'ACCESS_POINT',
      'GATEWAY',
      'AGGREGATION_SWITCH',
      'OTHER',
    ]);
  });

  test('DEV-043: round-trips a category, and lets it be cleared again', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Categoría').selectOption({ label: 'Gateway (Salida a Internet)' });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    const id = await submitCreate(page, api);

    await expect(detailValue(page, 'Categoría')).toHaveText('Gateway (Salida a Internet)');

    // Nullable, so "Ninguna" is a legal end state — no wireless config exists
    // here to freeze it (DEV-065).
    await openEdit(page, id);
    await field(page, 'Categoría').selectOption({ label: 'Ninguna' });
    await saveEdit(page);

    await page.reload();
    await expect(detailValue(page, 'Categoría')).toHaveText('—');
  });

  // ── DEV-044 — an optional owner, COMPANY or CLIENT ──────────────────────
  test('DEV-044: offers exactly the two owner types on create and on edit', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);

    await page.goto('/devices/create');
    const create = await optionsOf(field(page, 'Tipo de Propietario'));
    expect(create.labels).toEqual(['Seleccionar tipo', 'Empresa', 'Cliente']);
    expect(create.values).toEqual(['', 'COMPANY', 'CLIENT']);

    await openEdit(page, device.id);
    const edit = await optionsOf(field(page, 'Tipo de Propietario'));
    expect(edit.labels).toEqual(create.labels);
    expect(edit.values).toEqual(create.values);
  });

  test('DEV-044: round-trips CLIENT', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Tipo de Propietario').selectOption({ label: 'Cliente' });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    await submitCreate(page, api);

    await expect(detailValue(page, 'Tipo de Propietario')).toHaveText('Cliente');
  });

  test('DEV-044: a device with no owner reads as having none', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));
    // Left at "Seleccionar tipo": the owner is optional, so nothing is sent.
    await expect(field(page, 'Tipo de Propietario')).toHaveValue('');

    const id = await submitCreate(page, api);

    // An absent owner is absent, not one of the two — naming either would be a
    // guess about who replaces the hardware when it fails.
    await expect(detailValue(page, 'Tipo de Propietario')).toHaveText('—');

    await openEdit(page, id);
    await expect(field(page, 'Tipo de Propietario')).toHaveValue('');
  });

  // ── DEV-045 — a serial number is non-empty and at most 100 characters ───
  test('DEV-045: accepts a serial number at the 100-character limit', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const serial = uniqueName('sn').padEnd(100, 'x');
    expect(serial).toHaveLength(100);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(serial);

    await submitCreate(page, api);

    await expect(detailValue(page, 'Número de Serie')).toHaveText(serial);
  });

  test('DEV-045: rejects a serial number over the 100-character limit', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });

    // Same maxlength truncation issue as the name field.
    await page.evaluate(() =>
      document.querySelector('input[name="serialNumber"]')?.removeAttribute('maxlength')
    );
    await field(page, 'Número de Serie').fill(uniqueName('sn').padEnd(101, 'x'));

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('El número de serie no puede superar los 100 caracteres')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-045: a whitespace-only serial number is no serial number at all', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill('    ');

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    // Trimmed to nothing, so the INVENTORY identifier rule is what answers.
    await expect(page.getByText('Se requiere número de serie o dirección MAC')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  // ── DEV-046 — a MAC address is colon or hyphen hex, normalised ──────────
  test('DEV-046: rejects a malformed MAC address', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));
    await field(page, 'Dirección MAC').fill('AA:BB:CC:DD:EE'); // five octets, not six

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('La dirección MAC no es válida (ej: AA:BB:CC:DD:EE:FF)')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-046: stores a hyphenated lower-case MAC as upper-case with colons', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const mac = uniqueMac();

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Dirección MAC').fill(mac.replace(/:/g, '-').toLowerCase());

    await submitCreate(page, api);

    // The normalisation is the domain's, so only a real round trip shows it —
    // and it is what makes DEV-047 meaningful: two spellings, one stored value.
    await expect(detailValue(page, 'Dirección MAC')).toHaveText(mac);
  });

  // ── DEV-047 — a MAC belongs to at most one device ───────────────────────
  // (The two refusals live in the 'devices' block above.)
  test('DEV-047: re-submitting a device its own MAC is not a collision', async ({ page, api }) => {
    const mac = uniqueMac();
    const { device } = await arrangeDevice(api, { macAddress: mac });

    await openEdit(page, device.id);
    await field(page, 'Dirección MAC').fill(mac);
    await saveEdit(page);

    // The save went through: the form closed and nothing was reported.
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(page.getByText(/ya está asignada a otro dispositivo/)).toHaveCount(0);
    await expect(detailValue(page, 'Dirección MAC')).toHaveText(mac);
  });

  // ── DEV-048 — an IP address is a valid IPv4 or IPv6 address ─────────────
  test('DEV-048: rejects an out-of-range IPv4 address', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));
    await field(page, 'Dirección IP').fill('999.1.1.1');

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('La dirección IP no es válida')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-048: accepts an IPv6 address and stores it lower-cased', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const ipv6 = uniqueIpv6();

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));
    await field(page, 'Dirección IP').fill(ipv6.toUpperCase());

    await submitCreate(page, api);

    await expect(detailValue(page, 'Dirección IP')).toHaveText(ipv6);
  });

  // ── DEV-049 — an IP belongs to at most one device ───────────────────────
  test('DEV-049: rejects an IP that already belongs to another device, in Spanish', async ({ page, api }) => {
    const ip = uniqueIp();
    await arrangeDevice(api, { ipAddress: ip });
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));
    await field(page, 'Dirección IP').fill(ip);

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    // Nothing client-side knows about this collision, so this only passes if the
    // request reached the backend and the response came back translated — twice
    // over: in the banner, and under the input that has to change.
    const taken = page.getByText(`La dirección IP "${ip}" ya está asignada a otro dispositivo`);
    await expect(taken.first()).toBeVisible();
    await expect(taken).toHaveCount(2);
    await expect(page.getByText(/already assigned/)).toHaveCount(0);
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-049: rejects moving a taken IP onto a device, and keeps its own', async ({ page, api }) => {
    const ip = uniqueIp();
    await arrangeDevice(api, { ipAddress: ip });
    const own = uniqueIp();
    const { device } = await arrangeDevice(api, { ipAddress: own });

    await openEdit(page, device.id);
    await field(page, 'Dirección IP').fill(ip);
    await saveEdit(page);

    await expect(
      page.getByText(`La dirección IP "${ip}" ya está asignada a otro dispositivo`).first()
    ).toBeVisible();

    // Its own IP is not a collision, so putting it back saves.
    await field(page, 'Dirección IP').fill(own);
    await saveEdit(page);
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(detailValue(page, 'Dirección IP')).toHaveText(own);
  });

  // ── DEV-050 / DEV-051 — an ISO 8601 installation date, never in the future ─
  test('DEV-050: round-trips an installation date', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const installed = '2026-07-01';

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));
    await field(page, 'Fecha de Instalación').fill(installed);

    const id = await submitCreate(page, api);

    await expect(detailValue(page, 'Fecha de Instalación')).not.toHaveText('—');

    // Read the stored ISO value back rather than its localised rendering, which
    // would shift a day either way depending on the browser's timezone.
    await openEdit(page, id);
    await expect(field(page, 'Fecha de Instalación')).toHaveValue(installed);
  });

  test('DEV-051: refuses to date an installation in the future', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    // The date input is capped at today, which is the first line of defence.
    await expect(field(page, 'Fecha de Instalación')).toHaveAttribute('max', TODAY);
    // Strip it so the JS check is what runs, the way a stale tab would.
    await page.evaluate(() =>
      document.querySelector('input[name="installedDate"]')?.removeAttribute('max')
    );
    await field(page, 'Fecha de Instalación').fill(tomorrow);

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('La fecha de instalación no puede ser futura')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-051: accepts today', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));
    await field(page, 'Fecha de Instalación').fill(TODAY);

    const id = await submitCreate(page, api);

    await openEdit(page, id);
    await expect(field(page, 'Fecha de Instalación')).toHaveValue(TODAY);
  });

  // ── DEV-052 — a description is at most 500 characters ───────────────────
  test('DEV-052: accepts a description at the 500-character limit', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const description = uniqueName('desc').padEnd(500, 'x');
    expect(description).toHaveLength(500);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));
    await page.locator('textarea[name="description"]').fill(description);

    await submitCreate(page, api);

    // Confirms the backend stored it whole, not truncated on the way.
    await expect(detailValue(page, 'Descripción')).toHaveText(description);
  });

  test('DEV-052: rejects a description over the 500-character limit', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    await page.evaluate(() =>
      document.querySelector('textarea[name="description"]')?.removeAttribute('maxlength')
    );
    await page.locator('textarea[name="description"]').fill('x'.repeat(501));

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('La descripción no puede superar los 500 caracteres')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  // ── DEV-053 — off the network, a device is traced by serial or MAC ──────
  // (Clearing the last identifier of an existing device is covered above.)
  test('DEV-053: refuses an INVENTORY device with neither serial nor MAC', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('Se requiere número de serie o dirección MAC')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-053: a MAC alone satisfies the rule', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const mac = uniqueMac();

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    // Either identifier answers it — the box on the shelf can be matched by
    // whichever of the two is written on it.
    await field(page, 'Dirección MAC').fill(mac);

    await submitCreate(page, api);

    await expect(detailValue(page, 'Dirección MAC')).toHaveText(mac);
    await expect(detailValue(page, 'Número de Serie')).toHaveText('—');
  });

  test('DEV-053: holds a DAMAGED device to the same rule', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Estado').selectOption({ label: 'Dañado' });

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('Se requiere número de serie o dirección MAC')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-053: holds a DECOMMISSIONED device to the same rule', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    // Retired for good is still a retired status: the unit is off the network,
    // so what is written on the box is all there is to track it by.
    await field(page, 'Estado').selectOption({ label: 'Dado de baja' });

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('Se requiere número de serie o dirección MAC')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  // ── DEV-054 / DEV-055 — an ACTIVE device is reachable and findable ──────
  test('DEV-054: refuses an ACTIVE device with no IP address', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const location = await arrangeLocation(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await pickFromCombobox(page, locationPicker(page), location.name);
    await field(page, 'Estado').selectOption({ label: 'Activo' });

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('La dirección IP es requerida')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-055: refuses an ACTIVE device with no location', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Dirección IP').fill(uniqueIp());
    await field(page, 'Estado').selectOption({ label: 'Activo' });

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('La ubicación es requerida para dispositivos activos')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-054/055: accepts an ACTIVE device that has both', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);
    const location = await arrangeLocation(api);
    const ip = uniqueIp();

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Dirección IP').fill(ip);
    await pickFromCombobox(page, locationPicker(page), location.name);
    await field(page, 'Estado').selectOption({ label: 'Activo' });

    await submitCreate(page, api);

    await expect(detailValue(page, 'Estado')).toHaveText('Activo');
    await expect(detailValue(page, 'Dirección IP')).toHaveText(ip);
    // By href rather than by name: the page resolves the label from a capped
    // list of locations, so the id is the part that must be right.
    await expect(detailValue(page, 'Ubicación').getByRole('link')).toHaveAttribute(
      'href',
      `/locations/${location.id}`
    );
  });

  test('DEV-055: refuses to take the location off an ACTIVE device', async ({ page, api }) => {
    const location = await arrangeLocation(api);
    const { device } = await arrangeDevice(api, {
      status: 'ACTIVE',
      ipAddress: uniqueIp(),
      locationId: location.id,
    });

    await openEdit(page, device.id);
    await selectCombobox(page, 'Ubicación', 'Sin ubicación');
    await saveEdit(page);

    // A technician sent to a fault needs somewhere to drive.
    await expect(page.getByText('La ubicación es requerida para dispositivos activos')).toBeVisible();

    await page.reload();
    await expect(detailValue(page, 'Ubicación').getByRole('link')).toHaveAttribute(
      'href',
      `/locations/${location.id}`
    );
  });

  // ── DEV-056 — COMMISSIONING needs an IP, but not a location ─────────────
  test('DEV-056: refuses a COMMISSIONING device with no IP address', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Estado').selectOption({ label: 'Comisionamiento' });

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('La dirección IP es requerida')).toBeVisible();
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-056: accepts a COMMISSIONING device with no location', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Dirección IP').fill(uniqueIp());
    await field(page, 'Estado').selectOption({ label: 'Comisionamiento' });
    // Monitoring is DEV-058's business; left on it would start real polling.
    await field(page, 'Habilitar Monitoreo').uncheck();

    await submitCreate(page, api);

    // Weaker than ACTIVE on purpose: a unit can be configured on the bench
    // before anyone knows where it will be installed.
    await expect(detailValue(page, 'Estado')).toHaveText('Comisionamiento');
    await expect(detailValue(page, 'Ubicación')).toHaveText('—');
  });

  // ── DEV-057 — monitoring is only for ACTIVE or COMMISSIONING ────────────
  test('DEV-057: the create form will not arm monitoring for a warehouse device', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });

    // No IP yet: nothing to ping, so nothing to enable.
    const monitoring = field(page, 'Habilitar Monitoreo');
    await expect(monitoring).toBeDisabled();
    await expect(page.getByText('(requiere una dirección IP)')).toBeVisible();

    // With an IP it is the status that keeps it off.
    await field(page, 'Dirección IP').fill(uniqueIp());
    await field(page, 'Estado').selectOption({ label: 'Inventario' });
    await expect(monitoring).toBeDisabled();
    await expect(monitoring).not.toBeChecked();
    await expect(page.getByText('(se desactiva automáticamente en inventario/dañado)')).toBeVisible();

    await field(page, 'Estado').selectOption({ label: 'Dañado' });
    await expect(monitoring).toBeDisabled();
  });

  test('DEV-057: the polling tab says why a warehouse device cannot be monitored', async ({ page, api }) => {
    const { device } = await arrangeDevice(api, { ipAddress: uniqueIp() });

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Sondeo' }).click();

    await expect(page.getByRole('button', { name: 'Habilitar Monitoreo' })).toBeDisabled();
    await expect(
      page.getByText(/El monitoreo solo puede habilitarse en dispositivos activos o en comisionamiento; este está en «Inventario»/)
    ).toBeVisible();
  });

  test('DEV-057: the polling tab says why a device with no IP cannot be monitored', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Sondeo' }).click();

    await expect(page.getByRole('button', { name: 'Habilitar Monitoreo' })).toBeDisabled();
    await expect(
      page.getByText('Este dispositivo no tiene dirección IP. Asigne una en la pestaña «Detalles» para habilitar el monitoreo.')
    ).toBeVisible();
  });

  test('DEV-057: an ACTIVE device can be put under monitoring', async ({ page, api }) => {
    const location = await arrangeLocation(api);
    const { device } = await arrangeDevice(api, {
      status: 'ACTIVE',
      // 198.18/15 routes nowhere, so the pings this starts reach no real
      // equipment; teardown deletes the device and its polling config.
      ipAddress: uniqueIp(),
      locationId: location.id,
    });

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Sondeo' }).click();

    const enable = page.getByRole('button', { name: 'Habilitar Monitoreo' });
    await expect(enable).toBeEnabled();
    await enable.click();

    // The flag and the schedule are two writes; the tab only offers the
    // interval form once both landed.
    await expect(page.getByText('Intervalo (segundos)')).toBeVisible();

    await page.reload();
    await expect(detailValue(page, 'Monitoreo')).toHaveText('Habilitado');
  });

  // ── DEV-058 — a new COMMISSIONING device is watched by default ──────────
  test('DEV-058: commissioning a new device turns monitoring on', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    // The IP goes first: the form only offers monitoring once there is
    // something to ping.
    await field(page, 'Dirección IP').fill(uniqueIp());
    await field(page, 'Estado').selectOption({ label: 'Comisionamiento' });

    await expect(field(page, 'Habilitar Monitoreo')).toBeChecked();
    await expect(page.getByText('(recomendado en comisionamiento, opcional)')).toBeVisible();

    await submitCreate(page, api);

    await expect(detailValue(page, 'Monitoreo')).toHaveText('Habilitado');
  });

  test('DEV-058: an explicit no is respected on a new COMMISSIONING device', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Dirección IP').fill(uniqueIp());
    await field(page, 'Estado').selectOption({ label: 'Comisionamiento' });
    await field(page, 'Habilitar Monitoreo').uncheck();

    await submitCreate(page, api);

    // Staging a device without polling it yet is legitimate, so the default
    // stays a default.
    await expect(detailValue(page, 'Estado')).toHaveText('Comisionamiento');
    await expect(detailValue(page, 'Monitoreo')).toHaveText('Deshabilitado');
  });

  // ── DEV-059 — moving into COMMISSIONING turns monitoring on ─────────────
  test('DEV-059: commissioning an existing device turns monitoring on', async ({ page, api }) => {
    const { device } = await arrangeDevice(api, { ipAddress: uniqueIp() });

    await openEdit(page, device.id);
    await field(page, 'Estado').selectOption({ label: 'Comisionamiento' });
    await expect(field(page, 'Habilitar monitoreo')).toBeChecked();
    await saveEdit(page);

    await page.reload();
    await expect(detailValue(page, 'Estado')).toHaveText('Comisionamiento');
    await expect(detailValue(page, 'Monitoreo')).toHaveText('Habilitado');
  });

  test('DEV-059: an explicit no survives the transition', async ({ page, api }) => {
    const { device } = await arrangeDevice(api, { ipAddress: uniqueIp() });

    await openEdit(page, device.id);
    await field(page, 'Estado').selectOption({ label: 'Comisionamiento' });
    await field(page, 'Habilitar monitoreo').uncheck();
    await saveEdit(page);

    // Both halves of the same request are honoured — until 2026-08-03 the
    // transition forced monitoring on and returned 200 with it enabled.
    await page.reload();
    await expect(detailValue(page, 'Estado')).toHaveText('Comisionamiento');
    await expect(detailValue(page, 'Monitoreo')).toHaveText('Deshabilitado');
  });

  // ── DEV-060 — the whole candidate state is judged at once ───────────────
  test('DEV-060: activates a device that gains its IP and location in the same save', async ({ page, api }) => {
    const location = await arrangeLocation(api);
    const { device } = await arrangeDevice(api);
    const ip = uniqueIp();

    await openEdit(page, device.id);
    // Status first, on purpose: the request describes an end state, so no field
    // is judged against a half-applied version of the others.
    await field(page, 'Estado').selectOption({ label: 'Activo' });
    await field(page, 'Dirección IP').fill(ip);
    await selectCombobox(page, 'Ubicación', location.name);
    await saveEdit(page);

    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();

    await page.reload();
    await expect(detailValue(page, 'Estado')).toHaveText('Activo');
    await expect(detailValue(page, 'Dirección IP')).toHaveText(ip);
    await expect(detailValue(page, 'Ubicación').getByRole('link')).toHaveAttribute(
      'href',
      `/locations/${location.id}`
    );
  });

  test('DEV-060: a refused save applies none of its fields', async ({ page, api }) => {
    const mac = uniqueMac();
    await arrangeDevice(api, { macAddress: mac });
    const { device } = await arrangeDevice(api);

    await openEdit(page, device.id);
    await field(page, 'Nombre').fill(uniqueName('renamed'));
    // The taken MAC is the vehicle: it is the one rule in reach that the form
    // does not pre-check, so the request really reaches the backend.
    await field(page, 'Dirección MAC').fill(mac);
    await saveEdit(page);

    await expect(
      page.getByText(`La dirección MAC "${mac}" ya está asignada a otro dispositivo`).first()
    ).toBeVisible();

    // The rename travelled with the MAC and fell with it.
    await page.reload();
    await expect(page.getByRole('heading', { name: device.name })).toBeVisible();
    await expect(detailValue(page, 'Dirección MAC')).toHaveText('—');
  });

  // ── DEV-062 — only two categories may hold a wireless configuration ─────
  test('DEV-062: offers the wireless tab to WIRELESS_CPE and ACCESS_POINT', async ({ page, api }) => {
    const { model } = await arrangeModel(api, { deviceType: 'RADIO', isWireless: true });

    for (const category of ['WIRELESS_CPE', 'ACCESS_POINT']) {
      const device = await api.create<{ id: string }>('devices', {
        name: uniqueName('device'),
        deviceModelId: model.id,
        status: 'INVENTORY',
        serialNumber: uniqueName('sn'),
        category,
      });

      await page.goto(`/devices/${device.id}`);
      await expect(page.getByRole('button', { name: 'Inalámbrico' })).toBeVisible();
    }
  });

  test('DEV-062: withholds the wireless tab from every other category', async ({ page, api }) => {
    const { model } = await arrangeModel(api, { deviceType: 'RADIO', isWireless: true });

    // A CPE and an uncategorised device, both on hardware that does have a
    // radio — the category is what decides, and "no category" decides against.
    for (const category of ['CPE', null]) {
      const device = await api.create<{ id: string }>('devices', {
        name: uniqueName('device'),
        deviceModelId: model.id,
        status: 'INVENTORY',
        serialNumber: uniqueName('sn'),
        category,
      });

      await page.goto(`/devices/${device.id}`);
      await expect(page.getByRole('button', { name: 'Detalles' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Inalámbrico' })).toHaveCount(0);
    }
  });

  // ── DEV-063 — the model is a correction, and only while INVENTORY ───────
  test('DEV-063: corrects the model of a device still in inventory', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);
    const { vendor: vendorB, model: modelB } = await arrangeModel(api);

    await openEdit(page, device.id);
    await selectCombobox(page, 'Modelo', `${vendorB.name} — ${modelB.model} (${modelB.deviceType})`);
    await saveEdit(page);

    await page.reload();
    await expect(detailValue(page, 'Modelo').getByRole('link')).toHaveAttribute(
      'href',
      `/device-models/${modelB.id}`
    );
  });

  test('DEV-063: freezes the model once the device has left inventory', async ({ page, api }) => {
    const { model, device } = await arrangeDevice(api, {
      status: 'COMMISSIONING',
      ipAddress: uniqueIp(),
    });

    await openEdit(page, device.id);

    // Not offered at all, rather than offered and refused on save.
    await expect(field(page, 'Modelo')).toHaveCount(0);
    await expect(
      page.getByText('El modelo solo puede corregirse mientras el dispositivo está en inventario.')
    ).toBeVisible();

    await page.reload();
    await expect(detailValue(page, 'Modelo').getByRole('link')).toHaveAttribute(
      'href',
      `/device-models/${model.id}`
    );
  });

  test('DEV-063: corrects the model and commissions the unit in one save', async ({ page, api }) => {
    const { device } = await arrangeDevice(api, { ipAddress: uniqueIp() });
    const { vendor: vendorB, model: modelB } = await arrangeModel(api);

    await openEdit(page, device.id);
    await selectCombobox(page, 'Modelo', `${vendorB.name} — ${modelB.model} (${modelB.deviceType})`);
    await field(page, 'Estado').selectOption({ label: 'Comisionamiento' });
    await field(page, 'Habilitar monitoreo').uncheck();
    await saveEdit(page);

    // The correction is judged against the status the device has now, so it is
    // legal even though the same request moves the device out of INVENTORY.
    await page.reload();
    await expect(detailValue(page, 'Estado')).toHaveText('Comisionamiento');
    await expect(detailValue(page, 'Modelo').getByRole('link')).toHaveAttribute(
      'href',
      `/device-models/${modelB.id}`
    );
  });

  // ── DEV-065 — the category is frozen while a wireless config exists ─────
  test('DEV-065: locks the category behind the wireless config, and frees it again', async ({ page, api }) => {
    const { device } = await arrangeDevice(
      api,
      { category: 'WIRELESS_CPE' },
      { deviceType: 'RADIO', isWireless: true }
    );
    // Registered disabled so the backend's poller never chases a radio that
    // does not exist while the test runs.
    await api.post(`/devices/${device.id}/wireless/config`, {
      ipAddress: uniqueIp(),
      intervalSecs: 3600,
      enabled: false,
    });

    await openEdit(page, device.id);

    // Offered read-only rather than offered and refused on save.
    await expect(field(page, 'Categoría')).toHaveCount(0);
    await expect(
      page.getByText(/Fijada por la configuración inalámbrica/)
    ).toBeVisible();

    // Every other field on the same form still saves.
    const renamed = uniqueName('renamed');
    await field(page, 'Nombre').fill(renamed);
    await saveEdit(page);
    await expect(page.getByRole('heading', { name: renamed })).toBeVisible();
    await expect(detailValue(page, 'Categoría')).toHaveText('CPE Inalámbrico');

    // Deleting the config is what unfreezes it — the walk the UI asks for.
    await page.getByRole('button', { name: 'Inalámbrico' }).click();
    const configHeading = page.getByRole('heading', { name: 'Configuración Inalámbrica' });
    await expect(configHeading).toBeVisible();
    // Scoped to the config card's own header — the page's delete-device button
    // is also called "Eliminar".
    await configHeading
      .locator('xpath=following-sibling::div')
      .getByRole('button', { name: 'Eliminar', exact: true })
      .click();
    await expect(page.getByText('Este dispositivo no tiene configuración de monitoreo inalámbrico.')).toBeVisible();

    await page.getByRole('button', { name: 'Detalles' }).click();
    await page.getByRole('button', { name: 'Editar' }).click();
    await field(page, 'Categoría').selectOption({ label: 'CPE (Cliente)' });
    await saveEdit(page);

    await page.reload();
    await expect(detailValue(page, 'Categoría')).toHaveText('CPE (Cliente)');
  });

  // ── DEV-066 — a device's model must exist ───────────────────────────────
  test('DEV-066: rejects a model that no longer exists on create', async ({ page, api }) => {
    const { vendor, model } = await arrangeModel(api);

    await page.goto('/devices/create');
    await fillRequiredFields(page, { vendor, model });
    await field(page, 'Número de Serie').fill(uniqueName('sn'));

    // The picker only offers models that existed when the form loaded, so a
    // dangling deviceModelId is unreachable by clicking alone. Deleting the
    // model now is what a stale tab would carry.
    await api.remove('device-models', model.id);

    await page.getByRole('button', { name: 'Crear Dispositivo' }).click();

    await expect(page.getByText('El modelo seleccionado ya no existe').first()).toBeVisible();
    await expect(page.getByText(/Device model not found/)).toHaveCount(0);
    await expect(page).toHaveURL(/\/devices\/create$/);
  });

  test('DEV-066: rejects a correction onto a model that no longer exists', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);
    const { vendor: vendorB, model: modelB } = await arrangeModel(api);

    await openEdit(page, device.id);
    await selectCombobox(page, 'Modelo', `${vendorB.name} — ${modelB.model} (${modelB.deviceType})`);
    await api.remove('device-models', modelB.id);
    await saveEdit(page);

    await expect(page.getByText('El modelo seleccionado ya no existe').first()).toBeVisible();
    await expect(page.getByText(/Device model not found/)).toHaveCount(0);
  });
});

/** Deletes a device the way an operator does: from its own detail page. */
async function deleteThroughUi(page: Page, deviceId: string): Promise<void> {
  await page.goto(`/devices/${deviceId}`);
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await confirmDialog(page, 'Eliminar dispositivo');
}

/** A row of the recycle bin, found by the device's name. */
function binRow(page: Page, name: string): Locator {
  return page.getByRole('row').filter({ hasText: name });
}

/**
 * Deleting a device is a soft delete: it leaves every listing at once but the
 * row survives a 7-day grace period, restorable from the undo the delete leaves
 * on screen or from the recycle bin.
 */
test.describe('devices: recycle bin', () => {
  test('a deleted device offers an undo that says monitoring stayed off', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);

    await deleteThroughUi(page, device.id);

    await expect(page.getByRole('heading', { name: 'Dispositivo eliminado' })).toBeVisible();
    await expect(page.getByText(`«${device.name}» se eliminó`)).toBeVisible();

    await page.getByRole('button', { name: 'Deshacer' }).click();

    // It comes back with polling off whatever it had before, so the page has to
    // say so rather than let the operator find out from a grey pill later.
    await expect(
      page.getByText('Dispositivo restaurado con el monitoreo deshabilitado')
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: device.name })).toBeVisible();
  });

  test('deleting a selection offers one undo that puts the whole batch back', async ({ page, api }) => {
    // One shared prefix so a single search brings both rows onto the listing.
    const prefix = uniqueName('batch');
    const { model } = await arrangeModel(api);
    const first = await api.create<{ id: string; name: string }>('devices', {
      name: `${prefix}-uno`,
      deviceModelId: model.id,
      status: 'INVENTORY',
      ownerType: 'COMPANY',
      serialNumber: uniqueName('sn'),
    });
    const second = await api.create<{ id: string; name: string }>('devices', {
      name: `${prefix}-dos`,
      deviceModelId: model.id,
      status: 'INVENTORY',
      ownerType: 'COMPANY',
      serialNumber: uniqueName('sn'),
    });

    await page.goto('/devices');
    await searchFor(page, prefix);
    await page.getByRole('checkbox', { name: `Seleccionar ${first.name}` }).click();
    await page.getByRole('checkbox', { name: `Seleccionar ${second.name}` }).click();

    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar dispositivos');

    // A batch reports itself as the undo and nothing else.
    await expect(page.getByRole('heading', { name: 'Dispositivos eliminados' })).toBeVisible();
    await expect(page.getByText('Se eliminaron 2 dispositivos')).toBeVisible();

    await page.getByRole('button', { name: 'Deshacer' }).click();

    await expect(page.getByRole('heading', { name: 'Dispositivos eliminados' })).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: first.name })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: second.name })).toBeVisible();

    // And the undo really emptied the bin of them, rather than only redrawing
    // the listing from a hopeful client-side guess.
    await page.goto('/devices/trash');
    await expect(binRow(page, first.name)).toHaveCount(0);
    await expect(binRow(page, second.name)).toHaveCount(0);
  });

  test('a deleted device leaves the listing and turns up in the bin, restorable', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);

    await deleteThroughUi(page, device.id);

    await page.goto('/devices');
    await searchFor(page, device.name);
    await expect(page.getByText('Ningún dispositivo coincide con los filtros')).toBeVisible();

    await page.goto('/devices/trash');
    await expect(binRow(page, device.name)).toBeVisible();

    await binRow(page, device.name).getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.getByText(`«${device.name}» se restauró`)).toBeVisible();
    await expect(binRow(page, device.name)).toHaveCount(0);

    await page.goto('/devices');
    await searchFor(page, device.name);
    await expect(page.getByRole('row').filter({ hasText: device.name })).toBeVisible();
  });

  test('purging from the bin takes the device for good', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);

    await deleteThroughUi(page, device.id);

    await page.goto('/devices/trash');
    await binRow(page, device.name).getByRole('button', { name: 'Eliminar' }).click();

    // The confirmation has to say the history goes too — there is no undo.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(device.name)).toBeVisible();
    await expect(dialog.getByText('Esta acción no se puede deshacer')).toBeVisible();
    await dialog.getByRole('button', { name: 'Eliminar permanentemente' }).click();

    await expect(page.getByText(`«${device.name}» se eliminó de forma permanente`)).toBeVisible();
    await expect(binRow(page, device.name)).toHaveCount(0);

    // Gone from the database, not just from the bin: its own page cannot load it.
    await page.goto(`/devices/${device.id}`);
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(page.getByRole('heading', { name: device.name })).toHaveCount(0);
  });

  test('a live contracted service blocks the delete, and says which one', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);
    const customer = await api.create<{ id: string }>('customers', {
      fullName: uniqueName('customer'),
      phone: '3001112233',
    });
    const plan = await api.create<{ id: string }>('service-plans', {
      name: uniqueName('plan'),
      downloadMbps: 50,
      uploadMbps: 10,
      monthlyPrice: 60000,
    });
    // Services are born PENDING, and anything but CANCELLED counts as live.
    await api.create('contracted-services', {
      customerId: customer.id,
      servicePlanId: plan.id,
      deviceId: device.id,
    });

    await deleteThroughUi(page, device.id);

    await expect(
      page.getByText(
        'Este dispositivo tiene un servicio contratado vigente (estado «Pendiente»). Cancele el servicio antes de eliminarlo.'
      )
    ).toBeVisible();
    // The device is still here: the refusal left it alone.
    await expect(page.getByRole('heading', { name: device.name })).toBeVisible();
    await expect(page.getByText(/Cannot delete a device/)).toHaveCount(0);
  });

  test('an open ticket blocks the delete, and counts them', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);
    await api.create('tickets', {
      title: uniqueName('ticket'),
      description: 'Arranged by an E2E test.',
      category: 'CONNECTIVITY',
      deviceId: device.id,
    });

    await deleteThroughUi(page, device.id);

    await expect(
      page.getByText(
        'Este dispositivo tiene 1 ticket abierto. Resuélvalos o cancélelos antes de eliminarlo.'
      )
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: device.name })).toBeVisible();
  });
});

/**
 * Replacing hardware: one physical box swapped for another. Two device records
 * result, linked both ways, so months of readings stay attributed to the unit
 * that actually produced them.
 */
test.describe('devices: replacement', () => {
  test('refuses a replacement with no model and no identifier of its own', async ({ page, api }) => {
    const { device } = await arrangeDevice(api);

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Reemplazar equipo' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Reemplazar equipo' }).click();

    await expect(dialog.getByText('El modelo del equipo nuevo es requerido')).toBeVisible();
    await expect(dialog.getByText('Se requiere número de serie o dirección MAC')).toBeVisible();
    // Nothing was retired: the outgoing unit is untouched behind the dialog.
    await expect(dialog).toBeVisible();
  });

  test('retires a unit into a chosen status and carries the site over to its successor', async ({ page, api }) => {
    const location = await arrangeLocation(api);
    const ip = uniqueIp();
    const { device } = await arrangeDevice(api, {
      status: 'ACTIVE',
      ipAddress: ip,
      locationId: location.id,
      category: 'CPE',
    });
    const { vendor: newVendor, model: newModel } = await arrangeModel(api);
    const newName = uniqueName('device');
    const newSerial = uniqueName('sn');

    await page.goto(`/devices/${device.id}`);
    await page.getByRole('button', { name: 'Reemplazar equipo' }).click();

    const dialog = page.getByRole('dialog');
    await selectCombobox(
      page,
      'Modelo del equipo nuevo',
      `${newVendor.name} — ${newModel.model} (${newModel.deviceType})`,
      dialog
    );
    // A swap is not always a failure — this one retires an obsolete box.
    await field(dialog, 'Estado de la unidad retirada').selectOption({ label: 'Dado de baja' });
    await field(dialog, 'Nombre del equipo nuevo').fill(newName);
    await field(dialog, 'Número de Serie').fill(newSerial);

    const result = await captureCreate<{ newDevice: { id: string } }>(page, 'replace', async () => {
      // Scoped to the dialog: the Modal renders before the header in the DOM,
      // so an unscoped lookup finds the header button behind the backdrop.
      await dialog.getByRole('button', { name: 'Reemplazar equipo' }).click();
    });
    api.track('devices', result.newDevice.id);

    await expect(page.getByText('Equipo reemplazado')).toBeVisible();
    await expect(page.getByText('Esta unidad quedó en «Dado de baja»')).toBeVisible();
    await expect(page.getByText('Dado de baja').first()).toBeVisible();

    // A unit can only be swapped once, so the button comes off afterwards.
    await expect(page.getByRole('button', { name: 'Reemplazar equipo' })).toHaveCount(0);

    // The retired unit points forward at the box that took its place.
    await expect(page.getByRole('link', { name: 'el equipo actual' })).toHaveAttribute(
      'href',
      `/devices/${result.newDevice.id}`
    );

    await page.getByRole('link', { name: `Ir al equipo nuevo «${newName}»` }).click();
    await page.waitForURL(`**/devices/${result.newDevice.id}`);

    await expect(page.getByRole('heading', { name: newName })).toBeVisible();
    // It inherited the site and the address, so it comes up commissioning.
    await expect(detailValue(page, 'Estado')).toHaveText('Comisionamiento');
    await expect(detailValue(page, 'Dirección IP')).toHaveText(ip);
    await expect(detailValue(page, 'Ubicación').getByRole('link')).toHaveAttribute(
      'href',
      `/locations/${location.id}`
    );
    await expect(page.getByRole('link', { name: 'la unidad anterior' })).toHaveAttribute(
      'href',
      `/devices/${device.id}`
    );
  });
});
