import { Page } from '@playwright/test';
import { test, expect, uniqueName } from './fixtures/test';
import { ApiClient } from './fixtures/api';
import { confirmDialog, field, idFromUrl, selectCombobox } from './fixtures/helpers';

interface Ticket {
  id: string;
  code: number;
  title: string;
  status: string;
}

const uniquePhone = () =>
  `+57${String(Date.now()).slice(-9)}${Math.floor(Math.random() * 10)}`;

/** Today as 'YYYY-MM-DD' in local time — the same day the app defaults to. */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function arrangeCustomer(api: ApiClient) {
  return api.create<{ id: string; fullName: string; phone: string }>('customers', {
    fullName: uniqueName('customer'),
    phone: '3001112233',
  });
}

async function arrangeTechnician(api: ApiClient) {
  return api.create<{ id: string; fullName: string; phone: string }>('technicians', {
    fullName: uniqueName('tech'),
    phone: uniquePhone(),
  });
}

/** The label the assignment pickers render for a technician. */
const technicianOption = (t: { fullName: string; phone: string }) => `${t.fullName} — ${t.phone}`;

/** A ticket with whatever fields the test needs, always naming a customer. */
async function arrangeTicket(
  api: ApiClient,
  overrides: Record<string, unknown> = {},
  customerId?: string
): Promise<Ticket> {
  const customer = customerId ?? (await arrangeCustomer(api)).id;
  return api.create<Ticket>('tickets', {
    title: uniqueName('ticket'),
    description: 'Arranged by an E2E test.',
    category: 'CONNECTIVITY',
    customerId: customer,
    ...overrides,
  });
}

/** Drives a ticket to IN_PROGRESS through the API, for tests that start there. */
async function arrangeInProgress(api: ApiClient, technicianId: string): Promise<Ticket> {
  const ticket = await arrangeTicket(api, { technicianId });
  await api.post(`tickets/${ticket.id}/start`, {});
  return ticket;
}

const actionButton = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });

/**
 * Tickets: Create, Get, List, Update, Delete — all driven through the UI
 * against the real backend.
 */
test.describe('tickets', () => {
  test('creates a ticket and lands on its detail page', async ({ page, api }) => {
    const customer = await arrangeCustomer(api);
    const title = uniqueName('ticket');

    await page.goto('/tickets/create');
    await field(page, 'Asunto').fill(title);
    await page.locator('textarea[name="description"]').fill('Created by an E2E test.');
    await field(page, 'Categoría').selectOption('CONNECTIVITY');
    await selectCombobox(page, 'Cliente', `${customer.fullName} — ${customer.phone}`);
    await page.getByRole('button', { name: 'Crear Ticket' }).click();

    await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/);
    api.track('tickets', idFromUrl(page.url()));

    await expect(page.getByRole('heading', { name: new RegExp(title) })).toBeVisible();
  });

  test('shows an existing ticket on its detail page', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);

    await expect(page.getByRole('heading', { name: new RegExp(ticket.title) })).toBeVisible();
    await expect(page.getByText('Arranged by an E2E test.').first()).toBeVisible();
  });

  test('TKT-006: shows the sequential code, not the UUID', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);

    // The code is what a technician quotes on the phone, so it has to be on screen.
    await expect(page.getByRole('heading', { name: new RegExp(`#${ticket.code}`) })).toBeVisible();
    expect(ticket.code).toBeGreaterThan(0);
  });

  test('lists tickets and opens one from its row', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);

    await page.goto('/tickets');

    const row = page.getByRole('row').filter({ hasText: `#${ticket.code}` });
    await expect(row).toBeVisible();

    await row.click();
    await page.waitForURL(`**/tickets/${ticket.id}`);
  });

  test('edits the title and description', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);
    const newTitle = uniqueName('ticket-renamed');

    await page.goto(`/tickets/${ticket.id}`);
    await page.getByRole('button', { name: 'Editar' }).click();

    await field(page, 'Asunto').fill(newTitle);
    await page.locator('textarea[name="description"]').fill('Reworded by an E2E test.');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('heading', { name: new RegExp(newTitle) })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: new RegExp(newTitle) })).toBeVisible();
    await expect(page.getByText('Reworded by an E2E test.').first()).toBeVisible();
  });

  test('deletes a ticket', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await confirmDialog(page, 'Eliminar ticket');

    await page.waitForURL('**/tickets');
    api.untrack('tickets', ticket.id);

    await expect(page.getByRole('row').filter({ hasText: `#${ticket.code}` })).toHaveCount(0);
  });
});

