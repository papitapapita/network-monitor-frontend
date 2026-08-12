# Backend API Reference

> **Purpose:** This file is the source of truth for the backend API when working on the frontend.  
> It is written for a Claude Code session in the frontend directory — paste it as context when you need endpoint details.  
> The backend lives at `/home/jonathan/Studies/projects/network-management-system/backend`.

---

## Base

| Key          | Value                   |
| ------------ | ----------------------- |
| Dev base URL | `http://localhost:3000` |
| API prefix   | `/api`                  |
| Content-Type | `application/json`      |

Most API responses are wrapped:

```ts
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }
```

> **Exceptions:** Credentials, Polling, and Wireless endpoints return **raw data** — no `{ success, data }` wrapper.  
> Their error responses use `{ error: string }` (no `success` field).

---

## Authentication

All endpoints except `POST /api/auth/login` require a valid JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

Missing or invalid tokens return `401`. Insufficient role returns `403`.

### Roles

| Role       | Allowed operations                                                      |
| ---------- | ----------------------------------------------------------------------- |
| `ADMIN`    | read, create, update, delete, activate, bulk-import, manage-credentials |
| `OPERATOR` | read, create, update, activate, bulk-import                             |
| `VIEWER`   | read only                                                               |

`manage-credentials` gates writes to `/api/devices/:id/credentials` only — those
endpoints carry device passwords and SNMP keys, so they are not covered by the
generic `update` permission. Reading them stays on `read` because the response is
masked.

### Rate limits (per authenticated user)

| Operation type                 | Limit     |
| ------------------------------ | --------- |
| Read (`GET`)                   | 100 / min |
| Write (`POST`, `PATCH`, `PUT`) | 60 / min  |
| Delete (`DELETE`)              | 60 / min  |
| Bulk import                    | 5 / hr    |

Counters are keyed by user id, falling back to IP for unauthenticated requests,
so operators sharing one office address do not share a budget. Each resource
has its own counter — 60 device deletes and 60 vendor deletes in the same minute
is fine. Exceeding a bucket returns `429` with `{ success: false, error: 'Too many requests' }`.

---

## Auth `/api/auth`

### `POST /api/auth/login` — Login

**Status:** 200 | 400 | 401  
**Auth required:** No

```ts
// Request body
{
  email: string     // required
  password: string  // required
}

// Response 200
{
  success: true,
  data: {
    token: string   // JWT — include as Bearer token on all subsequent requests
    user: {
      id: string    // UUID
      email: string
      role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
    }
  }
}
```

> Returns `401` for both wrong password and unknown email (identical error message — no credential enumeration).  
> Token expires after 24 hours; obtain a new one by logging in again.

---

## Enums

```ts
type LocationType =
  | 'TOWER'
  | 'DATACENTER'
  | 'POINT_OF_PRESENCE'
  | 'OFFICE'
  | 'CUSTOMER_PREMISES'
  | 'OTHER';
type DeviceStatus =
  | 'INVENTORY'
  | 'COMMISSIONING'
  | 'ACTIVE'
  | 'DAMAGED'
  | 'DECOMMISSIONED';
type DeviceCategory =
  | 'CPE'
  | 'WIRELESS_CPE'
  | 'ACCESS_POINT'
  | 'GATEWAY'
  | 'AGGREGATION_SWITCH'
  | 'OTHER';
type DeviceOwner = 'COMPANY' | 'CLIENT';
type DeviceType =
  | 'ANTENNA'
  | 'OTHER'
  | 'RADIO'
  | 'ROUTER'
  | 'ROUTERBOARD'
  | 'SERVER'
  | 'SWITCH';
type PollingStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED';
type BillStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
type DeviceOnlineStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN'; // UNKNOWN = not monitored / never polled — see "monitoring stopped"
type AlertSeverity = 'WARNING' | 'CRITICAL';
type AlertStatus = 'OPEN' | 'RESOLVED';
type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CANCELLED';
type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
type TicketCategory =
  | 'CONNECTIVITY'
  | 'INSTALLATION'
  | 'HARDWARE_FAILURE'
  | 'MAINTENANCE'
  | 'RELOCATION'
  | 'OTHER';
type TicketOrigin = 'MANUAL' | 'DEVICE_ALERT' | 'WIRELESS_ALERT';
```

> **`DeviceCategory` vs `DeviceType` — two different questions.**  
> `DeviceCategory` lives on the **device** and says _what role the unit plays in the network_: `ACCESS_POINT` serves subscribers, `WIRELESS_CPE` is the station end of that link, `GATEWAY` routes, `AGGREGATION_SWITCH` aggregates, `CPE` is customer equipment, `OTHER` is the escape hatch.  
> `DeviceType` lives on the **device model** and says _what kind of hardware it is_ (`ANTENNA`, `ROUTER`, `SWITCH`, …).  
> One box can be a `SWITCH` by type and an `AGGREGATION_SWITCH` by role — PoE, port count and so on are hardware traits and belong to the model, never to the category.
>
> **⚠ Breaking change (2026-07-29):** the category set changed, and a migration rewrote existing rows:
>
> | Old category       | New category         |                                                                                        |
> | ------------------ | -------------------- | -------------------------------------------------------------------------------------- |
> | `AP`               | `ACCESS_POINT`       | renamed for clarity                                                                    |
> | `ROUTERBOARD`      | `GATEWAY`            | the role is "where upstream internet enters"; `ROUTERBOARD` survives as a `DeviceType` |
> | `SMART_SWITCH`     | `AGGREGATION_SWITCH` | the node switch radios converge on                                                     |
> | `SMART_SWITCH_POE` | `AGGREGATION_SWITCH` | PoE is a hardware trait, not a role                                                    |
>
> `CPE`, `WIRELESS_CPE` and `OTHER` are unchanged. Any frontend picker, filter or badge map holding the old literals must be updated — sending an old value now returns `400`, and a device that used to read `SMART_SWITCH_POE` now reads `AGGREGATION_SWITCH`.
>
> **Since 2026-08-01, reading a device whose stored category is not one of the six fails with `500`** `"Data integrity violation: unrecognised DeviceCategory \"<value>\" in persistence store"`, instead of returning the stale value. A migrated database cannot reach this — the Postgres enum only permits the six — so if you see it, **your database is behind on migrations**; run them and retry rather than filing a bug. It applies to any endpoint that returns a device, `GET /api/devices` and `GET /api/locations/map` included.

---

## Shared Response Shapes

```ts
interface LocationDTO {
  id: string; // UUID
  name: string;
  type: LocationType;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

interface DeviceDTO {
  id: string; // UUID
  deviceModelId: string; // UUID
  locationId: string | null;
  status: DeviceStatus;
  category: DeviceCategory | null;
  ownerType: DeviceOwner | null;
  name: string;
  serialNumber: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  description: string | null;
  installedDate: string | null; // ISO 8601
  monitoringEnabled: boolean;
  createdAt: string;
  updatedAt: string;

  // Soft delete. Always null on anything you can fetch — a deleted device is
  // absent from every listing and 404s on GET. They are here because the
  // restore endpoint returns the record it just brought back.
  deletedAt: string | null; // ISO 8601
  deletedBy: string | null; // UUID of the user who deleted it

  // Replacement lineage. Both directions are readable; only one is stored.
  replacedAt: string | null; // when this unit took over from its predecessor
  replacesDeviceId: string | null; // the unit this one replaced
  replacedByDeviceId: string | null; // the unit that replaced this one
}

interface VendorDTO {
  id: string; // UUID
  name: string;
  slug: string; // URL-safe lowercase, e.g. "tp-link"
  description: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

interface DeviceModelDTO {
  id: string; // UUID
  vendorId: string; // UUID
  vendorName: string; // e.g. "MikroTik"
  vendorSlug: string; // e.g. "mikrotik"
  model: string;
  deviceType: DeviceType;
  isWireless: boolean; // hardware has a radio — gates wireless configs
  createdAt: string; // ISO 8601
  updatedAt: string;
}

interface PaginatedResponse<T> {
  // (field name varies — see each endpoint below)
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
```

---

## Locations `/api/locations`

### `POST /api/locations` — Create

**Status:** 201

```ts
// Request body
{
  name: string                 // required, 1–150 chars
  type: LocationType           // required
  municipality?: string | null // max 100 chars
  neighborhood?: string | null // max 150 chars
  address?: string | null      // max 255 chars
  latitude?: number | null     // -90 to 90  ← must pair with longitude
  longitude?: number | null    // -180 to 180
  altitude?: number | null
}

// Response
{ success: true, data: LocationDTO }
```

> latitude and longitude must always be provided together or both null/omitted.

---

### `GET /api/locations` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number   // 1–100, default 20
offset?: number   // ≥0, default 0
type?:   LocationType

