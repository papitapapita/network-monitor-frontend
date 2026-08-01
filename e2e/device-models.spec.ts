import { Locator, Page } from '@playwright/test';
import { test, expect, uniqueName } from './fixtures/test';
import { ApiClient } from './fixtures/api';
import { confirmDialog, field, idFromUrl, searchFor } from './fixtures/helpers';

/** Every model needs a vendor, so each test arranges its own. */
async function makeVendor(api: ApiClient) {
  const name = uniqueName('vendor');
  return api.create<{ id: string; name: string; slug: string }>('vendors', {
    name,
    slug: name,
  });
}

/**
 * Reads a value out of a detail page's definition list by its label. Anchored
 * on both ends because several labels are prefixes of others ("Fabricante" vs
 * "Slug del Fabricante", "Modelo" vs "Modelo inalámbrico").
 */
function detailValue(page: Page, label: string): Locator {
  return page
    .locator('dt')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd');
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

/**
 * Device model conventions (DEV-020..DEV-028).
 *
 * Same split as the vendor conventions:
 *   - DEV-020 and DEV-023 are caught by the create form's own `validate()`
 *     before anything is sent, so those tests prove the client-side guard fires
 *     under real DOM interaction. Where a native `required` / `maxlength`
 *     would short-circuit the click first, the attribute is stripped so the JS
 *     check is what actually runs.
 *   - DEV-021, DEV-022, DEV-026 and DEV-027 are backend-enforced, so every one
 *     of those tests makes a real request and only passes if the backend
 *     rejected it AND the frontend relayed the real response.
 *   - DEV-024, DEV-025 and DEV-028 are round-trips: submit at the rule's edge
 *     and read back what the backend stored.
 */
test.describe('device model conventions', () => {
  test('DEV-020: rejects a model with no vendor', async ({ page }) => {
    await page.goto('/device-models/create');

    // Filling these first also waits out hydration, so the evaluate() below
    // doesn't race the initial render.
    await field(page, 'Modelo').fill(uniqueName('model'));
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });

    // The <select> carries a native `required`, which blocks the submit before
    // our onSubmit — and therefore validate() — ever runs. Strip it so this
    // exercises the JS required-check itself.
    await page.evaluate(() => document.querySelector('select[name="vendorId"]')?.removeAttribute('required'));

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await expect(page.getByText('El fabricante es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/device-models\/create$/);
  });

  test('DEV-020: rejects a model with no name', async ({ page, api }) => {
    const vendor = await makeVendor(api);

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });

    // Same native `required` short-circuit as above.
    await page.evaluate(() => document.querySelector('input[name="model"]')?.removeAttribute('required'));

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await expect(page.getByText('El modelo es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/device-models\/create$/);
  });

  test('DEV-020: rejects a model with no device type', async ({ page, api }) => {
    const vendor = await makeVendor(api);

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    await field(page, 'Modelo').fill(uniqueName('model'));

    await page.evaluate(() => document.querySelector('select[name="deviceType"]')?.removeAttribute('required'));

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await expect(page.getByText('El tipo de dispositivo es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/device-models\/create$/);
  });

  test('DEV-021: rejects a vendor that no longer exists', async ({ page, api }) => {
    const vendor = await makeVendor(api);

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    await field(page, 'Modelo').fill(uniqueName('model'));
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });

    // The picker only offers vendors that existed when the form loaded, so a
    // dangling vendorId is unreachable by clicking alone. Deleting the vendor
    // now makes the pending submit carry an id the backend can't resolve —
    // which is also exactly what a stale tab would do.
    await api.remove('vendors', vendor.id);

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    // Untranslated on purpose: the frontend has no Spanish wording for this
    // one, so the backend's own message is what reaches the page.
    await expect(page.getByText(`Vendor not found: ${vendor.id}`)).toBeVisible();
    await expect(page).toHaveURL(/\/device-models\/create$/);
  });

  test('DEV-022: rejects a model name the vendor already has', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const existing = await api.create<{ id: string; model: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    await field(page, 'Modelo').fill(existing.model);
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Switch' });

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    // Nothing client-side knows about this collision, so this only passes if
    // the request reached the backend and the response came back translated.
    await expect(
      page.getByText(`Ya existe un modelo de dispositivo "${existing.model}" para este fabricante`)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/device-models\/create$/);
  });

  test('DEV-022: rejects a duplicate that differs only by surrounding spaces', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const existing = await api.create<{ id: string; model: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    // The form trims before sending, so uniqueness is judged on the trimmed name.
    await field(page, 'Modelo').fill(`   ${existing.model}   `);
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await expect(
      page.getByText(`Ya existe un modelo de dispositivo "${existing.model}" para este fabricante`)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/device-models\/create$/);
  });

  test('DEV-022: accepts a name another vendor already uses', async ({ page, api }) => {
    const vendorA = await makeVendor(api);
    const vendorB = await makeVendor(api);
    const existing = await api.create<{ id: string; model: string }>('device-models', {
      vendorId: vendorA.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });

    // Uniqueness is scoped to the vendor, so the same name under B is fine.
    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendorB.name });
    await field(page, 'Modelo').fill(existing.model);
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await page.waitForURL(/\/device-models\/[0-9a-f-]{36}$/);
    api.track('device-models', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name: `${vendorB.name} — ${existing.model}` })).toBeVisible();
  });

  test('DEV-023: accepts a model name at the 150-character limit', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const model = uniqueName('model').padEnd(150, 'x');
    expect(model).toHaveLength(150);

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    await field(page, 'Modelo').fill(model);
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await page.waitForURL(/\/device-models\/[0-9a-f-]{36}$/);
    api.track('device-models', idFromUrl(page.url()));

    // Confirms the backend stored the name whole, not truncated on the way.
    await expect(detailValue(page, 'Modelo')).toHaveText(model);
  });

  test('DEV-023: rejects a model name over the 150-character limit', async ({ page, api }) => {
    const vendor = await makeVendor(api);

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });

    // The <input> carries maxlength=150, which would silently truncate anything
    // past the limit before validate() ever saw it. Strip it so the JS length
    // check is what runs.
    await page.evaluate(() => document.querySelector('input[name="model"]')?.removeAttribute('maxlength'));

    await field(page, 'Modelo').fill(uniqueName('model').padEnd(151, 'x'));
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await expect(page.getByText('El modelo no puede superar los 150 caracteres')).toBeVisible();
    await expect(page).toHaveURL(/\/device-models\/create$/);
  });

  test('DEV-023: rejects a whitespace-only model name', async ({ page, api }) => {
    const vendor = await makeVendor(api);

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    // Spaces satisfy the native `required`, so this reaches validate() as-is —
    // and it is the trim that rejects it.
    await field(page, 'Modelo').fill('   ');
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await expect(page.getByText('El modelo es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/device-models\/create$/);
  });

  test('DEV-024: offers exactly the seven device types', async ({ page }) => {
    await page.goto('/device-models/create');

    const options = field(page, 'Tipo de Dispositivo').locator('option');
    await expect(options).toHaveText([
      'Seleccionar tipo',
      'Antena',
      'Otro',
      'Radio',
      'Router',
      'RouterBoard',
      'Servidor',
      'Switch',
    ]);

    // The labels are Spanish; what gets submitted must be the domain's set.
    const values = await options.evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
    expect(values).toEqual([
      '',
      'ANTENNA',
      'OTHER',
      'RADIO',
      'ROUTER',
      'ROUTERBOARD',
      'SERVER',
      'SWITCH',
    ]);
  });

  test('DEV-024: round-trips the chosen device type through the backend', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const model = uniqueName('model');

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    await field(page, 'Modelo').fill(model);
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'RouterBoard' });

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await page.waitForURL(/\/device-models\/[0-9a-f-]{36}$/);
    api.track('device-models', idFromUrl(page.url()));

    // Reload so this reads what was stored, not what the form just sent.
    await page.reload();
    await expect(page.getByText('ROUTERBOARD').first()).toBeVisible();
    await expect(detailValue(page, 'Tipo de Dispositivo')).toHaveText('RouterBoard');
  });

  test('DEV-025: a new model is non-wireless unless the box is ticked', async ({ page, api }) => {
    const vendor = await makeVendor(api);

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    await field(page, 'Modelo').fill(uniqueName('model'));
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });

    // Left untouched — wireless is the exception, so the form starts it off.
    await expect(field(page, 'Modelo inalámbrico')).not.toBeChecked();

    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await page.waitForURL(/\/device-models\/[0-9a-f-]{36}$/);
    api.track('device-models', idFromUrl(page.url()));

    await expect(detailValue(page, 'Inalámbrico')).toHaveText('No');
  });

  test('DEV-025: a model created without the flag reads back as non-wireless', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    // isWireless omitted entirely — the create form always sends it, so this is
    // the only way to see the backend's own default reach the page.
    const created = await api.create<{ id: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
    });

    await page.goto(`/device-models/${created.id}`);

    await expect(detailValue(page, 'Inalámbrico')).toHaveText('No');
  });

  test('DEV-026: refuses to delete a model that has devices', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const model = await api.create<{ id: string; model: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });
    await api.create('devices', {
      name: uniqueName('device'),
      deviceModelId: model.id,
      status: 'INVENTORY',
      ownerType: 'COMPANY',
      serialNumber: uniqueName('sn'),
    });

    await page.goto(`/device-models/${model.id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar modelo');

    // The backend's own count is what's on screen, so the model stays put.
    await expect(
      page.getByText('No se puede eliminar el modelo: tiene 1 dispositivo asociado. Reasigna o elimina ese dispositivo primero.')
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/device-models/${model.id}$`));
    await expect(page.getByRole('heading', { name: `${vendor.name} — ${model.model}` })).toBeVisible();
  });

  test('DEV-028: copies the vendor name and slug onto the model', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const model = uniqueName('model');

    await page.goto('/device-models/create');
    await field(page, 'Fabricante').selectOption({ label: vendor.name });
    await field(page, 'Modelo').fill(model);
    await field(page, 'Tipo de Dispositivo').selectOption({ label: 'Router' });
    await page.getByRole('button', { name: 'Crear Modelo' }).click();

    await page.waitForURL(/\/device-models\/[0-9a-f-]{36}$/);
    api.track('device-models', idFromUrl(page.url()));

    // Both come back on the model itself — the page never loads the vendor.
    await expect(detailValue(page, 'Fabricante')).toHaveText(vendor.name);
    await expect(detailValue(page, 'Slug del Fabricante')).toHaveText(vendor.slug);
  });

  test('DEV-028: refreshes the copy when the model changes vendor', async ({ page, api }) => {
    const vendorA = await makeVendor(api);
    const vendorB = await makeVendor(api);
    const created = await api.create<{ id: string }>('device-models', {
      vendorId: vendorA.id,
      model: uniqueName('model'),
      deviceType: 'ROUTER',
      isWireless: false,
    });

    await page.goto(`/device-models/${created.id}`);
    await expect(detailValue(page, 'Slug del Fabricante')).toHaveText(vendorA.slug);

    await page.getByRole('button', { name: 'Editar' }).click();
    await field(page, 'Fabricante').selectOption({ label: vendorB.name });
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();

    await page.reload();
    await expect(detailValue(page, 'Fabricante')).toHaveText(vendorB.name);
    await expect(detailValue(page, 'Slug del Fabricante')).toHaveText(vendorB.slug);
  });
});

