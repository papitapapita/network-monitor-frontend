# TODOs — Frontend

Same shape as the backend's `docs/TODOS.md`. Backend-owned work stays there; this file
is for items the frontend can land on its own.

## Priority 1 — UX

- [ ] **Flat device-model picker — vendor becomes a filter, not a prerequisite** — stop making the operator answer "which vendor?" before they can name the model they are holding
  - Today (`app/devices/create/page.tsx:246-312`): Fabricante is a required field, Modelo is `disabled` until it is answered, and the model list is `allDeviceModels.filter(m => m.vendorId === selectedVendorId)` (line 71). An operator who knows the model but not which vendor row it lives under is stuck on a question the system could answer itself
  - Target: one required **Modelo** combobox over the whole catalog, labeled `MikroTik — RB450G (ROUTER)`, sorted by vendor then model. Vendor demoted to an optional filter below it — no asterisk, drop `errors.selectedVendorId` from `validate()` (line 116), never gates the model field
  - Two-way sync so the vendor field reads as a lens rather than a dead input: picking a model auto-fills the vendor; changing the vendor narrows the list, collapses labels to `RB450G (ROUTER)` since the vendor is then implied, and clears the model if it belonged to another vendor
  - **`Combobox` needs token matching first — without it the flat list is worse than what we have.** Filtering is `label.toLowerCase().includes(query)` (`src/components/ui/Combobox.tsx:45`), so against `MikroTik — RB450G (ROUTER)` the query `mikrotik rb` matches nothing: the `— ` sits between the tokens. Split the query on whitespace, require every token somewhere in the label, fold accents. Then `rb450`, `mik rb4` and `ubnt router` all land, and typing two characters of the vendor *is* the vendor filter
  - **Fetch the whole catalog.** `listDeviceModels({ limit: 100 })` at `create/page.tsx:58` and `DeviceDetailsTab.tsx:76` silently truncates — the backend caps `limit` at 100 and offers no `search` or `vendorId` param (`BACKEND_API.md:653`), so every filter is client-side anyway. The vendor step hides the truncation today; a flat list exposes it. Extract `fetchAllModels` (`app/device-models/page.tsx:40`) into a shared `useDeviceModels()` on react-query key `['deviceModels']` — the key `InlineModelForm.tsx:68` already invalidates, so a freshly created model appears with no extra wiring. Same for vendors. This also retires the truncation workaround at `DeviceDetailsTab.tsx:65`
  - **Open decision — wireless categories.** `create/page.tsx:76` silently drops non-wireless models when the category is `WIRELESS_CPE` / `AP`. In a vendor-scoped list of six a disappearance is noticeable; in a flat list, typing `RB450G` and reading "Sin resultados" is baffling. Either (a) keep filtering and add a hint under the field, or (b) stop filtering — sort wireless-first, suffix the rest `· no inalámbrico`, and let the existing amber `wirelessMismatch` warning (line 288) do the blocking. (b) states the reason at the point of selection instead of by absence and costs nothing in `Combobox`, but permits an invalid selection until validate()
  - `InlineModelForm` takes `vendorId` as a required prop, so with no vendor filter set there is nothing to pass — it needs its own vendor combobox, prefilled from the filter when one is active. Worth pairing with having `Combobox` hand its current query to `onCreateNew`, so the model name is prefilled with what the operator just typed and failed to match
  - **Do `app/network-scan/page.tsx` in the same pass** — it is the same picker, half migrated already: flat labels at line 275, still `required` at 159 and `disabled` at 286. It benefits more than the create page, since it guesses the vendor from the MAC OUI (line 116) — that guess becomes a prefilled *filter* instead of an unverified required answer. Leaving the two forms divergent is how this drifts
  - Precedent: `DeviceDetailsTab.tsx:263` already does the flat single-combobox picker with `Vendor — Model (Type)` labels. The create page is the outlier, not the proposal
  - Optional, only if the flat list proves noisy in practice: vendor group headers in the dropdown (needs a `group` field on `ComboboxOption`), and a "recientes" section from the last few models used

## Priority 2 — Tickets

- [ ] **Tickets on the device and customer detail pages** — reach the work order from the thing it is about, not only the other way round
  - The ticket detail page already links out to `/devices/<id>`, `/customers/<id>` and `/technicians/<id>`; only the technician page links back. A device with a live ticket should say so on the page an operator is already looking at
  - Devices: a fifth tab in the hand-rolled tab bar in `app/devices/[id]/page.tsx` plus a `DeviceTicketsTab`, fed by `listTickets({ deviceId, openOnly: true })`. Deliberately deferred out of the tickets change: `src/components/devices/DeviceDetailsTab.tsx` and `deviceColumns.tsx` were carrying uncommitted work at the time and the new feature stayed off them
  - Customers: a "Tickets" card on `app/customers/[id]/page.tsx` alongside the contracted-services card, plus **Crear ticket** → `/tickets/create?customerId=<id>`
  - Both are read-only lists — the state machine stays on `/tickets/<id>`, where `TicketActions` lives