// Response
{
  success: true,
  data: {
    locations: LocationDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/locations/map` — Map pins

**Status:** 200  
**Auth required:** Yes (any role)

Returns all locations that have coordinates, each with their nested devices. Intended for map rendering — one pin per location.

```ts
// Response
{
  success: true,
  data: {
    total: number       // number of pins returned
    pins: Array<{
      id: string            // location UUID
      name: string
      locationType: LocationType
      latitude: number      // never null — only geolocated locations included
      longitude: number
      altitude: number | null
      municipality: string | null
      neighborhood: string | null
      address: string | null
      devices: Array<{
        id: string
        name: string
        status: DeviceStatus
        category: DeviceCategory | null
        ipAddress: string | null
        macAddress: string | null
        monitoringEnabled: boolean
      }>
    }>
  }
}
```

> Locations without both `latitude` and `longitude` are excluded.  
> Devices are grouped under their location — no N+1 queries.  
> Use `locationType` to drive pin icon/colour on the frontend map.

---

### `GET /api/locations/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: LocationDTO }
```

---

### `DELETE /api/locations/:id` — Delete

**Status:** 204 | 400 | 404 | 409

```ts
// No request body
// Response: 204 No Content
```

> Returns 409 if any devices are assigned to this location — reassign or remove them first.  
> Returns 400 if the id is not a valid UUID v4, 404 if no location exists with that id.

---

### `PATCH /api/locations/:id` — Update

**Status:** 200 | 404

```ts
// Request body (all fields optional — send only what changes)
{
  name?: string
  type?: LocationType
  municipality?: string | null
  neighborhood?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  altitude?: number | null
}

// Response
{ success: true, data: LocationDTO }
```

---

## Devices `/api/devices`

### `POST /api/devices` — Create

**Status:** 201 | 400 | 404

```ts
// Request body
{
  deviceModelId: string        // required, UUID
  name: string                 // required, 1–150 chars
  ownerType?: DeviceOwner      // optional; omit or pass null → stored as null
  status?: DeviceStatus        // default: INVENTORY
  category?: DeviceCategory | null
  locationId?: string | null   // UUID
  serialNumber?: string | null // max 100 chars
  macAddress?: string | null   // format AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
  ipAddress?: string | null    // IPv4 or IPv6
  description?: string | null
  installedDate?: string | null // ISO 8601
  monitoringEnabled?: boolean  // default: false
}
```

**Business rules:**

- `deviceModelId` must name an existing device model — a well-formed UUID for a model that does not exist returns `404` with `Device model not found: <id>`
- `INVENTORY` / `DAMAGED` / `DECOMMISSIONED` status → at least one of `serialNumber` or `macAddress` required (status defaults to `INVENTORY`, so a minimal request must include at least one)
- `COMMISSIONING` status → `ipAddress` required; `monitoringEnabled` defaults to `true`, but an explicit `monitoringEnabled: false` in the same request is respected (staging a device without polling it yet is legitimate)
- `ACTIVE` status → `ipAddress` and `locationId` required
- `installedDate` must be ISO 8601 — `YYYY-MM-DD` or `YYYY-MM-DDThh:mm[:ss[.sss]]` with an optional `Z`/`±hh:mm` offset. Locale forms (`March 5, 2020`) and impossible dates (`2024-02-31`) are rejected, not reinterpreted

```ts
// Response
{ success: true, data: DeviceDTO }
```

---

### `GET /api/devices` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:            number          // 1–300, default 20
offset?:           number          // ≥0, default 0
status?:           DeviceStatus
category?:         DeviceCategory
owner?:            DeviceOwner
locationId?:       string          // UUID
deviceModelId?:    string          // UUID
monitoringEnabled?: 'true' | 'false'
deleted?:          'true' | 'false' | 'any'   // default: 'false' — see below
search?:           string          // free-text
sortBy?:           'createdAt' | 'updatedAt' | 'name' | 'status' | 'deletedAt'  // default: createdAt
sortOrder?:        'ASC' | 'DESC'  // default: DESC

// Response
{
  success: true,
  data: {
    devices: DeviceDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

> `total` is the number of devices matching the filters, not the number returned
> in `devices`. Filtered and unfiltered listings both paginate in the database,
> so page size bounds the work the query does.

**`deleted` — the recycle bin.** Soft-deleted devices are hidden from every
listing unless you ask for them:

| Value              | Returns                                          |
| ------------------ | ------------------------------------------------ |
| omitted or `false` | live devices only — unchanged from before        |
| `true`             | **deleted devices only** — this is the bin       |
| `any`              | both; the only way a tombstone and a live device share a page |

Bin rows carry `deletedAt` and `deletedBy`. Pair it with
`sortBy=deletedAt&sortOrder=DESC` for most-recently-deleted first. It combines
with every other filter, so `?deleted=true&owner=CLIENT` is a customer-scoped
bin.

Needs only the `read` permission — seeing the bin is not the same as acting on
it. Restoring takes `delete` (ADMIN), and so does emptying.

```
GET /api/devices?deleted=true&sortBy=deletedAt&sortOrder=DESC
```

---

### `GET /api/devices/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: DeviceDTO }
```

---

**Device status lifecycle:**

| Transition              | Requirements                                  | Side effects                                                                               |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| any → `COMMISSIONING`   | `ipAddress` must be set on the device         | `monitoringEnabled` turned on **unless** the same request sends `monitoringEnabled: false` |
| any → `ACTIVE`          | `ipAddress` and `locationId` must both be set | —                                                                                          |
| any → `DAMAGED`         | `serialNumber` or `macAddress` must be set    | monitoring stopped (see below)                                                             |
| any → `DECOMMISSIONED`  | `serialNumber` or `macAddress` must be set    | monitoring stopped (see below)                                                             |
| any → `INVENTORY`       | `serialNumber` or `macAddress` must be set    | monitoring stopped (see below)                                                             |

`DAMAGED` is a side-state (e.g. hardware failure) and can be set from any status.

**`INVENTORY`, `DAMAGED` and `DECOMMISSIONED` are the _retired_ statuses** — the
unit is off the network, so none of them polls and each needs an identifier you
can read off the box. They are also the only values
[`POST /api/devices/:id/replace`](#post-apidevicesidreplace--replace-hardware)
accepts for the outgoing unit.

> ⚠ **New status (2026-08-12): `DECOMMISSIONED`.** It means "retired for good" —
> as opposed to `DAMAGED` ("broken, still ours") and `INVENTORY` ("working,
> back in stock"). Add it to any status picker or filter. It existed before
> 2026-05-09, was removed, and is back because hardware replacement needs to
> distinguish an upgraded-but-working unit from a failed one. No existing row
> changed status: units remapped to `DAMAGED` in May stay `DAMAGED`.

> When transitioning to `DAMAGED` or `INVENTORY`, the backend stops monitoring the device automatically. There is no need to also send `monitoringEnabled: false`.

<a id="stopping-monitoring"></a>
**What "monitoring stopped" does (since 2026-08-03)**

Every route that stops monitoring performs the same transition — the status
change above, `PATCH /api/devices/:id` with `monitoringEnabled: false`, and
`POST`/`PATCH /api/devices/:id/polling/config` with `enabled: false`:

1. Polling stops. The polling config is **kept** (interval, failure threshold and IP survive), so re-enabling resumes with the same settings.
2. **`currentStatus` becomes `UNKNOWN`.** The last reading is not left standing — nothing will poll the device again to correct it, so presenting it as current would be a lie. `consecutiveFailures` resets to `0`, `lastPolled` / `nextScheduled` become `null`.
3. **`lastSeen` is kept**, so you can still show how stale the last real observation is.
4. Any **open `device_unreachable` alert is resolved**, and **no resolution notification is sent** — the device was not fixed, it just stopped being watched.
5. Ping history is untouched; only the 30-day retention purge removes it.

> **Frontend:** `UNKNOWN` no longer means only "never polled". It now also means
> "monitoring is off", which is the common case. Render it as a neutral/grey
> "not monitored" state rather than a warning — and read `pollingEnabled` to tell
> the two apart: `pollingEnabled: false` → paused; `pollingEnabled: true` with
> `UNKNOWN` → enabled but not yet polled.
>
> On re-enabling, the device is picked up on the next scheduler tick (≤10 s) and
> the first result does **not** raise a spurious "recovered" alert.

---

### `PATCH /api/devices/:id` — Update

**Status:** 200 | 404

```ts
// Request body (all fields optional — send only what changes)
{
  name?: string
  deviceModelId?: string       // UUID — INVENTORY devices only, see below
  status?: DeviceStatus
  category?: DeviceCategory | null
  ownerType?: DeviceOwner
  locationId?: string | null
  serialNumber?: string | null
  macAddress?: string | null
  ipAddress?: string | null
  description?: string | null
  installedDate?: string | null  // ISO 8601; null clears it
  monitoringEnabled?: boolean
}

// Response
{ success: true, data: DeviceDTO }
```

`installedDate` follows the same ISO 8601 rule as create — locale forms and
impossible calendar dates are rejected rather than reinterpreted.

**`deviceModelId` — correcting a mis-registered model**

Changing the model is a **data-entry correction**, not a way to record a hardware
replacement. It is accepted **only while the device's status is `INVENTORY`** —
the one status in which the unit has never been polled, so no collected metric
can end up attributed to the wrong hardware.

- Device is `ACTIVE`, `COMMISSIONING`, `DAMAGED` or `DECOMMISSIONED` → `400` `"Cannot change the device model of a device with status <status> — only an INVENTORY device may have its model corrected"`
- Target model does not exist → `404` `"Device model not found: <id>"`
- Sending the model the device **already has** is a no-op that succeeds in any
  status — so a UI that PATCHes the whole form back is safe.
- A single request may both correct the model and move the device out of
  `INVENTORY` (e.g. `{ deviceModelId, ipAddress, status: 'COMMISSIONING' }`) —
  the correction is applied first.

> **Frontend:** show the model picker as editable only on `INVENTORY` devices; on
> any other status render it read-only. Replacing a unit with different hardware
> is not this endpoint — a device is one physical box, and its metric history
> belongs to that box. Use
> [`POST /api/devices/:id/replace`](#post-apidevicesidreplace--replace-hardware),
> which creates the new unit, links the two, and carries the IP, credentials and
> contracted service across. **(Changed 2026-08-12 — this used to say the path
> did not exist. Stop telling operators to retire and re-create by hand.)**

**`category` — frozen while a wireless config exists**

The device's category decides the radio mode of its wireless config, and that
mode is derived **once**, when the config is created. So while a config exists,
the category is locked:

- Device has a wireless config and the request changes `category` (to another
  value **or** to `null`) → `400` `"Cannot change the category of a device that has a wireless config. Delete the wireless config first, then recategorise the device."`
- Sending the category the device **already has** is not a change and succeeds.
- Every other field on the same request is unaffected — only `category` is
  blocked.
- No wireless config → `category` is freely editable.

To recategorise a device that has one, `DELETE /api/devices/:id/wireless/config`
first, then PATCH the category, then create the config again. The refusal
happens before anything is written, so a rejected request changes nothing.

> **Frontend:** on a device that has a wireless config, render the category
> field read-only and point the operator at the wireless config screen. A UI that
> PATCHes the whole form back unchanged is safe — same value is a no-op.

**Field combinations are validated as one end state**

A `PATCH` describes the state you want the device to end up in, and the whole
combination is checked at once — so any request that describes a legal end state
succeeds, whatever mix of fields it carries:

```ts
// Commission a device sitting in inventory — one request
PATCH /api/devices/:id  { ipAddress: '10.0.0.5', status: 'COMMISSIONING' }

// Install and activate — one request
PATCH /api/devices/:id  { locationId: '…', status: 'ACTIVE' }

// Retire: pull it off site and back to the shelf — one request
PATCH /api/devices/:id  { locationId: null, status: 'INVENTORY' }
```

Requests are all-or-nothing: if the resulting state would break a rule, the
response is `400` and **nothing is applied** — you never end up with a device
that got its location but not its status.

> The rules still hold on the end state, not on the individual fields. `{ status: 'ACTIVE' }`
> alone on a device with no location is still `400` "An ACTIVE device must have a
> location assigned" — supply the location in the same request and it succeeds.

---

### `DELETE /api/devices/:id` — Delete (soft)

**Status:** 204 | 400 | 404

```ts
// No request body

