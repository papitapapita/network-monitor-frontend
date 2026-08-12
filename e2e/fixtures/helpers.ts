import { Page, Locator, expect } from '@playwright/test';

/**
 * Resolves a form field by its visible label.
 *
 * Two app conventions make plain `getByLabel()` unreliable:
 *   - required fields render as "Label *", so exact matching misses them;
 *   - substring matching is too loose ("Modelo" also hits "Modelo inalámbrico").
 *
 * Anchoring with an optional trailing asterisk handles both.
 */
export function field(scope: Page | Locator, label: string): Locator {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return scope.getByLabel(new RegExp(`^\\s*${escaped}\\s*\\*?\\s*$`));
}

/**
 * Picks an option from a `Combobox` the caller has already located.
 *
 * The component only renders its dropdown while focused, and the list is
 * portalled to <body> rather than nested under the field — so this focuses,
 * types to filter, then clicks the option wherever it landed in the DOM.
 *
 * Take this overload when the combobox carries no `label` prop of its own and
 * `field()` therefore cannot find it — the device form's location picker, for
 * one, labels itself with a plain <label> that points at nothing.
 */
export async function pickFromCombobox(
  page: Page,
  input: Locator,
  optionLabel: string
): Promise<void> {
  await input.click();
  await input.fill(optionLabel);

  const option = page.locator('[data-combobox-dropdown]').getByRole('option', { name: optionLabel, exact: true });
  await expect(option).toBeVisible();
  await option.click();

  // The input shows the chosen label once the dropdown closes.
  await expect(input).toHaveValue(optionLabel);
}

/** Picks an option from the `Combobox` carrying a given visible label. */
export async function selectCombobox(
  page: Page,
  label: string,
  optionLabel: string,
  scope: Page | Locator = page
): Promise<void> {
  await pickFromCombobox(page, field(scope, label), optionLabel);
}

/**
 * Confirms a ConfirmModal. Scoped to the dialog because the trigger button
 * usually carries the same label as the confirm button ("Eliminar").
 */
export async function confirmDialog(page: Page, title: string, confirmText = 'Eliminar'): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(title)).toBeVisible();
  await dialog.getByRole('button', { name: confirmText, exact: true }).click();
}

/**
 * Runs a UI action that creates a record, and returns what the backend sent
 * back. Use it when the page doesn't redirect to a detail URL, so the test
 * still learns the new id and can register it for cleanup.
 */
export async function captureCreate<T>(
  page: Page,
  resource: string,
  action: () => Promise<void>
): Promise<T> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith(`/${resource}`)
    ),
    action(),
  ]);
  const body = await response.json();
  return (body?.data ?? body) as T;
}

/** Pulls the trailing UUID off a detail-page URL, e.g. /vendors/<id>. */
export function idFromUrl(url: string): string {
  const id = url.split('?')[0].replace(/\/$/, '').split('/').pop();
  if (!id) throw new Error(`No id in URL: ${url}`);
  return id;
}

/**
 * Filters a list page via its "Buscar" box and waits for the row to show up.
 * List pages are paginated, so searching is the only reliable way to assert a
 * specific record is present.
 */
export async function searchFor(page: Page, term: string): Promise<void> {
  await field(page, 'Buscar').fill(term);
}
