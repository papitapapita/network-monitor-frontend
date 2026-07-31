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

- [ ] **Alert stream listener** — `new EventSource('/alerts/stream')` to replace manual reload, reconnects on its own
  - Blocked on the backend's "Real-time alerts via SSE" (its Priority 2): endpoint + `clients` Set + broadcast at alert creation
  - Touches the alerts list and the alert detail page added in `ad5b652`

- [ ] **Map refresh affordance** — show a "locations changed" prompt instead of making the operator reload
  - Blocked on the backend's "Live map refresh notification" (its Priority 2), which pushes a lightweight changed-signal only
  - On click, re-fetch `GET /api/locations/map` — the pin rendering itself does not change
  - Whichever of these two lands first establishes the shared SSE client helper; the second should reuse it

---

## Done

- [x] **HTTP credential port defaults to 443** — `DeviceCredentialsTab.tsx:16,80` send 443, matching `DeviceCredentialsMapper.extractCreateData`. Backend residue (reject or log an explicit 80, migrate existing `http_port = 80` rows) stays in `backend/docs/TODOS.md`
- [x] **Sorting for IP addresses** — moved here from the backend's Done list, where it had been filed by mistake