// Response: 204 No Content (no body)
```

**Since 2026-08-12 this is a soft delete.** The device disappears from every
read path immediately — `GET /api/devices/:id` returns `404`, listings omit it
and do not count it in `total` — but the row and all its collected history
(pings, alerts, wireless snapshots, credentials) survive for a **7-day grace
period**. Within that window
[`POST /api/devices/:id/restore`](#post-apidevicesidrestore--restore-a-deleted-device)
brings it back. After it, a daily job removes the row permanently and everything
hanging off it goes with it.

**Business rules:**

- The device must exist and not already be deleted → otherwise `404` `"Device not found: <id>"`. Deleting twice still fails; the second call cannot see the first one's tombstone
- A **live contracted service** blocks the delete → `400` `"Cannot delete a device with a live contracted service (status <status>). Cancel the service first."`. Any status except `CANCELLED` counts as live, so `PENDING`, `ACTIVE` and `SUSPENDED` all block
- **Open tickets** block the delete → `400` `"Cannot delete a device with <N> open ticket(s). Resolve or cancel them first."`. `RESOLVED` and `CANCELLED` tickets do not block
- Monitoring is turned off automatically — see [stopping monitoring](#stopping-monitoring). There is no need to also send `monitoringEnabled: false`
- The device's MAC and IP addresses are **released immediately** and can be reassigned to another device, without waiting for the grace period to lapse
- `400` if the id is not a valid UUID v4

> **Frontend:** the two guards are the ones worth surfacing well — both are `400`
> with an actionable sentence naming what is in the way. Neither is a validation
> error the user can fix in the delete dialog; both need them to go elsewhere
> first (cancel the service, close the tickets). Consider offering a link rather
> than just the message.
>
> **Build a recycle-bin view, not an undo toast.** `GET /api/devices?deleted=true`
> lists everything in the bin with `deletedAt` and `deletedBy`; from there
> `POST /:id/restore` puts one back and `DELETE /:id/purge` removes it for good.
> Nothing needs to hold onto an id after the delete. A toast with an inline undo
> is still a nice touch, but it is no longer the only way back.

---

### `POST /api/devices/:id/restore` — Restore a deleted device

**Status:** 200 | 400 | 403 | 404

```ts
// No request body

// Response
{ success: true, data: DeviceDTO }
```

Undoes a soft delete. Requires the **`delete`** permission (ADMIN only) —
restoring is the inverse of deleting, so the same authority governs both.

**Business rules:**

- Only inside the grace period → past it, `400` `"Cannot restore a device whose 7-day grace period expired"`. There is no recovery after that; the row is gone or about to be
- The device must actually be deleted → otherwise `400` `"Cannot restore a device that is not deleted"`
- Unknown id → `404` `"Device not found: <id>"`
- **Monitoring stays off.** The restored device comes back with `monitoringEnabled: false` regardless of what it had before

> **Frontend:** the restored device is not polling. If the user expects it back
> in service, they need a second action — `PATCH { monitoringEnabled: true }`,
> plus a status change if it was retired. Say so in the success message rather
> than letting them discover it from a grey status pill later.

---

### `DELETE /api/devices/:id/purge` — Empty the bin (permanent)

**Status:** 204 | 400 | 403 | 404

```ts
// No request body

// Response: 204 No Content (no body)
```

Removes a device that is **already in the recycle bin**, now, instead of
waiting out the grace period. Requires the **`delete`** permission (ADMIN).

This is the same destruction the nightly retention job performs, on demand.
Every ping result, alert, wireless snapshot, credential and polling
configuration belonging to the device goes with it. **There is no undo.**

**Business rules:**

- The device must already be soft-deleted → otherwise `400` `"Cannot permanently delete a device that is not in the recycle bin. Delete it first."`. This is deliberate: routing everything through `DELETE /api/devices/:id` first is what guarantees the live-contracted-service and open-ticket guards were applied
- Unknown id → `404` `"Device not found: <id>"`
- `400` if the id is not a valid UUID v4

> **Frontend:** this is the destructive twin of restore, so treat it that way —
> a confirmation step naming the device, and wording that says the history goes
> too. "Empty the whole bin" is this call per device; there is no bulk endpoint
> yet, and the `delete` rate limiter allows 60/minute, so a very large bin needs
> throttling or a bulk endpoint (ask the backend for one if you hit it).
---

### `POST /api/devices/:id/replace` — Replace hardware

**Status:** 201 | 400 | 403 | 404

`:id` is the unit **being replaced**. Use this whenever a physical box is swapped
for a different one — a failure, or an upgrade. It is not
`PATCH { deviceModelId }`: a device record is one physical unit, and every
metric hangs off its id, so editing the model in place would retroactively
re-attribute months of readings to hardware that never produced them.

Requires the **`activate`** permission (ADMIN and OPERATOR).

```ts
// Request body
{
  deviceModelId: string   // required, UUID — the replacement's model
  retiredStatus: string   // required, INVENTORY | DAMAGED | DECOMMISSIONED
  name?: string           // defaults to the retired unit's name
  serialNumber?: string   // at least one of serialNumber / macAddress required
  macAddress?: string
  description?: string
  installedDate?: string  // ISO 8601, defaults to now
}
```

```ts
// Response
{
  success: true,
  data: {
    retiredDevice: DeviceDTO
    newDevice: DeviceDTO
    wirelessConfigRemoved: boolean
    credentialsTransferred: boolean
    contractedServiceTransferred: boolean
  }
}
```

**What it does, in one call:**

1. Retires `:id` into `retiredStatus` and **releases its IP address**
2. Creates a new device on `deviceModelId`, inheriting the retired unit's
   **location, category and owner**, and taking over the released IP.
   It starts in `COMMISSIONING` if it inherited an address, `INVENTORY` if not
3. Links the two — `newDevice.replacesDeviceId` and
   `retiredDevice.replacedByDeviceId`
4. Moves `DeviceCredentials` onto the new unit
5. Re-points the customer's `ContractedService` at the new unit
6. Deletes the retired unit's wireless config **if the new model is not
   wireless** — reported as `wirelessConfigRemoved`

**Business rules:**

- `retiredStatus` is **required** and must be one of `INVENTORY`, `DAMAGED`, `DECOMMISSIONED` → otherwise `400`. This is deliberately the caller's choice: a swap is not always a failure. An upgraded antenna that still works belongs back in `INVENTORY`; a failed one is `DAMAGED`; an obsolete one is `DECOMMISSIONED`
- At least one of `serialNumber` / `macAddress` → otherwise `400` `"The replacement device must have at least a serial number or MAC address"`. It is a different physical box with its own
- A device can be replaced **at most once** → `400` `"Device has already been replaced"`. To model a chain of swaps, replace the most recent unit
- A deleted device cannot be replaced → `404` (it is invisible to reads)
- Unknown `deviceModelId` → `404` `"Device model not found: <id>"`. Nothing is retired when this fails

> **Frontend:** the retired unit keeps all of its history and the new one starts
> empty — that is the point. A device detail page can follow
> `replacesDeviceId` / `replacedByDeviceId` to offer "previous unit" /
> "current unit" navigation, which is what makes "this CPE, current box since
> March" answerable.
>
> Surface `wirelessConfigRemoved: true` prominently — it means wireless
> monitoring for that site has stopped because the new hardware has no radio,
> and nothing will re-create the config automatically.
---

## Device Credentials `/api/devices/:id/credentials`

> **Response envelope:** Credentials endpoints return raw data directly — **no `{ success, data }` wrapper**.  
> Success: the DTO object directly (or 204 No Content).  
> Error: `{ error: string }`.

Sensitive fields (`snmpCommunity`, `snmpV3AuthKey`, `snmpV3PrivKey`, `httpPassword`) are **never returned in plaintext** — they are always masked as `'***'` in responses.

```ts
interface DeviceCredentialsResponseDTO {
  deviceId: string; // UUID
  snmpVersion: 1 | 2 | 3;
  snmpCommunity: '***' | null; // masked; null if not set
  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;
  snmpV3AuthKey: '***' | null; // masked; null if not set
  snmpV3PrivProto: 'DES' | 'AES' | null;
  snmpV3PrivKey: '***' | null; // masked; null if not set
  snmpPort: number; // default 161
  httpUsername: string | null;
  httpPassword: '***' | null; // masked; null if not set
  httpPort: number; // default 443
  hasSnmpCredentials: boolean; // true if the effective SNMP secret is present
  hasHttpCredentials: boolean; // true if both httpUsername and httpPassword are set
}
```

---

### `PUT /api/devices/:id/credentials` — Set Credentials

**Status:** 200 | 400 | 403 | 404  
**Roles:** ADMIN (`manage-credentials`)

Upserts the credentials for the device. **HTTP credentials are the required pair** and are replaced on every call.

The SNMP fields are optional and **nothing polls them today** — all polling is ICMP ping plus AirOS HTTP. They stay in the contract for the future "SNMP system metrics" work, so clients should simply omit them: an omitted SNMP field keeps whatever is stored, and only an explicit `null` clears it.

```ts
// Request body
{
  // HTTP / web-UI credentials — required
  httpUsername: string
  httpPassword: string
  httpPort?: number   // 1–65535; default 443

  // SNMP — optional, not consumed by any collector yet.
  // Omit to keep the stored value; send null to clear it.
  snmpVersion?: 1 | 2 | 3        // required as soon as any SNMP field is sent

  // SNMP v1/v2 fields
  snmpCommunity?: string | null  // required when snmpVersion = 1 or 2

  // SNMP v3 fields
  snmpV3AuthUser?: string | null   // required when snmpVersion = 3
  snmpV3AuthProto?: 'MD5' | 'SHA' | null  // required when snmpVersion = 3
  snmpV3AuthKey?: string | null    // required when snmpVersion = 3
  snmpV3PrivProto?: 'DES' | 'AES' | null  // optional privacy protocol
  snmpV3PrivKey?: string | null    // required when snmpV3PrivProto is set

  snmpPort?: number   // 1–65535; default 161
}

// Response — DeviceCredentialsResponseDTO (raw, no wrapper)
```

**Business rules:**

- `httpUsername` and `httpPassword` are both required; neither may be blank.
- SNMP validation runs only when the request carries an SNMP field:
  - `snmpVersion` is required as soon as any other SNMP field is sent.
  - `snmpVersion = 1` or `2` → `snmpCommunity` is required.
  - `snmpVersion = 3` → `snmpV3AuthUser`, `snmpV3AuthProto`, and `snmpV3AuthKey` are required.
  - `snmpV3PrivKey` is required when `snmpV3PrivProto` is provided.
- Port values must be in range 1–65535.
- Returns 404 if the device does not exist.

---

### `GET /api/devices/:id/credentials` — Get Credentials

**Status:** 200 | 404  
**Roles:** ADMIN, OPERATOR, VIEWER (`read` — the response is masked)

```ts
// Response — DeviceCredentialsResponseDTO (raw, no wrapper)
```

> Returns 404 with `{ error: 'No credentials configured for this device' }` if no credentials have been saved yet.

---

### `DELETE /api/devices/:id/credentials` — Delete Credentials

**Status:** 204 | 403 | 404  
**Roles:** ADMIN (`manage-credentials`)

```ts
// No request body
// Response: 204 No Content
```

> Removes all stored credentials for the device. Returns 404 if the device does not exist.

---

## Vendors `/api/vendors`

### `POST /api/vendors` — Create

**Status:** 201 | 400 | 409

```ts
// Request body
{
  name: string              // required, 1–100 chars
  slug: string              // required, 1–100 chars, lowercase letters/digits/hyphens only (e.g. "tp-link")
  description?: string | null  // max 500 chars
}