- [ ] **Role gating has no e2e coverage** — every write in the app is gated on `user.role`, and nothing tests it
  - Not specific to tickets, but tickets made it visible: `canWrite` hides the whole action bar for a VIEWER, and that is now the main thing the page does
  - The harness logs in once as `E2E_EMAIL` (an ADMIN) in `e2e/auth.setup.ts` and every project reuses that `storageState`, so there is no way to exercise a VIEWER or OPERATOR path
  - Needs a second setup project writing a second `storageState`, and seeded non-admin users to log in as

## Priority 2 — Devices

- [ ] **Mock service doesn't enforce DEV-066** — `mock-api.service.ts` never checks that `deviceModelId` names a real model
  - `createDevice` (`src/services/mock-api.service.ts:203-235`) writes the device through with whatever `deviceModelId` was submitted, no lookup against `deviceModels`. `updateDevice` (`:293-306`) is the same — a plain merge, no model check on the correction path either
  - Contrast with `createDeviceModel` (`:617`), which does check its `vendorId` FK the same way the real backend checks `deviceModelId`
  - Real backend enforces this since 2026-08-01 and it's covered end-to-end by `e2e/devices.spec.ts:1483` and `:1502` (create and correction paths) — but those tests run against the real backend only (`playwright.config.ts:5`, "Nothing is mocked"), so this gap is invisible to the suite
  - Effect: in mock mode (`NEXT_PUBLIC_USE_MOCK=true`), a dangling `deviceModelId` silently creates/updates a device instead of returning `Device model not found: <id>` — the friendly mapping in `device.constants.ts:188-191` ("El modelo seleccionado ya no existe") never triggers
  - Fix: add a `deviceModels.find(...)` guard to both, returning `err('Device model not found: <id>')` on a miss, matching `createDeviceModel`'s pattern

## Priority 2 — Credentials

- [ ] **Stop asking for SNMP credentials** — the form asks operators for secrets nothing in the system consumes
  - No collector reads them: `snmpCommunity` / `snmpV3AuthUser` reach storage and validation and stop there. All polling is ICMP ping plus AirOS HTTP
  - The backend half landed 2026-07-27 — `SetDeviceCredentialsUseCase` now treats HTTP-only as the normal path, with `httpUsername` + `httpPassword` as the required pair. **This is the only remaining half**
  - Hide the SNMP section in `src/components/devices/DeviceCredentialsTab.tsx` (~lines 340-370); make HTTP username + password the only required pair
  - Leave the form fields and submit plumbing in place rather than deleting them — the section gets re-enabled when the backend's "SNMP system metrics" (its Priority 3) lands
  - Safe to hide without data loss: the backend's `extractCreateData` carries stored SNMP values forward when a request omits them, so an HTTP-only save cannot wipe existing keys

---

## Blocked on backend

_Frontend work that cannot start until a backend endpoint exists. The parent items live in
`backend/docs/TODOS.md` and stay there — these are the consumer halves._

- [ ] **`DELETE /api/devices/:id` doesn't free its model or vendor** — a device is soft-deleted, not removed, so anything that ever owned one can never be deleted again
  - Repro: create a vendor, a device model under it, and a device on that model. `DELETE /api/devices/:id` → `204`, and a following `GET` on the same id correctly `404`s ("Device not found"). But the row still physically exists — `DELETE /api/device-models/:id` on its model then crashes with a raw `500`: `"Database error deleting device model: update or delete on table \"device_models\" violates RESTRICT setting of foreign key constraint \"devices_device_model_id_fkey\" on table \"devices\""`. The vendor delete then correctly reports `409` (still sees the model), so it's stuck too
  - `BACKEND_API.md:618` documents `DELETE /api/devices/:id` as "Permanently removes the device" — the soft delete contradicts the documented contract, and either way `device-models` DELETE should never surface a raw Postgres constraint message as a `500`
  - Found via `e2e/device-models.spec.ts` — DEV-026 and both DEV-027 tests create a device to exercise a delete-blocked path, then delete it and expect the model/vendor to clean up after. They can't: no API call can un-stick a model/vendor once any device, even a deleted one, has ever pointed at it. `npm run e2e:sweep` hits the same wall. As of 2026-08-11 this has stranded 6 vendor/device-model pairs that only a direct DB delete can remove (ids in the `e2e:sweep` output around 2026-08-12T02:10 and 02:14 UTC)
  - Needs a backend call: either devices hard-delete for real, or `device-models` DELETE explicitly counts (and reports) devices — including soft-deleted ones — as a clean `409` instead of letting the DB constraint throw

