import { test, expect, uniqueName } from './fixtures/test';
import { confirmDialog, field, idFromUrl, searchFor } from './fixtures/helpers';

/** A phone that is unique per run, so the uniqueness rules can be provoked deliberately. */
function uniquePhone(): string {
  // 10 digits after the country code, seeded from the clock — inside the
  // backend's 7–15 digit range and unlikely to collide with a real record.
  const tail = String(Date.now()).slice(-9) + Math.floor(Math.random() * 10);
  return `+57${tail}`;
}

const uniqueEmail = () => `${uniqueName('tech')}@example.com`;

/**
 * Technicians: Create, Get, List, Update, Delete — all driven through the UI
 * against the real backend.
 */
test.describe('technicians', () => {
  test('creates a technician and lands on its detail page', async ({ page, api }) => {
    const name = uniqueName('tech');

    await page.goto('/technicians/create');
    await field(page, 'Nombre Completo').fill(name);
    await field(page, 'Teléfono').fill(uniquePhone());
    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    await page.waitForURL(/\/technicians\/[0-9a-f-]{36}$/);
    api.track('technicians', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('shows an existing technician on its detail page', async ({ page, api }) => {
    const technician = await api.create<{ id: string; fullName: string; phone: string }>(
      'technicians',
      { fullName: uniqueName('tech'), phone: uniquePhone() }
    );

    await page.goto(`/technicians/${technician.id}`);

    await expect(page.getByRole('heading', { name: technician.fullName })).toBeVisible();
    // The phone renders in the header and again in the details list.
    await expect(page.getByText(technician.phone).first()).toBeVisible();
  });

  test('lists technicians and finds one by search', async ({ page, api }) => {
    const technician = await api.create<{ id: string; fullName: string }>('technicians', {
      fullName: uniqueName('tech'),
      phone: uniquePhone(),
    });

    await page.goto('/technicians');
    await searchFor(page, technician.fullName);

    const row = page.getByRole('row').filter({ hasText: technician.fullName });
    await expect(row).toBeVisible();

    await row.click();
    await page.waitForURL(`**/technicians/${technician.id}`);
  });

  test('updates a technician name', async ({ page, api }) => {
    const technician = await api.create<{ id: string; fullName: string }>('technicians', {
      fullName: uniqueName('tech'),
      phone: uniquePhone(),
    });
    const newName = uniqueName('tech-renamed');

    await page.goto(`/technicians/${technician.id}`);
    await page.getByRole('button', { name: 'Editar' }).click();

    await field(page, 'Nombre Completo').fill(newName);
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('heading', { name: newName })).toBeVisible();

    // Survives a reload — i.e. it really persisted, not just local state.
    await page.reload();
    await expect(page.getByRole('heading', { name: newName })).toBeVisible();
  });

  test('deletes a technician who has never held a ticket', async ({ page, api }) => {
    const technician = await api.create<{ id: string; fullName: string }>('technicians', {
      fullName: uniqueName('tech'),
      phone: uniquePhone(),
    });

    await page.goto(`/technicians/${technician.id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar técnico');

    await page.waitForURL('**/technicians');
    api.untrack('technicians', technician.id);

    await searchFor(page, technician.fullName);
    await expect(page.getByRole('row').filter({ hasText: technician.fullName })).toHaveCount(0);
  });
});

/**
 * Technician conventions (see `backend/docs/business-rules/tickets.md`,
 * TKT-090..TKT-097).
 *
 * Split by where the rejection happens, the same way the vendor and device
 * suites are:
 *   - TKT-090, TKT-091, TKT-092 and TKT-093 are pre-validated by the form's own
 *     `validate()`, so those tests prove the client-side guard fires with real
 *     DOM interaction — no request is sent.
 *   - TKT-094, TKT-095, TKT-096 and TKT-097 are enforced by the backend only,
 *     so submitting always makes a real request; they pass only if the backend
 *     rejected it AND the frontend relayed and translated the real response.
 */
test.describe('technician conventions', () => {
  test('TKT-090: rejects a technician with no name', async ({ page }) => {
    await page.goto('/technicians/create');

    // Fill the phone so only the name check can fire, and so Playwright waits
    // out hydration before the evaluate() below.
    await field(page, 'Teléfono').fill(uniquePhone());

    // The input also carries HTML `required`, which makes the browser's own
    // constraint validation block the click before onSubmit — and therefore
    // validate() — ever runs. Strip it so this exercises the JS check.
    await page.evaluate(() =>
      document.querySelector('input[name="fullName"]')?.removeAttribute('required')
    );

    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    await expect(page.getByText('El nombre es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/technicians\/create$/);
  });

  test('TKT-091: accepts a name at the 150-character limit', async ({ page, api }) => {
    const name = uniqueName('tech').padEnd(150, 'x');
    expect(name).toHaveLength(150);

    await page.goto('/technicians/create');
    await field(page, 'Nombre Completo').fill(name);
    await field(page, 'Teléfono').fill(uniquePhone());
    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    await page.waitForURL(/\/technicians\/[0-9a-f-]{36}$/);
    api.track('technicians', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('TKT-091: rejects a name over the 150-character limit', async ({ page }) => {
    await page.goto('/technicians/create');

    // Wait out hydration before touching the DOM, then strip the maxlength that
    // would otherwise silently truncate to a legal 150 before validate() sees it.
    await field(page, 'Teléfono').fill(uniquePhone());
    await page.evaluate(() =>
      document.querySelector('input[name="fullName"]')?.removeAttribute('maxlength')
    );

    await field(page, 'Nombre Completo').fill(uniqueName('tech').padEnd(151, 'x'));
    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    await expect(page.getByText('El nombre no puede superar los 150 caracteres')).toBeVisible();
    await expect(page).toHaveURL(/\/technicians\/create$/);
  });

  test('TKT-092: rejects a technician with no phone', async ({ page }) => {
    await page.goto('/technicians/create');
    await field(page, 'Nombre Completo').fill(uniqueName('tech'));

    await page.evaluate(() =>
      document.querySelector('input[name="phone"]')?.removeAttribute('required')
    );

    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    await expect(page.getByText('El teléfono es requerido')).toBeVisible();
    await expect(page).toHaveURL(/\/technicians\/create$/);
  });

  test('TKT-093: rejects a malformed email', async ({ page }) => {
    await page.goto('/technicians/create');
    await field(page, 'Nombre Completo').fill(uniqueName('tech'));
    await field(page, 'Teléfono').fill(uniquePhone());

    // type="email" would block submission natively; this test is about the JS check.
    await page.evaluate(() =>
      document.querySelector('input[name="email"]')?.setAttribute('type', 'text')
    );
    await field(page, 'Email').fill('no-arroba.example.com');

    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    await expect(page.getByText('El email no tiene un formato válido')).toBeVisible();
    await expect(page).toHaveURL(/\/technicians\/create$/);
  });

  test('TKT-094: a new technician is active', async ({ page, api }) => {
    const name = uniqueName('tech');

    await page.goto('/technicians/create');
    await field(page, 'Nombre Completo').fill(name);
    await field(page, 'Teléfono').fill(uniquePhone());
    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    await page.waitForURL(/\/technicians\/[0-9a-f-]{36}$/);
    api.track('technicians', idFromUrl(page.url()));

    // Someone being added is someone about to be given work, so the backend
    // makes them active without being asked.
    await expect(page.getByText('Activo').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Desactivar' })).toBeVisible();
  });

  test('TKT-095: rejects a phone that already belongs to another technician', async ({ page, api }) => {
    const phone = uniquePhone();
    await api.create('technicians', { fullName: uniqueName('tech'), phone });

    await page.goto('/technicians/create');
    await field(page, 'Nombre Completo').fill(uniqueName('tech'));
    await field(page, 'Teléfono').fill(phone);
    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    // Nothing client-side knows about this collision, so this only passes if the
    // request reached the backend and the response came back translated.
    await expect(
      page.getByText('Ya existe un técnico con ese teléfono, email o cuenta de usuario.').first()
    ).toBeVisible();
    await expect(page).toHaveURL(/\/technicians\/create$/);
  });

  test('TKT-095: normalises the phone, so spacing does not dodge the collision', async ({ page, api }) => {
    const digits = String(Date.now()).slice(-9) + Math.floor(Math.random() * 10);
    await api.create('technicians', { fullName: uniqueName('tech'), phone: `+57${digits}` });

    await page.goto('/technicians/create');
    await field(page, 'Nombre Completo').fill(uniqueName('tech'));
    // Same number, punctuated differently. The backend normalises before
    // comparing, so it is still the same technician's phone.
    await field(page, 'Teléfono').fill(`+57 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`);
    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    await expect(
      page.getByText('Ya existe un técnico con ese teléfono, email o cuenta de usuario.').first()
    ).toBeVisible();
    await expect(page).toHaveURL(/\/technicians\/create$/);
  });

  test('TKT-096: rejects an email that already belongs to another technician', async ({ page, api }) => {
    const email = uniqueEmail();
    await api.create('technicians', { fullName: uniqueName('tech'), phone: uniquePhone(), email });

    await page.goto('/technicians/create');
    await field(page, 'Nombre Completo').fill(uniqueName('tech'));
    await field(page, 'Teléfono').fill(uniquePhone());
    await field(page, 'Email').fill(email);
    await page.getByRole('button', { name: 'Crear Técnico' }).click();

    await expect(
      page.getByText('Ya existe un técnico con ese teléfono, email o cuenta de usuario.').first()
    ).toBeVisible();
    await expect(page).toHaveURL(/\/technicians\/create$/);
  });

  test('TKT-097: refuses to delete a technician who has a ticket, and says to deactivate instead', async ({
    page,
    api,
  }) => {
    const technician = await api.create<{ id: string; fullName: string }>('technicians', {
      fullName: uniqueName('tech'),
      phone: uniquePhone(),
    });
    const customer = await api.create<{ id: string }>('customers', {
      fullName: uniqueName('customer'),
      phone: '3001112233',
    });
    await api.create('tickets', {
      title: uniqueName('ticket'),
      description: 'Arranged by an E2E test.',
      category: 'CONNECTIVITY',
      customerId: customer.id,
      technicianId: technician.id,
    });

    await page.goto(`/technicians/${technician.id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar técnico');

    // The backend's own count is what reaches the screen, and the message has to
    // point at deactivating — deleting would blank the technician on every
    // ticket they ever worked.
    await expect(page.getByText(/No se puede eliminar el técnico: tiene 1 ticket asociado/)).toBeVisible();
    await expect(page.getByText(/Desactívalo en su lugar/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/technicians/${technician.id}$`));
  });

  test('deactivating takes a technician out of the assignment picker', async ({ page, api }) => {
    const technician = await api.create<{ id: string; fullName: string }>('technicians', {
      fullName: uniqueName('tech'),
      phone: uniquePhone(),
    });

    await page.goto(`/technicians/${technician.id}`);
    await page.getByRole('button', { name: 'Desactivar' }).click();
    await confirmDialog(page, 'Desactivar técnico', 'Desactivar');

    await expect(page.getByText(/Este técnico está inactivo/)).toBeVisible();

    // The create form only offers active technicians, because the backend
    // refuses to assign work to anyone else.
    await page.goto('/tickets/create');
    const picker = field(page, 'Técnico');
    await picker.click();
    await picker.fill(technician.fullName);
    await expect(
      page.locator('[data-combobox-dropdown]').getByRole('option', { name: technician.fullName })
    ).toHaveCount(0);
  });
});