// Response
{ success: true, data: VendorDTO }
```

> Returns 409 if a vendor with the same slug **or the same name** already
> exists. Name comparison is exact — `Ubiquiti` and `ubiquiti` are two names,
> but their slugs would collide, so the pair is still rejected.

---

### `GET /api/vendors` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number  // 1–100, default 20
offset?: number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    vendors: VendorDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/vendors/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: VendorDTO }
```

---

### `PUT /api/vendors/:id` — Update

**Status:** 200 | 400 | 404 | 409

```ts
// Request body (at least one field required)
{
  name?: string
  slug?: string
  description?: string | null
}

// Response
{ success: true, data: VendorDTO }
```

> Returns 409 if the new slug or the new name is already taken by another
> vendor. Submitting the vendor's own slug or name is not a conflict.

---

### `DELETE /api/vendors/:id` — Delete

**Status:** 204 | 404 | 409

```ts
// No request body
// Response: 204 No Content
```

> Returns 409 if the vendor has associated device models. Remove all device models first.

---

## Device Models `/api/device-models`

### `POST /api/device-models` — Create

**Status:** 201 | 400 | 409

```ts
// Request body
{
  vendorId: string    // required, UUID
  model: string       // required, 1–150 chars
  deviceType: DeviceType  // required
  isWireless?: boolean    // default false
}

// Response
{ success: true, data: DeviceModelDTO }
```

> Returns 409 if a model with the same name already exists for that vendor.
> `isWireless` marks the hardware as radio-capable; devices built on a model
> with `isWireless: false` are refused a wireless config. Getting it wrong here
> is cheap to fix later — but only until a device on the model is configured,
> see `PUT /api/device-models/:id`.

---

### `GET /api/device-models` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number  // 1–100, default 20
offset?: number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    deviceModels: DeviceModelDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/device-models/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: DeviceModelDTO }
```

---

### `PUT /api/device-models/:id` — Update

**Status:** 200 | 400 | 404 | 409

```ts
// Request body (at least one field required)
{
  vendorId?: string    // UUID
  model?: string       // 1–150 chars
  deviceType?: DeviceType
  isWireless?: boolean
}