/**
 * Ticket content rules (TKT-001..TKT-008).
 *
 * These are all pre-validated by the create form's own `validate()`, so no
 * request is sent — the tests prove the client-side guard fires with real DOM
 * interaction, the same way the vendor suite does. The "accepts" cases go the
 * whole way to the backend and confirm the record was really created.
 */
test.describe('ticket conventions', () => {
  test('TKT-004: rejects a ticket naming neither a customer nor a device', async ({ page }) => {
    await page.goto('/tickets/create');
    await field(page, 'Asunto').fill(uniqueName('ticket'));
    await page.locator('textarea[name="description"]').fill('No collaborator named.');
    await field(page, 'Categoría').selectOption('CONNECTIVITY');

    await page.getByRole('button', { name: 'Crear Ticket' }).click();

    // The complaint lands on both fields, because either one satisfies the rule.
    await expect(page.getByText('Indica al menos un cliente o un dispositivo')).toHaveCount(2);
    await expect(page).toHaveURL(/\/tickets\/create$/);
  });

  test('TKT-004: accepts a ticket naming only a device', async ({ page, api }) => {
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
    const device = await api.create<{ id: string; name: string }>('devices', {
      deviceModelId: model.id,
      name: uniqueName('device'),
      serialNumber: uniqueName('sn'),
    });
    const title = uniqueName('ticket');

    await page.goto('/tickets/create');
    await field(page, 'Asunto').fill(title);
    await page.locator('textarea[name="description"]').fill('An internal tower job has no customer.');
    await field(page, 'Categoría').selectOption('MAINTENANCE');
    await selectCombobox(page, 'Dispositivo', device.name);

    await page.getByRole('button', { name: 'Crear Ticket' }).click();

    await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/);
    api.track('tickets', idFromUrl(page.url()));
    await expect(page.getByRole('heading', { name: new RegExp(title) })).toBeVisible();
  });

  test('TKT-007: rejects a street with no municipality or neighborhood', async ({ page, api }) => {
    const customer = await arrangeCustomer(api);

    await page.goto('/tickets/create');
    await field(page, 'Asunto').fill(uniqueName('ticket'));
    await page.locator('textarea[name="description"]').fill('Partial address.');
    await field(page, 'Categoría').selectOption('INSTALLATION');
    await selectCombobox(page, 'Cliente', `${customer.fullName} — ${customer.phone}`);
    await field(page, 'Calle').fill('Cra 12 #4-55');

    await page.getByRole('button', { name: 'Crear Ticket' }).click();

    // A street with no municipality is not navigable, so the address is refused
    // whole rather than stored half-written.
    await expect(
      page.getByText('Una dirección necesita calle, municipio y barrio').first()
    ).toBeVisible();
    await expect(page).toHaveURL(/\/tickets\/create$/);
  });

  test('TKT-007: accepts a complete address', async ({ page, api }) => {
    const customer = await arrangeCustomer(api);
    const title = uniqueName('ticket');

    await page.goto('/tickets/create');
    await field(page, 'Asunto').fill(title);
    await page.locator('textarea[name="description"]').fill('Complete address.');
    await field(page, 'Categoría').selectOption('INSTALLATION');
    await selectCombobox(page, 'Cliente', `${customer.fullName} — ${customer.phone}`);
    await field(page, 'Calle').fill('Cra 12 #4-55');
    await field(page, 'Municipio').fill('Bello');
    await field(page, 'Barrio').fill('Niquía');
    await field(page, 'Referencia').fill('casa azul, portón negro');

    await page.getByRole('button', { name: 'Crear Ticket' }).click();

    await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/);
    api.track('tickets', idFromUrl(page.url()));

    // Confirms the backend stored the snapshot and handed it back whole.
    await expect(page.getByText('Cra 12 #4-55')).toBeVisible();
    await expect(page.getByText('casa azul, portón negro')).toBeVisible();
  });

  test('TKT-008: rejects a latitude with no longitude', async ({ page, api }) => {
    const customer = await arrangeCustomer(api);

    await page.goto('/tickets/create');
    await field(page, 'Asunto').fill(uniqueName('ticket'));
    await page.locator('textarea[name="description"]').fill('Half a coordinate pair.');
    await field(page, 'Categoría').selectOption('INSTALLATION');
    await selectCombobox(page, 'Cliente', `${customer.fullName} — ${customer.phone}`);
    await field(page, 'Calle').fill('Cra 12 #4-55');
    await field(page, 'Municipio').fill('Bello');
    await field(page, 'Barrio').fill('Niquía');
    await field(page, 'Latitud').fill('6.3373');

    await page.getByRole('button', { name: 'Crear Ticket' }).click();

    await expect(page.getByText('La latitud y la longitud van juntas')).toBeVisible();
    await expect(page).toHaveURL(/\/tickets\/create$/);
  });

  test('TKT-005: a new ticket opens unassigned', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);

    await expect(page.getByText('Abierto').first()).toBeVisible();
    await expect(page.getByText('Sin asignar.')).toBeVisible();
  });
});