- [ ] **Alert stream listener** — subscribe to `/alerts/stream` to replace manual reload, reconnects on its own
  - Blocked on the backend's "Real-time alerts via SSE" (its Priority 2): endpoint + `clients` Set + broadcast at alert creation
  - Touches the alerts list and the alert detail page added in `ad5b652`
  - **The client transport already exists** — `openSseStream` (`src/services/sse.ts`), landed with the live throughput view. Reuse it: a new `apiService.stream*` method plus a hook is the whole job, and the connection indicator (`src/components/wireless/StreamStatus.tsx`) is not wireless-specific

- [ ] **Map refresh affordance** — show a "locations changed" prompt instead of making the operator reload
  - Blocked on the backend's "Live map refresh notification" (its Priority 2), which pushes a lightweight changed-signal only
  - On click, re-fetch `GET /api/locations/map` — the pin rendering itself does not change
  - Same transport as the alert listener above: `openSseStream`, not a second client

- [ ] **Link an alert to the ticket it opened** — the alert detail page should show "Ticket #42" when monitoring opened one
  - The link only exists in one direction today: a ticket carries `originAlertId`, and `/tickets/<id>` already renders "Ver alerta" from it. The reverse has no key to search on
  - Blocked on an `originAlertId` filter for `GET /api/tickets`. Without one, `/alerts/<id>` can only find its ticket by listing that device's tickets and scanning for a match client-side — bounded in practice, but a workaround that silently returns nothing once a device has more tickets than the page size
  - When it lands: a header line on `app/alerts/[id]/page.tsx`, plus a "Crear ticket" button deep-linking to `/tickets/create?deviceId=<id>` when no ticket exists yet (the create form already reads `customerId` / `deviceId` / `title` from the query string)

- [ ] **Free-text search over tickets** — the "Buscar" box on `/tickets` filters only the page already fetched
  - `GET /api/tickets` has no `search` parameter, and the list is server-paginated because tickets accumulate on their own. So the box narrows the current page and says so in its helper text
  - Blocked on a backend `search` over `code` and `title`. Until then, the rich filters are what actually reach the database

---

## Done

- [x] **Acciones rápidas en la barra de selección: sondear dispositivos y resolver tickets** — **done 2026-08-18**
  - `/devices` gained **Sondear** and `/tickets` gained **Resolver**, beside the existing delete. Neither endpoint takes a batch, so `BulkAction` grew `runOne` — a paced fan-out over the selection — alongside the existing whole-selection `run` the alerts list uses
  - `src/services/bulk-delete.ts` is now `bulk-fanout.ts` (`runBulkFanOut`): the pacing and 429 backoff were never delete-specific, and writes share the same 60/min per-user budget
  - Rows the action cannot touch are reported, not hidden: `BulkAction.skipRow` returns a reason, the confirmation says what it will leave alone ("Se omitirán 3 dispositivos: monitoreo deshabilitado"), and those rows stay selected afterwards. It is deliberately not `canDelete`, which gates the checkbox for *every* action on the table — an unmonitored device is still deletable
  - `BulkAction.prompt` renders one extra field in the confirmation, for the resolution notes `POST /tickets/:id/resolve` requires. One note for the whole selection is all the UI can offer, so the dialog says so and points at resolving separately when the work differed
  - Selection on `/tickets` moved from ADMIN-only to `canWrite`, with `deleteOne` kept behind `isAdmin` — resolving is OPERATOR work. Same shape `/alerts` already had
  - Verified against the real backend: 4 devices selected → "1 dispositivo sondeado · 3 sin cambios (monitoreo deshabilitado)"; 3 tickets → "2 tickets resueltos · 1 sin cambios (sin técnico o ya cerrados)". No e2e spec yet — the suite has no ticket coverage to hang it on

- [x] **Live throughput view** — consumer half of the backend's SSE streams — **done 2026-08-12**
  - `/wireless` reads `GET /api/wireless/throughput/stream` (fleet) and the wireless tab reads `GET /api/devices/:id/wireless/throughput/stream` (one radio). Covered by `e2e/wireless-throughput.spec.ts`
  - Read over `fetch` rather than `EventSource`, so the JWT stays in the `Authorization` header and the caller can tell a 404 ("never polled") from a 429 ("5 streams already open") — `EventSource` reports both as one anonymous error. Reconnect and `retry:` handling are reimplemented in `src/services/sse.ts` as the price
  - The 429 cap is easy to trip while navigating between two live views, so it auto-retries three times before it becomes something the operator is asked to fix
  - Not covered: the utilisation bar only renders for a STATION with `linkCapacityKbps` set, and no device in the dev database has one — the code path is unexercised in practice so far

- [x] **HTTP credential port defaults to 443** — `DeviceCredentialsTab.tsx:16,80` send 443, matching `DeviceCredentialsMapper.extractCreateData`. Backend residue (reject or log an explicit 80, migrate existing `http_port = 80` rows) stays in `backend/docs/TODOS.md`
- [x] **Sorting for IP addresses** — moved here from the backend's Done list, where it had been filed by mistake