// Response
{ success: true, data: DeviceModelDTO }
```

**`isWireless: true → false` — refused while wireless configs exist**

Turning the flag off is blocked while **any** device built on this model still
has a wireless polling config (DEV-027) — those configs hold operator-entered
values (`linkCapacityKbps` / `clientsProvisionedLimit`) that a non-wireless
model has nowhere to keep, so they are never deleted for you:

- One or more devices on the model have a config → `409`
  `"Cannot mark device model as non-wireless: N device(s) built on it have a wireless config. Delete those wireless configs first."`
- Devices on the model with **no** config do not block it — the check is about
  configs, not devices, and not about their `category`.
- The refusal is all-or-nothing: no other field of the same request is applied,
  and the model stays wireless.
- Resubmitting the value the model already has is a no-op and always succeeds.

To make the model non-wireless, `DELETE /api/devices/:id/wireless/config` on
each listed device first, then send `isWireless: false`.

> The reverse (`false → true`) checks nothing and creates nothing — each config
> is created through `POST /api/devices/:id/wireless/config`.
>
> **Frontend:** the `N` in the message is the number of configs to clear. On a
> `409`, list the model's devices (`GET /api/devices?deviceModelId=…`) and point
> the operator at their wireless config screens rather than retrying.
>
> **Note:** devices already categorised `WIRELESS_CPE` / `ACCESS_POINT` keep that
> category when a model is made non-wireless. That combination is inert and
> legal — no config can be created for it — so don't treat it as an error state
> in the UI.

---

### `DELETE /api/device-models/:id` — Delete

**Status:** 204 | 404 | 409

```ts
// No request body
// Response: 204 No Content
```

> Returns 409 if devices are assigned to this model. Reassign or remove those devices first.

---

## Polling `/api/devices/:id/polling/*`

> **Response envelope:** Polling endpoints return **raw data** — no `{ success, data }` wrapper.  
> Error: `{ error: string }`.

### `POST /api/devices/:id/poll` — Trigger Manual Poll

**Status:** 200 | 404 | 409

```ts
// No request body needed

// Response
{
  deviceId: string
  status: PollingStatus
  message: string
  timestamp: string           // ISO 8601
  metrics: { latencyMs: number } | null
  deviceStatus: DeviceOnlineStatus
}
```

> **⚠ Since 2026-08-03: a device whose monitoring is off cannot be polled on
> demand.** It returns `409` `"Monitoring is disabled for device <id> — enable
monitoring before polling it"`. A manual poll would write a real reading over
> the `UNKNOWN` state with nothing scheduled to correct it afterwards, and could
> raise an outage alert for a device nobody is watching.
>
> **Frontend:** disable the "poll now" button when `pollingEnabled` is `false`
> (from `GET /api/devices/:id/polling/status`) rather than letting the call fail;
> on a `409`, offer "enable monitoring" instead of a retry.

---

### `GET /api/devices/:id/polling/status` — Current Status

**Status:** 200 | 404

```ts
// Response
{
  deviceId: string
  pollingEnabled: boolean
  intervalSeconds: number
  failuresBeforeDown: number
  lastPolled: string | null          // ISO 8601
  nextScheduled: string | null       // lastPolled + intervalSeconds
  currentStatus: DeviceOnlineStatus
  consecutiveFailures: number
  lastResult: {
    id: string
    deviceId: string
    timestamp: string
    status: 'SUCCESS' | 'FAILED'
    metrics: { latencyMs: number } | null
    deviceStatus: DeviceOnlineStatus
  } | null
}
```

> `currentStatus: 'UNKNOWN'` means **nobody is watching this device** — either it
> has never been polled, or monitoring was turned off (see
> [What "monitoring stopped" does](#stopping-monitoring)). It is not an outage;
> `'OFFLINE'` is. Use `pollingEnabled` to distinguish the two causes.
>
> While monitoring is off, `lastPolled` and `nextScheduled` are `null` and
> `consecutiveFailures` is `0`, but `lastResult` still shows the last ping that
> was actually taken — useful for "last checked N days ago" copy.

---

### `GET /api/devices/:id/polling/history` — History + Stats

**Status:** 200

```ts
// Query params (all optional)
fromDate?: string   // ISO 8601 with offset, e.g. "2024-01-01T00:00:00-05:00"
toDate?:   string
status?:   string   // comma-separated: "SUCCESS,FAILED"
limit?:    number   // 1–1000
offset?:   number   // ≥0

// Response
{
  deviceId: string
  results: Array<{
    id: string
    deviceId: string
    timestamp: string
    status: 'SUCCESS' | 'FAILED'
    metrics: { latencyMs: number } | null
    deviceStatus: DeviceOnlineStatus
  }>
  totalCount: number
  statistics: {
    successRate: number        // 0–100 %
    averageResponseTime: number // ms
    minResponseTime: number
    maxResponseTime: number
    uptimePercentage: number   // 0–100 %
  }
}
```

---

### `POST /api/devices/:id/polling/config` — Create / Upsert Polling Config

**Status:** 201 | 400 | 404

```ts
// Request body (all fields optional)
{
  ipAddress?: string | null        // IPv4 or IPv6; null clears it
  intervalSeconds?: number         // 1–86400; default: system default
  failuresBeforeDown?: number      // 1–100;   default: system default
  enabled?: boolean                // default: true
}

// Response
{
  id: string               // UUID
  deviceId: string         // UUID
  ipAddress: string | null
  intervalSeconds: number
  failuresBeforeDown: number
  enabled: boolean
}
```

> Creates the polling config if none exists, or updates the existing one (upsert). The device must exist.  
> Sending `enabled: false` performs the full stop-monitoring transition — see [What "monitoring stopped" does](#stopping-monitoring).

---

### `PATCH /api/devices/:id/polling/config` — Configure Polling

**Status:** 204 (no body) | 400 | 404

```ts
// Request body (at least one field required)
{
  intervalSeconds?: number    // 1–86400
  failuresBeforeDown?: number // ≥1
  enabled?: boolean
}

// Response: 204 No Content on success
```

> `enabled: false` performs the full stop-monitoring transition — see
> [What "monitoring stopped" does](#stopping-monitoring). Other fields in the same
> request (`intervalSeconds`, `failuresBeforeDown`) are still applied and kept.  
> `enabled: true` re-enables polling; it requires the config to have an IP address.

---

## Alerts `/api/alerts`

This is the **unified operational-alert list**. Every bounded context that detects an infrastructure problem records into this one store, so dashboards (and future ticketing) read a single place instead of chasing per-context lists. Both **device-availability** alerts and **wireless-link** alerts land here.

```ts
interface AlertDTO {
  id: string; // UUID
  deviceId: string; // UUID
  severity: AlertSeverity;
  source: string; // human-readable origin — e.g. "Disponibilidad", "Enlace inalámbrico"
  type: string; // machine discriminator (see table); at most one OPEN alert per (deviceId, type)
  description: string; // human-readable detail line, ready to display
  details: Record<string, unknown>; // producer-specific structured payload — shape varies by source (see table)
  status: AlertStatus;
  startedAt: string; // ISO 8601
  resolvedAt: string | null; // ISO 8601 — null while alert is open
  notifiedAt: string | null; // ISO 8601 — null if Telegram send failed
  recoveryNotifiedAt: string | null; // ISO 8601 — null if not yet resolved/sent
  durationSecs: number | null; // seconds device was offline; null while open
}
```

**Producers** — who writes alerts and what they put in `type` / `details`:

| `source`             | `type`                                                                   | `details` shape                                                                                  | Notes                                                                                     |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `Disponibilidad`     | `device_unreachable`                                                     | `{ consecutiveFailures: number, ipAddress: string \| null }`                                     | Device stopped answering ICMP ping. Resolves automatically on recovery.                   |
| `Enlace inalámbrico` | `wireless:<metric>:<severity>`<br>e.g. `wireless:signal_rx_dbm:CRITICAL` | `{ metric: string, severity: 'WARNING' \| 'CRITICAL', threshold: number, currentValue: number }` | One row per wireless metric + severity. Resolves automatically when the condition clears. |

> **Dedup:** at most **one OPEN alert per `(deviceId, type)`**. A repeated trigger for a condition that is already open does **not** create a duplicate — the existing open alert stands until it resolves.  
> `details` is a free-form JSON bag, easy to render but not queryable server-side — filter/sort in the frontend, don't expect a backend query param for its inner keys.  
> **Not the same as `/api/devices/:id/wireless/alerts`** (`WirelessAlertDTO`): those remain the live, per-poll wireless view. This `/api/alerts` list is the **persisted, cross-context record** — a wireless problem appears in both.

### `GET /api/alerts` — List

**Status:** 200

```ts
// Query params (all optional)
deviceId?: string  // UUID — filter to a single device
limit?:    number  // 1–300, default 50
offset?:   number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    alerts: AlertDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

> Results are ordered by `startedAt` descending (newest first).  
> Omit `deviceId` to list alerts across all devices.

---

### `GET /api/alerts/:id` — Get by ID

**Status:** 200 | 400 | 404

```ts
// Response
{ success: true, data: AlertDTO }
```

> Returns 400 if the id is not a valid UUID, 404 if no alert exists with that id.

---

### `DELETE /api/alerts/:id` — Delete

**Status:** 204 | 400 | 404 | 409  
**Roles:** ADMIN

```ts
// No request body
// Response: 204 No Content
```

> **Only resolved alerts can be deleted.** Deleting an alert that is still `OPEN` returns 409 `"Cannot delete an alert that is still open"` — resolve (or let it auto-resolve) first.  
> Returns 400 for a non-UUID id, 404 if no alert exists with that id.  
> There is no create/update endpoint — alerts are opened and resolved by the system (producers), never by clients. This is read + delete only.

---

## Network Scan `/api/network/scan`

### `POST /api/network/scan` — Scan a network segment

**Status:** 200 | 400 | 404 | 500

```ts
// Request body
{
  segment: string   // required — IPv4 CIDR block, e.g. "192.168.1.0/24"; max range /22
}

// Response
{
  success: true,
  data: {
    segment: string            // the CIDR block that was scanned
    scannedCount: number       // total IP addresses probed
    responsiveCount: number    // hosts that replied to ICMP ping
    discoveredHosts: Array<{
      ipAddress: string
      latencyMs: number
      macAddress: string | null     // null when ARP resolution failed
      manufacturer: string | null   // null when MAC is unknown
    }>
  }
}
```

> Probes every host in the CIDR range via ICMP ping and returns all responsive hosts with their latency, MAC address, and manufacturer (where resolvable).  
> Returns 400 if the segment is invalid or the range exceeds /22 (1 024 usable hosts).  
> Returns 500 on unexpected infrastructure errors.

---

## Wireless Monitoring

> **Response envelope:** Wireless endpoints return raw data directly — **no `{ success, data }` wrapper**.  
> Success: the DTO object or array directly.  
> Error: `{ error: string }`.

```ts
type WirelessDeviceType = 'STATION' | 'ACCESS_POINT';
type WirelessCollectionMethod = 'snmp' | 'http_api' | 'mixed';
type WirelessAlertSeverity = 'WARNING' | 'CRITICAL';
```

```ts
interface WirelessMetricsDTO {
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  noiseFloorDbm: number | null;
  snrDb: number | null;
  ccqPercent: number | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  throughputTxPps: number | null;
  throughputRxPps: number | null;
  lanStatus: string | null;
  lanSpeedMbps: number | null;
  lanDuplex: string | null;
  uptimeSeconds: number | null;
  cpuLoadPercent: number | null;
  memoryUsedPercent: number | null;
  firmwareVersion: string | null;
  deviceName: string | null;
  remoteApMac: string | null;
  remoteApName: string | null;
  distanceM: number | null;
  latencyMs: number | null;
  clientsConnected: number | null;
}

interface WirelessStatusDTO {
  deviceId: string; // UUID
  deviceType: WirelessDeviceType;
  collectedAt: string; // ISO 8601
  collectionMethod: WirelessCollectionMethod;
  metrics: WirelessMetricsDTO;
  activeAlerts: WirelessAlertDTO[];
  clients: WirelessClientDTO[];
}

interface WirelessAlertDTO {
  id: string; // UUID
  deviceId: string; // UUID
  metric: string; // e.g. "signal_rx_dbm", "latency_ms", "clock_drift_s", "firmware_version_changed", "remote_ap_mac_changed"
  severity: WirelessAlertSeverity;
  threshold: number;
  lastValue: number;
  message: string;
  triggeredAt: string; // ISO 8601
  clearedAt: string | null; // ISO 8601 — null while active
  isActive: boolean;
}

interface WirelessClientDTO {
  macAddress: string;
  ipAddress: string | null; // last known IP (sta[].lastip)
  signalRxDbm: number | null; // signal AP receives from this client (dBm)
  noiseFloorDbm: number | null; // client-side noise floor (dBm)
  distanceM: number | null; // distance to AP (m)
  uptimeSeconds: number | null; // association uptime (s)
  txLatencyMs: number | null; // TX latency (ms)
  dlLinkScore: number | null; // downlink link score 0–100
  ulLinkScore: number | null; // uplink link score 0–100
  dlCapacityKbps: number | null; // airMAX downlink capacity (kbps)
  ulCapacityKbps: number | null; // airMAX uplink capacity (kbps)
  dlCinr: number | null; // downlink CINR (dB)
  ulCinr: number | null; // uplink CINR (dB)
  txBytesTotal: string | null; // cumulative TX bytes since association (serialised bigint)
  rxBytesTotal: string | null; // cumulative RX bytes since association (serialised bigint)
  txPps: number | null; // current TX packets/s
  rxPps: number | null; // current RX packets/s
  // Remote CPE info (from sta[].remote — AP-side view of the CPE)
  remoteHostname: string | null;
  remotePlatform: string | null; // CPE model string
  remoteVersion: string | null; // CPE firmware version
  remoteCpuLoad: number | null; // CPE CPU load %
  remoteTotalRam: number | null; // CPE total RAM (bytes)
  remoteFreeRam: number | null; // CPE free RAM (bytes)
  remoteSignal: number | null; // signal CPE receives from AP (dBm)
  remoteNoiseFloor: number | null; // CPE noise floor (dBm)
  remoteTxPower: number | null; // CPE TX power (dBm)
  remoteTxThroughputKbps: number | null;
  remoteRxThroughputKbps: number | null;
  remoteIpAddresses: string[]; // CPE IP addresses
}
```

---

### `POST /api/devices/:id/wireless/config` — Register Wireless Config

**Status:** 201 | 400 | 404 | 409

```ts
// Request body — deviceType is NOT accepted; it is derived (see below)
{
  ipAddress?: string | null                // IPv4 or IPv6; used for HTTP API polling
  intervalSecs?: number                    // 60–86400; default 3600
  enabled?: boolean                        // default true
  linkCapacityKbps?: number | null         // STATION only — provisioned uplink capacity in kbps
  clientsProvisionedLimit?: number | null  // ACCESS_POINT only — max expected clients
}

// Response
{
  id: string
  deviceId: string
  ipAddress: string | null
  enabled: boolean
  intervalSecs: number
  deviceType: 'STATION' | 'ACCESS_POINT'
  linkCapacityKbps: number | null
  clientsProvisionedLimit: number | null
  lastPolledAt: string | null   // ISO 8601 — null until first poll
}
```

**`deviceType` is derived, not sent.** The radio mode follows the device's
`category`, which already encodes that distinction:

| Device `category` | Resulting `deviceType` |
| ----------------- | ---------------------- |
| `ACCESS_POINT`    | `ACCESS_POINT`         |
| `WIRELESS_CPE`    | `STATION`              |

Only those two categories may hold a wireless config at all — any other category
returns `400` `"Only WIRELESS_CPE and ACCESS_POINT devices can have a wireless
config"`. The derived value is still returned in the response, so read it from
there rather than assuming it.

**Business rules:**

- `linkCapacityKbps` may only be set (non-null) when the derived type is `STATION` — returns 400 for an `ACCESS_POINT` category device.
- `clientsProvisionedLimit` may only be set (non-null) when the derived type is `ACCESS_POINT` — returns 400 for a `WIRELESS_CPE` category device.
- `intervalSecs` must be **at least 60**. Polling AirOS faster than that overloads the embedded web server on the radio, so the floor is a hardware constraint, not a preference.

> **`linkCapacityKbps` is in kbps, not bps** — a 50 Mbps link is `50000`. It feeds the link-saturation alert, which warns at 80 % of this value, so an entry off by 1000× either never fires or fires permanently.

> **Frontend:** set the device's `category` first (`PATCH /api/devices/:id`) — it decides which of the two fields this endpoint will accept, and creating this config **locks it**: the category cannot be changed again until the config is deleted. Sending `deviceType` in the body is now ignored by the schema.  
> Returns 404 if the device does not exist.  
> Returns 409 if a wireless config already exists for this device — use `PATCH` to update it.

---

### `GET /api/devices/:id/wireless/config` — Get Config

**Status:** 200 | 400 | 404

```ts
// Response — same shape as POST 201 above
```

> Returns 404 if the device exists but has no wireless config registered.

---

### `PATCH /api/devices/:id/wireless/config` — Update Config

**Status:** 200 | 400 | 404

```ts
// Request body (at least one field required)
{
  ipAddress?: string | null
  intervalSecs?: number                   // 60–86400
  enabled?: boolean
  linkCapacityKbps?: number | null        // kbps; STATION only — returns 400 if config is ACCESS_POINT
  clientsProvisionedLimit?: number | null // ACCESS_POINT only — returns 400 if config is STATION
}

// Response — same shape as POST 201 above
```

> Returns 404 if no config exists for this device — use `POST` to create it first.  
> The STATION / ACCESS_POINT check here runs against the config's **stored** `deviceType` — the value derived from the device's category at creation. The two can no longer drift apart: while this config exists, `PATCH /api/devices/:id` refuses to change the device's category at all. If the role really changed, delete this config, recategorise the device, then create it again.

---

### `DELETE /api/devices/:id/wireless/config` — Remove Config

**Status:** 204 | 400 | 404

```ts
// No request body
// Response: 204 No Content
```

> Removes wireless monitoring from the device. The device record itself is not affected.  
> Returns 404 if no config exists.  
> This is also the prerequisite for two other operations that refuse to destroy a config on their own: recategorising the device (`PATCH /api/devices/:id`) and marking its model non-wireless (`PUT /api/device-models/:id`).

---

### `GET /api/devices/:id/wireless/status` — Latest Snapshot

**Status:** 200 | 400 | 404

```ts
// Response — WirelessStatusDTO (raw, no wrapper)
{
  deviceId: string
  deviceType: WirelessDeviceType
  collectedAt: string
  collectionMethod: WirelessCollectionMethod
  metrics: WirelessMetricsDTO
  activeAlerts: WirelessAlertDTO[]
  clients: WirelessClientDTO[]
}
```

> Returns 404 if the device has never been polled (no snapshot exists) or does not exist.

---

### `GET /api/devices/:id/wireless/history` — Historical Snapshots

**Status:** 200 | 400

```ts
// Query params (from and to are required)
from: string   // ISO 8601 with offset, e.g. "2026-01-01T00:00:00Z"
to:   string   // ISO 8601 with offset
limit?: number // 1–1000

// Response
{
  snapshots: WirelessStatusDTO[]
  total: number
}
```

---

### `GET /api/devices/:id/wireless/clients` — Client List

**Status:** 200 | 400 | 404

```ts
// Response
{
  deviceId: string
  collectedAt: string        // ISO 8601
  clients: WirelessClientDTO[]
}
```

> Returns the connected client list from the most recent snapshot (AP devices only).  
> Returns 404 if no snapshot exists for this device.

---

### `GET /api/devices/:id/wireless/alerts` — Active Alerts for Device

**Status:** 200 | 400

```ts
// Response — raw array
WirelessAlertDTO[]
```

> Returns all currently active wireless alerts for the given device.  
> Returns an empty array if the device has no active alerts (does not 404 on unknown device IDs).

---

### `GET /api/devices/:id/wireless/alerts/history` — Alert History for Device

**Status:** 200 | 400

```ts
// Query params (all optional)
from?:  string  // ISO 8601 with offset
to?:    string  // ISO 8601 with offset
limit?: number  // 1–500

// Response — raw array
WirelessAlertDTO[]
```

> Returns all alerts (active and cleared) for the device within the optional time window.  
> Returns an empty array for unknown device IDs.

---

### `POST /api/devices/:id/wireless/poll` — Trigger Immediate Poll

**Status:** 202 | 400 | 404

```ts
// No request body

// Response (202)
{
  deviceId: string
  collectedAt: string         // ISO 8601
  metricsCollected: boolean
  alertsTriggered: number
  alertsCleared: number
  collectionMethod: string
  skipped?: boolean           // true if polling was disabled and forceExecution not set
}
```

> Triggers an on-demand poll. Returns 404 if the device has no wireless polling configuration.  
> The poll attempts real device connectivity — expect 400/500 in environments without reachable devices.

---

### `POST /api/devices/:id/wireless/reboot` — Reboot Device (AirOS 8)

**Status:** 202 | 400 | 404 | 500  
**Roles:** ADMIN, OPERATOR

Reboots the antenna remotely via its AirOS 8 HTTP API. Requires the device to have a **wireless config** (source of the IP) and **HTTP credentials** (`httpUsername`/`httpPassword` via `PUT /api/devices/:id/credentials`).

```ts
// No request body

// Response (202) — raw, no wrapper
{
  deviceId: string; // UUID
  requestedAt: string; // ISO 8601 — when the reboot was accepted
}
```

> **202 means the device acknowledged the reboot request** — it then goes offline for ~1–2 minutes while restarting. Expect polls/status to fail during that window; show a "rebooting…" state rather than an error.  
> Returns 404 if the device has no wireless polling configuration.  
> Returns 400 if credentials are not configured or the device has no IP address.  
> Returns 500 if the device is unreachable or authentication against it fails.  
> This is a destructive-ish action — put it behind a confirmation dialog in the UI.

---

### `GET /api/wireless/alerts` — All Active Alerts (Global)

**Status:** 200 | 400

```ts
// Query params (all optional)
deviceId?: string  // UUID — filter to a single device

// Response — raw array
WirelessAlertDTO[]
```

> Returns all currently active wireless alerts across all devices, or filtered by deviceId.

---

### `GET /api/wireless/alerts/history` — Alert History (Global, filtered by device)

**Status:** 200 | 400

```ts
// Query params
deviceId: string   // UUID — required (use /api/devices/:id/wireless/alerts/history for the same)
from?:    string   // ISO 8601 with offset
to?:      string   // ISO 8601 with offset
limit?:   number   // 1–500

// Response — raw array
WirelessAlertDTO[]
```

> Note: `deviceId` is **required** even though the route appears global. Omitting it returns 400.  
> Prefer `GET /api/devices/:id/wireless/alerts/history` for per-device history.

---

## Customers `/api/customers`

```ts
interface CustomerDTO {
  id: string; // UUID
  fullName: string;
  phone: string;
  email: string | null;
  cedula: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

### `POST /api/customers` — Create

**Status:** 201 | 400

```ts
// Request body
{
  fullName: string         // required, 1–150 chars
  phone: string            // required, 7–20 chars, digits/spaces/()/.-/+ allowed
  email?: string | null    // max 255 chars, valid email format
  cedula?: string | null   // 6–15 chars, digits/dots/spaces
}

// Response
{ success: true, data: CustomerDTO }
```

---

### `GET /api/customers` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number  // 1–100, default 20
offset?: number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    customers: CustomerDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/customers/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: CustomerDTO }
```

---

### `PUT /api/customers/:id` — Update

**Status:** 200 | 400 | 404

```ts
// Request body (at least one field required)
{
  fullName?: string
  phone?: string
  email?: string | null
  cedula?: string | null
}

// Response
{ success: true, data: CustomerDTO }
```

---

### `DELETE /api/customers/:id` — Delete

**Status:** 204 | 400 | 404

```ts
// No request body
// Response: 204 No Content
```

---

## Service Plans `/api/service-plans`

```ts
interface ServicePlanDTO {
  id: string; // UUID
  name: string;
  downloadMbps: number; // positive integer
  uploadMbps: number; // positive integer
  monthlyPrice: number; // non-negative decimal
  description: string | null;
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

### `POST /api/service-plans` — Create

**Status:** 201 | 400

```ts
// Request body
{
  name: string             // required, 1–100 chars
  downloadMbps: number     // required, positive integer (Mbps)
  uploadMbps: number       // required, positive integer (Mbps)
  monthlyPrice: number     // required, non-negative decimal
  description?: string | null  // max 500 chars
  isActive?: boolean       // default true
}

// Response
{ success: true, data: ServicePlanDTO }
```

---

### `GET /api/service-plans` — List

**Status:** 200

```ts
// Query params (all optional)
limit?:  number  // 1–100, default 20
offset?: number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    servicePlans: ServicePlanDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/service-plans/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: ServicePlanDTO }
```

---

### `PUT /api/service-plans/:id` — Update

**Status:** 200 | 400 | 404

```ts
// Request body (at least one field required)
{
  name?: string
  downloadMbps?: number
  uploadMbps?: number
  monthlyPrice?: number
  description?: string | null
  isActive?: boolean
}

// Response
{ success: true, data: ServicePlanDTO }
```

---

### `DELETE /api/service-plans/:id` — Delete

**Status:** 204 | 400 | 404

```ts
// No request body
// Response: 204 No Content
```

---

## Contracted Services `/api/contracted-services`

```ts
type ContractedServiceStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CANCELLED';

interface ContractedServiceDTO {
  id: string; // UUID
  customerId: string; // UUID
  servicePlanId: string; // UUID
  deviceId: string | null; // UUID — the CPE device assigned to this service
  status: ContractedServiceStatus;
  startDate: string; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

### `POST /api/contracted-services` — Create

**Status:** 201 | 400

```ts
// Request body
{
  customerId: string        // required, UUID
  servicePlanId: string     // required, UUID
  deviceId?: string | null  // UUID — CPE device for this service
  startDate?: string        // ISO 8601 datetime; defaults to now if omitted
}

// Response
{ success: true, data: ContractedServiceDTO }
```

> New services are **always created as `PENDING`** — the create endpoint does not accept a `status` field. To activate one, assign a device (if not done at creation) and send `PUT /:id` with `{ status: 'ACTIVE' }`.  
> **Billing only includes `ACTIVE` services** — `POST /api/bills/generate` returns 409 for a customer whose services are all PENDING/SUSPENDED/CANCELLED.

**Contracted service status lifecycle:**

| Transition                         | Requirements           | Notes                                                                                          |
| ---------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| (create) → `PENDING`               | —                      | only possible initial status                                                                   |
| `PENDING` / `SUSPENDED` → `ACTIVE` | `deviceId` must be set | 409 `"Cannot activate a contracted service without a device assigned"` otherwise               |
| `PENDING` / `ACTIVE` → `SUSPENDED` | —                      | triggers suspension side effects (see below)                                                   |
| any → `CANCELLED`                  | —                      | **terminal** — every later update returns 409 `"Cannot modify a cancelled contracted service"` |
| any → `PENDING`                    | **not allowed**        | `PENDING` is not a valid `status` value on `PUT` — returns 400                                 |

**Suspension side effects (automatic, server-side):**

When a service transitions **into `SUSPENDED`**, the backend automatically (when the deployment has them configured):

1. **Throttles the customer's internet to 1 kbps** — a queue targeting the assigned device's IP is created on the core MikroTik router. Requires the service to have a `deviceId` with an IP address.
2. **Sends a WhatsApp notification** to the customer's `phone` (pre-approved template with the customer's name).

When a service transitions **out of `SUSPENDED`** (→ `ACTIVE` or `CANCELLED`), the throttle is removed automatically. Reactivation does not send a WhatsApp message.

> **The API contract is unchanged** — the `PUT` request/response shapes are exactly as documented above; side effects are fire-and-forget and never block or fail the status update.  
> Enforcement is **eventually consistent**: it is attempted immediately, and a background reconciler repairs any miss (router briefly unreachable, queue edited by hand) within ~60 seconds.  
> To show whether the throttle is **actually applied** on the router, use the [Suspension Enforcement Status](#suspension-enforcement-status) endpoints below.  
> If the service has **no device assigned** (or the device has no IP), the status still changes but the throttle cannot be applied — worth surfacing in the UI when suspending a device-less service.

---

### `GET /api/contracted-services` — List

**Status:** 200

```ts
// Query params (all optional)
customerId?: string  // UUID — filter by customer
limit?:      number  // 1–100, default 20
offset?:     number  // ≥0, default 0

// Response
{
  success: true,
  data: {
    contractedServices: ContractedServiceDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/contracted-services/:id` — Get by ID

**Status:** 200 | 404

```ts
// Response
{ success: true, data: ContractedServiceDTO }
```

---

### `PUT /api/contracted-services/:id` — Update

**Status:** 200 | 400 | 404 | 409

```ts
// Request body (at least one field required)
{
  servicePlanId?: string         // UUID — change the plan (plan must exist → 404 otherwise)
  deviceId?: string | null       // UUID — assign CPE; null releases it
  status?: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'   // ⚠ PENDING is NOT accepted → 400
}

// Response
{ success: true, data: ContractedServiceDTO }
```

**Business rules:**

- `status: 'PENDING'` is rejected with 400 — services can never return to PENDING.
- `status: 'ACTIVE'` requires the service to have a device (either already assigned or included as `deviceId` in the same request) — otherwise 409 `"Cannot activate a contracted service without a device assigned"`.
- `deviceId: null` on an **ACTIVE** service returns 409 `"Cannot release the device of an ACTIVE service; suspend it first"`.
- A device can belong to only one contracted service — assigning a taken device returns 409 `"This device is already assigned to another contracted service"`.
- **CANCELLED is terminal** — any update to a cancelled service returns 409.
- Fields in one request are applied in a fixed order: plan change → suspend → device change → activate → cancel. So a single `PUT` can do `{ status: 'SUSPENDED', deviceId: null }` (suspend then release) or `{ deviceId: '…', status: 'ACTIVE' }` (assign then activate).

---

### `DELETE /api/contracted-services/:id` — Delete

**Status:** 204 | 400 | 404

```ts
// No request body
// Response: 204 No Content
```

---

## Suspension Enforcement Status

Live view of which suspensions are **actually enforced on the router** (vs. just `status: SUSPENDED` in the DB). These endpoints query the MikroTik router in real time — the answer is always current, but each call costs a router round-trip (~100–300 ms).

A suspended service is "enforced" when its throttle queue exists on the router. It can be un-enforced because: the service has no device/IP, the router was unreachable when suspension happened (the reconciler will fix it within ~60 s), or someone removed the queue by hand.

Uses the standard `{ success, data }` envelope.

### `GET /api/enforcement/suspensions` — All Enforced Suspensions

**Status:** 200 | 503

```ts
// No query params

// Response
{
  success: true,
  data: {
    checkedAt: string      // ISO 8601 — when the router was queried
    enforcements: Array<{
      contractedServiceId: string  // UUID — join against your contracted services
      targetIp: string             // the IP currently being throttled
    }>
  }
}
```

> **One router call for everything** — prefer this on list views: fetch once, build a `Set` of enforced `contractedServiceId`s, and badge each SUSPENDED row as "throttled" / "not yet throttled".  
> Returns `503` when enforcement is not configured on the backend, or the router is unreachable — treat as "enforcement status unknown", not as "not enforced".

---

### `GET /api/contracted-services/:id/enforcement` — Enforcement Status for One Service

**Status:** 200 | 400 | 503

```ts
// Response
{
  success: true,
  data: {
    contractedServiceId: string
    enforced: boolean           // true = throttle queue exists on the router
    targetIp: string | null     // IP being throttled; null when not enforced
    checkedAt: string           // ISO 8601
  }
}
```

> Use on the service/customer detail view, or as a "verify now" refresh after suspending.  
> `enforced: false` for an `ACTIVE` service is normal (nothing to enforce). `enforced: false` for a `SUSPENDED` service means the throttle isn't applied (yet) — show a warning and re-check after ~60 s before escalating.  
> Returns `400` for a non-UUID id, `503` when enforcement is not configured or the router is unreachable (= status unknown).

---

## Bills `/api/bills`

One bill per customer per billing period (`'YYYY-MM'`). Line items snapshot the plan name and price **at generation time** — later plan price changes never affect existing bills. `total` is the sum of line items.

**Lifecycle:** `PENDING → PAID | OVERDUE | CANCELLED`. `PAID` and `CANCELLED` are terminal. `OVERDUE` bills can still be paid or cancelled.

```ts
interface BillLineItemDTO {
  contractedServiceId: string; // UUID
  servicePlanId: string; // UUID
  planName: string; // snapshot at generation time
  monthlyPrice: number; // snapshot at generation time
}

interface BillDTO {
  id: string; // UUID
  customerId: string; // UUID
  period: string; // 'YYYY-MM', e.g. '2026-07'
  status: BillStatus;
  issueDate: string; // ISO 8601
  dueDate: string; // ISO 8601
  paidAt: string | null; // ISO 8601 — null until marked paid
  total: number; // sum of lineItems monthlyPrice
  lineItems: BillLineItemDTO[];
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

### `POST /api/bills/generate` — Generate Bill for a Customer

**Status:** 201 | 400 | 404 | 409 | 500  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  customerId: string   // required, UUID
  year: number         // required, integer 2000–2100
  month: number        // required, integer 1–12
  issueDate?: string   // ISO 8601 datetime; default: now
  dueDate?: string     // ISO 8601 datetime; default: issueDate + 15 days
}

// Response
{ success: true, data: BillDTO }
```

**Business rules:**

- One line item per **ACTIVE** contracted service of the customer (PENDING/SUSPENDED/CANCELLED services are excluded).
- Returns 409 if the customer has no ACTIVE contracted services.
- Returns 409 if a non-cancelled bill already exists for this customer + period. Cancelled bills don't block regeneration.
- Returns 404 if the customer does not exist.

---

### `POST /api/bills/generate-bulk` — Generate Bills for All Customers

**Status:** 200 | 400  
**Roles:** ADMIN, OPERATOR  
**Rate limit:** bulk-import bucket — 5 / hr

Generates bills for **every customer that has at least one ACTIVE contracted service**. Per-customer failures never abort the run — inspect the three result buckets.

```ts
// Request body
{
  year: number         // required, integer 2000–2100
  month: number        // required, integer 1–12
  issueDate?: string   // ISO 8601 datetime; default: now
  dueDate?: string     // ISO 8601 datetime; default: issueDate + 15 days
}

// Response — always 200 even if some customers failed
{
  success: true,
  data: {
    period: string   // 'YYYY-MM'
    generated: BillDTO[]
    skipped: Array<{ customerId: string; reason: string }>  // e.g. bill already exists
    failed:  Array<{ customerId: string; error: string }>
  }
}
```

---

### `GET /api/bills` — List

**Status:** 200 | 400

```ts
// Query params (all optional)
customerId?: string      // UUID
status?:     BillStatus
year?:       number      // 2000–2100 ← must pair with month
month?:      number      // 1–12
limit?:      number      // 1–100, default 20
offset?:     number      // ≥0, default 0

// Response
{
  success: true,
  data: {
    bills: BillDTO[]
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

> `year` and `month` must always be provided together (400 otherwise).  
> Results are ordered by `createdAt` descending (newest first).

---

### `GET /api/bills/:id` — Get by ID

**Status:** 200 | 400 | 404

```ts
// Response
{ success: true, data: BillDTO }
```

---

### `GET /api/bills/:id/pdf` — Download as PDF

**Status:** 200 | 400 | 404

Returns the bill as a **PDF document** — not the JSON envelope.

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="bill-<period>-<billId>.pdf"
```

The PDF includes the bill header (period, status, issue/due/paid dates), the customer block (name, phone, email, cedula), one row per line item with its snapshot price, and the total.

> Error responses (400/404) still use the standard JSON envelope `{ success: false, error }`.  
> Frontend tip: fetch with the Bearer token and download via a blob URL — a plain `<a href>` won't carry the Authorization header.

---

### `POST /api/bills/:id/pay` — Mark as Paid

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response — BillDTO with status 'PAID' and paidAt set
{ success: true, data: BillDTO }
```

> Allowed from `PENDING` or `OVERDUE`. Returns 409 if the bill is already `PAID` or `CANCELLED`.

---

### `POST /api/bills/:id/overdue` — Mark as Overdue

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response
{ success: true, data: BillDTO }
```

> Allowed only from `PENDING`, and only once the bill is **past its due date** — returns 409 otherwise. There is no automatic overdue job; the frontend (or an operator) triggers this explicitly.

---

### `POST /api/bills/:id/cancel` — Cancel

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response — BillDTO with status 'CANCELLED'
{ success: true, data: BillDTO }
```

> Allowed from `PENDING` or `OVERDUE`. Returns 409 for a `PAID` bill ("Cannot cancel a paid bill") or an already-cancelled one.  
> Cancelling frees the customer + period for regeneration via `POST /generate`.

---

## Tickets `/api/tickets`

Field work orders. A ticket is the unit of work a technician is dispatched to do: what broke, who to call, which device, and where to go.

**Lifecycle:**

```
OPEN ──assign──▶ ASSIGNED ──start──▶ IN_PROGRESS ──resolve──▶ RESOLVED
 │                  │                    │
 └──────────────────┴───────cancel───────┴──────────────────▶ CANCELLED
```

`RESOLVED` and `CANCELLED` are terminal — **no field can change afterwards**, and every write endpoint returns `409` on a terminal ticket. Use `POST /:id/cancel` to close a ticket that should not be worked; `DELETE` is for tickets raised in error.

**Scheduling is by calendar day, not by instant.** `scheduledFor` is always `'YYYY-MM-DD'` in both directions — sending an ISO datetime returns `400`. There are no time slots and no overlap detection.

```ts
interface TicketAddressDTO {
  street: string;
  municipality: string;
  neighborhood: string;
  reference: string | null; // e.g. "casa azul, portón negro"
  latitude: number | null;
  longitude: number | null;
}

interface TicketCustomerContactDTO {
  id: string; // UUID
  fullName: string;
  phone: string;
  email: string | null;
}

interface TicketDeviceSummaryDTO {
  id: string; // UUID
  name: string;
  ipAddress: string | null;
  macAddress: string | null;
  status: DeviceStatus;
  category: DeviceCategory | null;
  modelName: string | null; // e.g. "LiteBeam 5AC Gen2"
  vendorName: string | null; // e.g. "Ubiquiti"
  locationName: string | null;
}

interface TechnicianSummaryDTO {
  id: string; // UUID
  fullName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
}

interface TicketDTO {
  id: string; // UUID
  code: number; // human-readable ticket number, e.g. 42 — quote this on the phone
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  title: string;
  description: string;
  customerId: string | null;
  deviceId: string | null;
  technicianId: string | null;
  address: TicketAddressDTO | null;
  scheduledFor: string | null; // 'YYYY-MM-DD' — calendar day, never a datetime
  origin: TicketOrigin;
  originAlertId: string | null; // the alert that raised this ticket; null when MANUAL
  resolutionNotes: string | null;
  cancelReason: string | null;
  createdBy: string | null; // UUID of the user who filed it
  assignedAt: string | null; // ISO 8601
  startedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// TicketDTO plus the collaborators resolved — returned by GET /:id and /my-day
interface TicketDetailDTO extends TicketDTO {
  customer: TicketCustomerContactDTO | null;
  device: TicketDeviceSummaryDTO | null;
  technician: TechnicianSummaryDTO | null;
}
```

> **`code` vs `id`.** `id` is the UUID for every API call. `code` is a gapless integer allocated by the database, and it is what a technician says out loud when they phone the office. Show `code`, send `id`.

---

### `GET /api/tickets/my-day` — Technician's Day Sheet

**Status:** 200 | 400 | 404  
**Roles:** ADMIN, OPERATOR, VIEWER

**This is the endpoint the technician view is built on.** One call returns everything needed before leaving: today's tasks in the order they should be worked, each with the customer to call, the suspected failure, the related device, and the address to drive to.

```ts
// Query params
{
  technicianId: string   // required, UUID
  date?: string          // 'YYYY-MM-DD'; default: today (UTC)
}

// Response
{
  success: true,
  data: {
    technician: TechnicianSummaryDTO
    date: string                   // 'YYYY-MM-DD', echoed back
    tickets: TicketDetailDTO[]
    total: number                  // === tickets.length; the day sheet is never paginated
  }
}
```

**Ordering is the instruction, not a preference:** `URGENT → HIGH → NORMAL → LOW`, then oldest first within a priority. Render the list in the order given.

**What is excluded:**

- tickets scheduled for any other day, and tickets with no `scheduledFor` at all
- `RESOLVED` and `CANCELLED` tickets — resolve one and it drops off the sheet immediately
- other technicians' work

`IN_PROGRESS` tickets **are** included, so a half-finished job still shows.

An empty day returns `200` with `tickets: []` and `total: 0` — not `404`. `404` means the technician does not exist.

> **No ownership scoping yet.** `technicianId` is an explicit query param and any authenticated reader may pass any id, so today this is a dispatcher view. A technician-facing app must supply the id itself; the backend will not infer it from the token.

---

### `POST /api/tickets` — Create

**Status:** 201 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  title: string            // required, 1–150 chars
  description: string      // required, 1–5000 chars
  category: TicketCategory // required
  priority?: TicketPriority        // default: 'NORMAL'
  customerId?: string | null       // UUID
  deviceId?: string | null         // UUID
  technicianId?: string | null     // UUID — assigns on creation
  address?: {                      // all three parts required together, or omit entirely
    street: string
    municipality: string
    neighborhood: string
    reference?: string | null
    latitude?: number | null       // -90..90, paired with longitude
    longitude?: number | null      // -180..180
  } | null
  scheduledFor?: string | null     // 'YYYY-MM-DD'
}

// Response
{ success: true, data: TicketDTO }
```

**Business rules:**

- **At least one of `customerId` / `deviceId` is required** — 400 otherwise. Either alone is fine: an internal tower job has no customer, and a phoned-in complaint may not name a device yet.
- The address is a **snapshot**, stored on the ticket and never re-resolved. A partial address is refused (400) — a street with no municipality is not navigable. There is no customer address anywhere else in the system, so this is the only place a visit location lives.
- Passing `technicianId` assigns immediately: the ticket comes back `ASSIGNED` with `assignedAt` set. Assigning an **inactive** technician returns 409.
- `createdBy` is taken from the JWT and **ignored if sent in the body**.
- Always created with `origin: 'MANUAL'` and `originAlertId: null`. Sending an `originAlertId` is rejected.
- 404 if the referenced customer or device does not exist.

---

### `GET /api/tickets` — List

**Status:** 200 | 400  
**Roles:** ADMIN, OPERATOR, VIEWER

```ts
// Query params — all optional
{
  status?: TicketStatus
  priority?: TicketPriority
  category?: TicketCategory
  technicianId?: string    // UUID
  customerId?: string      // UUID
  deviceId?: string        // UUID
  scheduledFrom?: string   // 'YYYY-MM-DD', inclusive
  scheduledTo?: string     // 'YYYY-MM-DD', inclusive
  unassignedOnly?: boolean // 'true' | 'false' — the dispatcher's inbox
  openOnly?: boolean       // 'true' | 'false' — excludes RESOLVED and CANCELLED
  limit?: number           // 1–100, default 20
  offset?: number          // default 0
}

// Response
{
  success: true,
  data: {
    tickets: TicketDTO[]   // flat — no customer/device/technician; use GET /:id for those
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

> **Two filter pairs contradict, and one side wins silently — do not send both:**  
> `unassignedOnly=true` overrides `technicianId` ("nobody" wins), and `openOnly=true` overrides `status`.  
> `scheduledFrom` later than `scheduledTo` returns 400.

---

### `GET /api/tickets/:id` — Get by ID

**Status:** 200 | 400 | 404  
**Roles:** ADMIN, OPERATOR, VIEWER

```ts
// Response — the enriched shape, same as the day sheet entries
{ success: true, data: TicketDetailDTO }
```

> `customer`, `device` and `technician` are each `null` when the ticket does not reference one. A referenced record that has since been deleted also reads `null` — the FKs are `SET NULL`, so the ticket survives.

---

### `PUT /api/tickets/:id` — Update

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body — at least one field required
{
  title?: string
  description?: string
  category?: TicketCategory
  priority?: TicketPriority
  customerId?: string | null
  deviceId?: string | null
  address?: { … } | null   // same shape as create; null clears it
}

// Response
{ success: true, data: TicketDTO }
```

**Business rules:**

- 409 on a `RESOLVED` or `CANCELLED` ticket — terminal tickets are history.
- Cannot drop **both** `customerId` and `deviceId` (400).
- Does not change status, technician or schedule — use the action endpoints below.

---

### `DELETE /api/tickets/:id` — Delete

**Status:** 204 | 400 | 404  
**Roles:** ADMIN

```ts
// No response body
```

> For tickets raised in error. Cancelling is the normal way to close one, and it keeps the record and the reason.

---

### `POST /api/tickets/:id/assign` — Assign to a Technician

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  technicianId: string     // required, UUID
  scheduledFor?: string | null   // 'YYYY-MM-DD' — set the visit day in the same call
}

// Response — TicketDTO with status 'ASSIGNED' and assignedAt set
{ success: true, data: TicketDTO }
```

**Business rules:**

- Allowed from `OPEN` or `ASSIGNED`. **Reassignment is allowed until work starts** and re-stamps `assignedAt`.
- 409 from `IN_PROGRESS` — someone is on site; swapping the technician mid-visit would lose who did what. Resolve or cancel first.
- 409 if the technician is inactive; 404 if they do not exist.

---

### `POST /api/tickets/:id/schedule` — Set or Move the Visit Day

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  scheduledFor: string | null   // required key; 'YYYY-MM-DD', or null to clear
}

// Response
{ success: true, data: TicketDTO }
```

> **A past date is accepted on purpose** — work done off the books gets entered afterwards. 409 on a terminal ticket.

---

### `POST /api/tickets/:id/start` — Start Work

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// No request body

// Response — TicketDTO with status 'IN_PROGRESS' and startedAt set
{ success: true, data: TicketDTO }
```

> Allowed **only** from `ASSIGNED` — 409 from `OPEN` (nobody owns it) or from `IN_PROGRESS` (already started; restarting would overwrite `startedAt`).

---

### `POST /api/tickets/:id/resolve` — Resolve

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  resolutionNotes: string   // required, 1–5000 chars
}

// Response — TicketDTO with status 'RESOLVED' and resolvedAt set
{ success: true, data: TicketDTO }
```

**Business rules:**

- Allowed from `ASSIGNED` or `IN_PROGRESS`. Resolving straight from `ASSIGNED` is normal — plenty of faults are fixed remotely without a visit.
- 409 from `OPEN`: nobody is attached, so there is no one whose work the notes describe.
- Notes are **required and non-blank** (400) — they are the only record of what was done.
- The ticket drops off `/my-day` immediately.

---

### `POST /api/tickets/:id/cancel` — Cancel

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  reason: string   // required, 1–255 chars
}

// Response — TicketDTO with status 'CANCELLED' and cancelledAt set
{ success: true, data: TicketDTO }
```

> Allowed from `OPEN`, `ASSIGNED` or `IN_PROGRESS`. 409 for a `RESOLVED` ticket ("Cannot cancel a resolved ticket") or an already-cancelled one.  
> The reason is required — a cancelled ticket with no reason is indistinguishable from one dropped by mistake, and the same fault gets reported again next week.

---

### Tickets opened automatically from alerts

Tickets are not only created by hand. When a **new** alert is recorded — ICMP device-down or wireless — the backend opens a ticket for it with `origin: 'DEVICE_ALERT'` or `'WIRELESS_ALERT'` and `originAlertId` set to the alert.

Two levels of deduplication mean the technician does not drown:

1. The same alert re-firing (monitoring re-emits every poll while the fault persists) reuses the existing ticket.
2. A **second alert on a device that already has a live alert-origin ticket** folds into that ticket — a device breaching five metrics is one site visit, not five jobs.

A new ticket is only opened once the earlier one reaches `RESOLVED` or `CANCELLED`. Severity maps to priority: `CRITICAL → URGENT`, everything else `→ HIGH`.

Filter these with `GET /api/tickets?openOnly=true` and read `origin` to badge them apart from phoned-in work.

---

## Technicians `/api/technicians`

The field workers tickets are dispatched to. Separate from `User` (the login accounts): a technician does not need to log in, and `userId` is an optional link for when they do.

```ts
interface TechnicianDTO {
  id: string; // UUID
  fullName: string;
  phone: string; // normalized to '+' + digits, e.g. '+573001112233'
  email: string | null; // lowercased
  userId: string | null; // optional link to a login account
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

---

### `POST /api/technicians` — Create

**Status:** 201 | 400 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body
{
  fullName: string      // required, 1–150 chars
  phone: string         // required, 7–15 digits; '+57 (300) 111-2233' is accepted
  email?: string | null
  userId?: string | null // UUID of a login account
  isActive?: boolean     // default: true
}

// Response
{ success: true, data: TechnicianDTO }
```

**Business rules:**

- **Phone is the natural key and must be unique** (409). It is normalized before comparison, so `+57 300 111 2233` and `+573001112233` collide.
- Email must be unique when present (409). Any number of technicians may have none.
- New technicians are active — someone being added is someone about to be given work.

---

### `GET /api/technicians` — List

**Status:** 200 | 400  
**Roles:** ADMIN, OPERATOR, VIEWER

```ts
// Query params
{
  activeOnly?: boolean  // 'true' | 'false' — use for assignment pickers
  limit?: number        // 1–100, default 20
  offset?: number       // default 0
}

// Response
{
  success: true,
  data: {
    technicians: TechnicianDTO[]   // ordered by fullName
    total: number                  // respects activeOnly
    hasMore: boolean
    limit: number
    offset: number
  }
}
```

---

### `GET /api/technicians/:id` — Get by ID

**Status:** 200 | 400 | 404  
**Roles:** ADMIN, OPERATOR, VIEWER

```ts
{ success: true, data: TechnicianDTO }
```

---

### `PUT /api/technicians/:id` — Update

**Status:** 200 | 400 | 404 | 409  
**Roles:** ADMIN, OPERATOR

```ts
// Request body — at least one field required
{
  fullName?: string
  phone?: string
  email?: string | null   // null clears it
  userId?: string | null  // null unlinks the login account
  isActive?: boolean      // false takes them off the rota
}

// Response
{ success: true, data: TechnicianDTO }
```

> A technician may keep their own phone or email — only a collision with a **different** technician returns 409.  
> **`isActive: false` is how you retire someone.** They stop being assignable immediately, existing tickets keep their name, and history stays intact.

---

### `DELETE /api/technicians/:id` — Delete

**Status:** 204 | 400 | 404 | 409  
**Roles:** ADMIN

```ts
// No response body
```

> **409 if any ticket references them** — open or closed. The FK is `SET NULL`, so deleting would silently blank the technician on every ticket they ever worked and erase who did what. Deactivate instead (`PUT` with `isActive: false`); the error message says so.

---

## Other

### `GET /health`

```ts
{ status: 'ok', timestamp: string }
```

### Unknown routes → 404

```ts
{ success: false, error: 'Not found' }
```

---

## Error Status Codes

| Code | Meaning                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | Validation error or business rule violation (e.g. duplicate MAC/IP)                                                                                             |
| 401  | Missing, expired, or invalid JWT                                                                                                                                |
| 403  | Valid token but insufficient role for this operation                                                                                                            |
| 404  | Resource not found                                                                                                                                              |
| 409  | Conflict — resource already exists, or cannot be deleted/changed while dependents exist (e.g. vendor has models, model has devices, model has wireless configs) |
| 429  | Rate limit exceeded                                                                                                                                             |
| 500  | Unexpected server error                                                                                                                                         |
| 503  | Dependent system unavailable — enforcement router unreachable or enforcement not configured (enforcement endpoints only)                                        |

Error body: `{ success: false, error: string }` (standard endpoints) / `{ error: string }` (credentials, polling, wireless)