/**
 * The status machine (TKT-009, TKT-010, TKT-040..TKT-046, TKT-070..TKT-077).
 *
 * Every one of these is enforced by the backend. The frontend's job is to never
 * offer a transition the backend would refuse, so most of these tests assert on
 * a button being *absent* — which is what makes the 409s unreachable by
 * clicking. Preconditions are arranged through the API and the assertion runs
 * in the browser.
 */
test.describe('ticket lifecycle', () => {
  test('TKT-070: assigning moves the ticket to Asignado', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);
    await actionButton(page, 'Asignar').click();

    await selectCombobox(page, 'Técnico', technicianOption(technician), page.getByRole('dialog'));
    await page.getByRole('dialog').getByRole('button', { name: 'Asignar', exact: true }).click();

    await expect(page.getByText('Asignado').first()).toBeVisible();
    await expect(page.getByText(technician.fullName).first()).toBeVisible();
  });

  test('TKT-040: an open ticket offers no "Iniciar trabajo"', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);

    // Nobody owns it yet, so there is no work to start.
    await expect(actionButton(page, 'Asignar')).toBeVisible();
    await expect(actionButton(page, 'Iniciar trabajo')).toHaveCount(0);
  });

  test('TKT-040: an assigned ticket offers "Iniciar trabajo"', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const ticket = await arrangeTicket(api, { technicianId: technician.id });

    await page.goto(`/tickets/${ticket.id}`);

    await expect(actionButton(page, 'Iniciar trabajo')).toBeVisible();
  });

  test('TKT-042: an open ticket offers no "Resolver"', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);

    // With nobody attached there is no one whose work the notes would describe.
    await expect(actionButton(page, 'Resolver')).toHaveCount(0);
  });

  test('TKT-072: a ticket in progress offers no reassignment', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const ticket = await arrangeInProgress(api, technician.id);

    await page.goto(`/tickets/${ticket.id}`);

    await expect(page.getByText('En progreso').first()).toBeVisible();
    // Someone is on site; swapping the technician now would lose who did what.
    await expect(actionButton(page, 'Reasignar')).toHaveCount(0);
    await expect(actionButton(page, 'Asignar')).toHaveCount(0);
    await expect(actionButton(page, 'Resolver')).toBeVisible();
  });

  test('TKT-043: resolving demands notes', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const ticket = await arrangeInProgress(api, technician.id);

    await page.goto(`/tickets/${ticket.id}`);
    await actionButton(page, 'Resolver').click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Resolver', exact: true }).click();

    await expect(page.getByText('Las notas de resolución son obligatorias')).toBeVisible();
    // The ticket is untouched — the dialog is still open.
    await expect(dialog).toBeVisible();
  });

  test('TKT-043: resolving with notes closes the ticket', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const ticket = await arrangeInProgress(api, technician.id);

    await page.goto(`/tickets/${ticket.id}`);
    await actionButton(page, 'Resolver').click();

    await page.locator('textarea[name="resolutionNotes"]').fill('Se reemplazó el conector.');
    await page.getByRole('dialog').getByRole('button', { name: 'Resolver', exact: true }).click();

    await expect(page.getByText('Se reemplazó el conector.')).toBeVisible();
    await expect(page.getByText('Este ticket está resuelto y no admite cambios.')).toBeVisible();
  });

  test('TKT-044: cancelling demands a reason', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);
    await actionButton(page, 'Cancelar ticket').click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Cancelar ticket', exact: true }).click();

    await expect(page.getByText('Indica el motivo de la cancelación')).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('TKT-009/TKT-045: a resolved ticket admits no changes at all', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const ticket = await arrangeTicket(api, { technicianId: technician.id });
    await api.post(`tickets/${ticket.id}/resolve`, { resolutionNotes: 'Fixed remotely.' });

    await page.goto(`/tickets/${ticket.id}`);

    // The whole action bar collapses to one sentence — no Cancelar, no
    // Reasignar, no Reprogramar, and no Editar on the details card.
    await expect(page.getByText('Este ticket está resuelto y no admite cambios.')).toBeVisible();
    await expect(actionButton(page, 'Cancelar ticket')).toHaveCount(0);
    await expect(actionButton(page, 'Reasignar')).toHaveCount(0);
    await expect(actionButton(page, 'Reprogramar')).toHaveCount(0);
    await expect(actionButton(page, 'Editar')).toHaveCount(0);
  });

  test('TKT-010: a cancelled ticket admits no changes at all', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);
    await api.post(`tickets/${ticket.id}/cancel`, { reason: 'Duplicado.' });

    await page.goto(`/tickets/${ticket.id}`);

    await expect(page.getByText('Este ticket está cancelado y no admite cambios.')).toBeVisible();
    await expect(page.getByText('Duplicado.')).toBeVisible();
    await expect(actionButton(page, 'Editar')).toHaveCount(0);
  });

  test('TKT-075: accepts a visit date in the past', async ({ page, api }) => {
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);
    await actionButton(page, 'Programar').click();

    // Work done off the books gets entered afterwards, so a past date is legal.
    await field(page, 'Fecha de la visita').fill('2020-03-05');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(page.getByText('5/3/2020')).toBeVisible();
  });

  test('TKT-077: an inactive technician is not offered when assigning', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    await api.put(`technicians/${technician.id}`, { isActive: false });
    const ticket = await arrangeTicket(api);

    await page.goto(`/tickets/${ticket.id}`);
    await actionButton(page, 'Asignar').click();

    const picker = field(page.getByRole('dialog'), 'Técnico');
    await picker.click();
    await picker.fill(technician.fullName);

    await expect(
      page.locator('[data-combobox-dropdown]').getByRole('option', { name: technician.fullName })
    ).toHaveCount(0);
  });
});