/**
 * DEV-027 — turning isWireless off is refused while any device on the model
 * still holds a wireless config. Those configs carry operator-entered values,
 * so the backend never deletes them for us.
 *
 * The frontend's part is to name the devices in the way rather than let the
 * save fail with a bare count, and to stop offering the wireless tab once the
 * flag is finally off. All of it runs against the real refusal: nothing here
 * fakes a 409.
 */
test.describe('device model wireless flag', () => {
  /**
   * A wireless model with one WIRELESS_CPE device that has a wireless config —
   * the smallest arrangement that blocks the flag.
   *
   * The config is registered disabled so the backend's poller never tries to
   * reach the (nonexistent) radio while the test runs. Each caller passes its
   * own IP because these tests share a database. `deviceType` is not sent: the
   * backend derives STATION from the device's WIRELESS_CPE category.
   */
  async function arrangeWirelessDevice(api: ApiClient, ip: string) {
    const vendor = await makeVendor(api);
    const model = await api.create<{ id: string; model: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'RADIO',
      isWireless: true,
    });
    const device = await api.create<{ id: string; name: string }>('devices', {
      name: uniqueName('device'),
      deviceModelId: model.id,
      status: 'INVENTORY',
      ownerType: 'COMPANY',
      serialNumber: uniqueName('sn'),
      category: 'WIRELESS_CPE',
    });
    await api.post(`/devices/${device.id}/wireless/config`, {
      ipAddress: ip,
      intervalSecs: 3600,
      enabled: false,
    });
    return { vendor, model, device };
  }

  /** Opens a device's Inalámbrico tab and waits for the config card to settle. */
  async function openWirelessTab(page: Page, deviceId: string) {
    await page.goto(`/devices/${deviceId}`);
    await page.getByRole('button', { name: 'Inalámbrico' }).click();
    await expect(page.getByText('Configuración Inalámbrica')).toBeVisible();
  }

  /**
   * The refusal notice. Scoped by its heading rather than by `role="alert"`
   * alone — Next.js's dev-mode route announcer is also an alert, so a bare
   * role query never reaches zero.
   */
  function refusalNotice(page: Page): Locator {
    return page.getByRole('alert').filter({ hasText: 'No se puede quitar el modo inalámbrico' });
  }

  /** Ticks or unticks "Modelo inalámbrico" on the model's edit form and saves. */
  async function setWirelessFlag(page: Page, modelId: string, wireless: boolean) {
    await page.goto(`/device-models/${modelId}`);
    await page.getByRole('button', { name: 'Editar' }).click();
    await field(page, 'Modelo inalámbrico').setChecked(wireless);
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();
  }

  test('DEV-027: refuses the flag and names the device standing in the way', async ({ page, api }) => {
    const { model, device } = await arrangeWirelessDevice(api, '192.168.79.41');

    // Before: the device has a wireless tab, and a config on it.
    await openWirelessTab(page, device.id);
    await expect(detailValue(page, 'Intervalo')).toHaveText('3600s');

    await setWirelessFlag(page, model.id, false);

    // The refusal names the device, not just a count — and the name comes from
    // a real read of the model's devices, not from anything canned.
    const notice = refusalNotice(page);
    await expect(notice).toBeVisible();
    await expect(notice.getByText(/^1 dispositivo de este modelo todavía tiene configuración inalámbrica/)).toBeVisible();
    await expect(notice.getByRole('link', { name: device.name })).toHaveAttribute('href', `/devices/${device.id}`);

    // Nothing was sent, so a reload shows the model exactly as it was.
    await page.reload();
    await expect(detailValue(page, 'Inalámbrico')).toHaveText('Sí');

    // And the device keeps both its tab and its config.
    await openWirelessTab(page, device.id);
    await expect(detailValue(page, 'Intervalo')).toHaveText('3600s');
  });

  test('DEV-027: deleting the config clears the way, and the tab goes with the flag', async ({ page, api }) => {
    const { model, device } = await arrangeWirelessDevice(api, '192.168.79.42');

    // Blocked first, so the walk that follows is the one the notice asks for.
    await setWirelessFlag(page, model.id, false);
    const notice = refusalNotice(page);
    await expect(notice).toBeVisible();

    // Follow the link out of the notice and delete the config the way an
    // operator would, from the device's own wireless tab.
    await notice.getByRole('link', { name: device.name }).click();
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

    // With nothing left holding a config, the same save goes through.
    await setWirelessFlag(page, model.id, false);
    await expect(detailValue(page, 'Inalámbrico')).toHaveText('No');
    await expect(refusalNotice(page)).toHaveCount(0);

    // The tab goes with the flag: nothing wireless is offered for the device,
    // even though it is still categorised WIRELESS_CPE. That pairing is inert,
    // not an error — no config can be created for it.
    await page.goto(`/devices/${device.id}`);
    await expect(page.getByRole('button', { name: 'Detalles' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inalámbrico' })).toHaveCount(0);

    // Turning the flag back on brings the tab back, empty.
    await setWirelessFlag(page, model.id, true);
    await expect(detailValue(page, 'Inalámbrico')).toHaveText('Sí');

    await openWirelessTab(page, device.id);
    await expect(page.getByText('Este dispositivo no tiene configuración de monitoreo inalámbrico.')).toBeVisible();
  });

  test('DEV-027: saves without complaint when no device holds a config', async ({ page, api }) => {
    const vendor = await makeVendor(api);
    const model = await api.create<{ id: string }>('device-models', {
      vendorId: vendor.id,
      model: uniqueName('model'),
      deviceType: 'RADIO',
      isWireless: true,
    });

    await setWirelessFlag(page, model.id, false);

    // Nothing is holding a config, so the save goes straight through. Devices
    // on the model would not have blocked it either — only their configs do.
    await expect(detailValue(page, 'Inalámbrico')).toHaveText('No');
    await expect(refusalNotice(page)).toHaveCount(0);
  });
});