/**
 * The day sheet (TKT-076).
 *
 * The backend's ordering is the dispatcher's instruction, so the page renders
 * the list exactly as received. These tests assert on DOM order and on what the
 * sheet leaves out.
 */
test.describe('ticket day sheet', () => {
  test('TKT-076: renders the urgent job before the normal one', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const day = today();

    // Created normal-first, so passing cannot be an accident of insertion order.
    const normal = await arrangeTicket(api, {
      technicianId: technician.id,
      scheduledFor: day,
      priority: 'NORMAL',
    });
    const urgent = await arrangeTicket(api, {
      technicianId: technician.id,
      scheduledFor: day,
      priority: 'URGENT',
    });

    await page.goto(`/jornada?technicianId=${technician.id}&date=${day}`);

    await expect(page.getByText(`#${urgent.code}`)).toBeVisible();
    const codes = await page.locator('.font-mono', { hasText: /^#\d+$/ }).allInnerTexts();
    const urgentAt = codes.indexOf(`#${urgent.code}`);
    const normalAt = codes.indexOf(`#${normal.code}`);
    expect(urgentAt).toBeGreaterThanOrEqual(0);
    expect(normalAt).toBeGreaterThanOrEqual(0);
    expect(urgentAt).toBeLessThan(normalAt);
  });

  test('excludes a ticket scheduled for another day', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const ticket = await arrangeTicket(api, {
      technicianId: technician.id,
      scheduledFor: '2020-03-05',
    });

    await page.goto(`/jornada?technicianId=${technician.id}&date=${today()}`);

    await expect(page.getByText(`#${ticket.code}`)).toHaveCount(0);
  });

  test('excludes a ticket with no date at all', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const ticket = await arrangeTicket(api, { technicianId: technician.id });

    await page.goto(`/jornada?technicianId=${technician.id}&date=${today()}`);

    await expect(page.getByText(`#${ticket.code}`)).toHaveCount(0);
  });

  test('excludes another technician’s work', async ({ page, api }) => {
    const mine = await arrangeTechnician(api);
    const theirs = await arrangeTechnician(api);
    const day = today();
    const ticket = await arrangeTicket(api, { technicianId: theirs.id, scheduledFor: day });

    await page.goto(`/jornada?technicianId=${mine.id}&date=${day}`);

    await expect(page.getByText(`#${ticket.code}`)).toHaveCount(0);
  });

  test('an empty day says so rather than erroring', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);

    await page.goto(`/jornada?technicianId=${technician.id}&date=${today()}`);

    // A day with nothing on it is a 200 with an empty list, not a 404.
    await expect(page.getByText('Sin tareas programadas para este día.')).toBeVisible();
    await expect(page.getByText(technician.fullName).first()).toBeVisible();
  });

  test('resolving from the sheet drops the ticket off it', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    const day = today();
    const ticket = await arrangeTicket(api, { technicianId: technician.id, scheduledFor: day });

    await page.goto(`/jornada?technicianId=${technician.id}&date=${day}`);
    await expect(page.getByText(`#${ticket.code}`)).toBeVisible();

    await actionButton(page, 'Resolver').click();
    await page.locator('textarea[name="resolutionNotes"]').fill('Resuelto en sitio.');
    await page.getByRole('dialog').getByRole('button', { name: 'Resolver', exact: true }).click();

    await expect(page.getByText('Sin tareas programadas para este día.')).toBeVisible();
    await expect(page.getByText(`#${ticket.code}`)).toHaveCount(0);
  });
});

/**
 * The two contradicting filter pairs.
 *
 * `unassignedOnly` overrides `technicianId` and `openOnly` overrides `status`,
 * silently, on the backend. The list page makes each pair one control so the
 * combination cannot be expressed — these tests watch the outgoing request to
 * prove it.
 */
test.describe('ticket filter contradictions', () => {
  test('never sends both unassignedOnly and technicianId', async ({ page, api }) => {
    const technician = await arrangeTechnician(api);
    await page.goto('/tickets');

    const urls: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (url.includes('/api/tickets?') || url.endsWith('/api/tickets')) urls.push(url);
    });

    await field(page, 'Técnico').selectOption(technician.id);
    await expect(page.getByRole('table')).toBeVisible();
    await field(page, 'Técnico').selectOption('__unassigned__');
    await expect(page.getByRole('table')).toBeVisible();

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const params = new URL(url).searchParams;
      expect(!!(params.get('unassignedOnly') && params.get('technicianId'))).toBe(false);
    }
  });

  test('never sends both openOnly and status', async ({ page }) => {
    await page.goto('/tickets');

    const urls: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (url.includes('/api/tickets?') || url.endsWith('/api/tickets')) urls.push(url);
    });

    await field(page, 'Estado').selectOption('OPEN');
    await expect(page.getByRole('table')).toBeVisible();
    await field(page, 'Estado').selectOption('__open__');
    await expect(page.getByRole('table')).toBeVisible();

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      const params = new URL(url).searchParams;
      expect(!!(params.get('openOnly') && params.get('status'))).toBe(false);
    }
  });
});
