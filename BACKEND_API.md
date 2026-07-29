# Backend API Reference

> **Purpose:** This file is the source of truth for the backend API when working on the frontend.  
> It is written for a Claude Code session in the frontend directory — paste it as context when you need endpoint details.  
> The backend lives at `/home/jonathan/Studies/projects/network-management-system/backend`.

---

## Base

| Key | Value |
|-----|-------|
| Dev base URL | `http://localhost:3000` |
| API prefix | `/api` |
| Content-Type | `application/json` |

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

| Role | Allowed operations |
|------|--------------------|
| `ADMIN` | read, create, update, delete, activate, bulk-import |
| `OPERATOR` | read, create, update, activate, bulk-import |
| `VIEWER` | read only |

### Rate limits (per IP)

| Operation type | Limit |
|----------------|-------|
| Read (`GET`) | 100 / min |
| Write (`POST`, `PATCH`, `PUT`) | 20 / min |
| Delete (`DELETE`) | 10 / min |
| Bulk import | 5 / hr |

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
type LocationType   = 'TOWER' | 'DATACENTER' | 'POINT_OF_PRESENCE' | 'OFFICE' | 'CUSTOMER_PREMISES' | 'OTHER'
type DeviceStatus   = 'INVENTORY' | 'COMMISSIONING' | 'ACTIVE' | 'DAMAGED'
type DeviceCategory = 'CPE' | 'WIRELESS_CPE' | 'AP' | 'ROUTERBOARD' | 'SMART_SWITCH' | 'SMART_SWITCH_POE' | 'OTHER'
type DeviceOwner    = 'COMPANY' | 'CLIENT'
type DeviceType     = 'ANTENNA' | 'OTHER' | 'RADIO' | 'ROUTER' | 'ROUTERBOARD' | 'SERVER' | 'SWITCH'
type PollingStatus      = 'SUCCESS' | 'FAILED' | 'SKIPPED'
type BillStatus         = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
type DeviceOnlineStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN'
type AlertSeverity      = 'WARNING' | 'CRITICAL'
type AlertStatus        = 'OPEN' | 'RESOLVED'
```

---

## Shared Response Shapes

```ts
interface LocationDTO {
  id: string            // UUID
  name: string
  type: LocationType
  municipality: string | null
  neighborhood: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  altitude: number | null
  createdAt: string     // ISO 8601
  updatedAt: string
}

interface DeviceDTO {
  id: string            // UUID
  deviceModelId: string // UUID
  locationId: string | null
  status: DeviceStatus
  category: DeviceCategory | null
  ownerType: DeviceOwner | null
  name: string
  serialNumber: string | null
  macAddress: string | null
  ipAddress: string | null
  description: string | null
  installedDate: string | null  // ISO 8601
  monitoringEnabled: boolean
  createdAt: string
  updatedAt: string
}

interface VendorDTO {
  id: string            // UUID
  name: string
  slug: string          // URL-safe lowercase, e.g. "tp-link"
  description: string | null
  createdAt: string     // ISO 8601
  updatedAt: string
}

interface DeviceModelDTO {
  id: string            // UUID
  vendorId: string      // UUID
  vendorName: string    // e.g. "MikroTik"
  vendorSlug: string    // e.g. "mikrotik"
  model: string
  deviceType: DeviceType
  createdAt: string     // ISO 8601
  updatedAt: string
}

interface PaginatedResponse<T> {
  // (field name varies — see each endpoint below)
  total: number
  hasMore: boolean
  limit: number
  offset: number
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
**Status:** 201

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
- `INVENTORY` / `DAMAGED` status → at least one of `serialNumber` or `macAddress` required (status defaults to `INVENTORY`, so a minimal request must include at least one)
- `COMMISSIONING` status → `ipAddress` required; `monitoringEnabled` is forced `true` regardless of what is sent
- `ACTIVE` status → `ipAddress` and `locationId` required

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
search?:           string          // free-text
sortBy?:           'createdAt' | 'updatedAt' | 'name' | 'status'  // default: createdAt
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

---

### `GET /api/devices/:id` — Get by ID
**Status:** 200 | 404

```ts
// Response
{ success: true, data: DeviceDTO }
```

---

**Device status lifecycle:**

| Transition | Requirements | Side effects |
|------------|--------------|--------------|
| any → `COMMISSIONING` | `ipAddress` must be set on the device | `monitoringEnabled` forced `true` |
| any → `ACTIVE` | `ipAddress` and `locationId` must both be set | — |
| any → `DAMAGED` | — | polling automatically disabled |
| any → `INVENTORY` | — | polling automatically disabled |

`DAMAGED` is a side-state (e.g. hardware failure) and can be set from any status.

> When transitioning to `DAMAGED` or `INVENTORY`, the backend automatically disables the device's polling config. There is no need to also send `monitoringEnabled: false`.

---

### `PATCH /api/devices/:id` — Update
**Status:** 200 | 404

```ts
// Request body (all fields optional — send only what changes)
{
  name?: string
  status?: DeviceStatus
  category?: DeviceCategory | null
  ownerType?: DeviceOwner
  locationId?: string | null
  serialNumber?: string | null
  macAddress?: string | null
  ipAddress?: string | null
  description?: string | null
  installedDate?: string | null
  monitoringEnabled?: boolean
}

// Note: deviceModelId cannot be changed after creation

// Response
{ success: true, data: DeviceDTO }
```

---

### `DELETE /api/devices/:id` — Delete
**Status:** 204 | 400 | 404

```ts
// No request body

// Response: 204 No Content (no body)
```

> Permanently removes the device. Returns 400 if the id is not a valid UUID v4, 404 if no device exists with that id.

---

## Device Credentials `/api/devices/:id/credentials`

> **Response envelope:** Credentials endpoints return raw data directly — **no `{ success, data }` wrapper**.  
> Success: the DTO object directly (or 204 No Content).  
> Error: `{ error: string }`.

Sensitive fields (`snmpCommunity`, `snmpV3AuthKey`, `snmpV3PrivKey`, `httpPassword`) are **never returned in plaintext** — they are always masked as `'***'` in responses.

```ts
interface DeviceCredentialsResponseDTO {
  deviceId: string               // UUID
  snmpVersion: 1 | 2 | 3
  snmpCommunity: '***' | null    // masked; null if not set
  snmpV3AuthUser: string | null
  snmpV3AuthProto: 'MD5' | 'SHA' | null
  snmpV3AuthKey: '***' | null    // masked; null if not set
  snmpV3PrivProto: 'DES' | 'AES' | null
  snmpV3PrivKey: '***' | null    // masked; null if not set
  snmpPort: number               // default 161
  httpUsername: string | null
  httpPassword: '***' | null     // masked; null if not set
  httpPort: number               // default 443
  hasSnmpCredentials: boolean    // true if the effective SNMP secret is present
  hasHttpCredentials: boolean    // true if both httpUsername and httpPassword are set
}
```

---

### `PUT /api/devices/:id/credentials` — Set Credentials
**Status:** 200 | 400 | 404

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

```ts
// Response — DeviceCredentialsResponseDTO (raw, no wrapper)
```

> Returns 404 with `{ error: 'No credentials configured for this device' }` if no credentials have been saved yet.

---

### `DELETE /api/devices/:id/credentials` — Delete Credentials
**Status:** 204 | 404

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

> Returns 409 if a vendor with the same slug already exists.

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

> Returns 409 if the new slug is already taken by another vendor.

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
}

// Response
{ success: true, data: DeviceModelDTO }
```

> Returns 409 if a model with the same name already exists for that vendor.

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
**Status:** 200 | 400 | 404

```ts
// Request body (at least one field required)
{
  vendorId?: string    // UUID
  model?: string       // 1–150 chars
  deviceType?: DeviceType
}

// Response
{ success: true, data: DeviceModelDTO }
```

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
**Status:** 200 | 404

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

---

## Alerts `/api/alerts`

This is the **unified operational-alert list**. Every bounded context that detects an infrastructure problem records into this one store, so dashboards (and future ticketing) read a single place instead of chasing per-context lists. Both **device-availability** alerts and **wireless-link** alerts land here.

```ts
interface AlertDTO {
  id: string                        // UUID
  deviceId: string                  // UUID
  severity: AlertSeverity
  source: string                    // human-readable origin — e.g. "Disponibilidad", "Enlace inalámbrico"
  type: string                      // machine discriminator (see table); at most one OPEN alert per (deviceId, type)
  description: string               // human-readable detail line, ready to display
  details: Record<string, unknown>  // producer-specific structured payload — shape varies by source (see table)
  status: AlertStatus
  startedAt: string                 // ISO 8601
  resolvedAt: string | null         // ISO 8601 — null while alert is open
  notifiedAt: string | null         // ISO 8601 — null if Telegram send failed
  recoveryNotifiedAt: string | null // ISO 8601 — null if not yet resolved/sent
  durationSecs: number | null       // seconds device was offline; null while open
}
```

**Producers** — who writes alerts and what they put in `type` / `details`:

| `source` | `type` | `details` shape | Notes |
|----------|--------|-----------------|-------|
| `Disponibilidad` | `device_unreachable` | `{ consecutiveFailures: number, ipAddress: string \| null }` | Device stopped answering ICMP ping. Resolves automatically on recovery. |
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
type WirelessDeviceType      = 'STATION' | 'ACCESS_POINT'
type WirelessCollectionMethod = 'snmp' | 'http_api' | 'mixed'
type WirelessAlertSeverity   = 'WARNING' | 'CRITICAL'
```

```ts
interface WirelessMetricsDTO {
  signalRxDbm: number | null
  signalTxDbm: number | null
  noiseFloorDbm: number | null
  snrDb: number | null
  ccqPercent: number | null
  frequencyMhz: number | null
  channelWidthMhz: number | null
  throughputTxBps: number | null
  throughputRxBps: number | null
  throughputTxPps: number | null
  throughputRxPps: number | null
  lanStatus: string | null
  lanSpeedMbps: number | null
  lanDuplex: string | null
  uptimeSeconds: number | null
  cpuLoadPercent: number | null
  memoryUsedPercent: number | null
  firmwareVersion: string | null
  deviceName: string | null
  remoteApMac: string | null
  remoteApName: string | null
  distanceM: number | null
  latencyMs: number | null
  clientsConnected: number | null
}

interface WirelessStatusDTO {
  deviceId: string                        // UUID
  deviceType: WirelessDeviceType
  collectedAt: string                     // ISO 8601
  collectionMethod: WirelessCollectionMethod
  metrics: WirelessMetricsDTO
  activeAlerts: WirelessAlertDTO[]
  clients: WirelessClientDTO[]
}

interface WirelessAlertDTO {
  id: string                // UUID
  deviceId: string          // UUID
  metric: string            // e.g. "signal_rx_dbm", "latency_ms", "clock_drift_s", "firmware_version_changed", "remote_ap_mac_changed"
  severity: WirelessAlertSeverity
  threshold: number
  lastValue: number
  message: string
  triggeredAt: string       // ISO 8601
  clearedAt: string | null  // ISO 8601 — null while active
  isActive: boolean
}

interface WirelessClientDTO {
  macAddress: string
  ipAddress: string | null           // last known IP (sta[].lastip)
  signalRxDbm: number | null         // signal AP receives from this client (dBm)
  noiseFloorDbm: number | null       // client-side noise floor (dBm)
  distanceM: number | null           // distance to AP (m)
  uptimeSeconds: number | null       // association uptime (s)
  txLatencyMs: number | null         // TX latency (ms)
  dlLinkScore: number | null         // downlink link score 0–100
  ulLinkScore: number | null         // uplink link score 0–100
  dlCapacityKbps: number | null      // airMAX downlink capacity (kbps)
  ulCapacityKbps: number | null      // airMAX uplink capacity (kbps)
  dlCinr: number | null              // downlink CINR (dB)
  ulCinr: number | null              // uplink CINR (dB)
  txBytesTotal: string | null        // cumulative TX bytes since association (serialised bigint)
  rxBytesTotal: string | null        // cumulative RX bytes since association (serialised bigint)
  txPps: number | null               // current TX packets/s
  rxPps: number | null               // current RX packets/s
  // Remote CPE info (from sta[].remote — AP-side view of the CPE)
  remoteHostname: string | null
  remotePlatform: string | null      // CPE model string
  remoteVersion: string | null       // CPE firmware version
  remoteCpuLoad: number | null       // CPE CPU load %
  remoteTotalRam: number | null      // CPE total RAM (bytes)
  remoteFreeRam: number | null       // CPE free RAM (bytes)
  remoteSignal: number | null        // signal CPE receives from AP (dBm)
  remoteNoiseFloor: number | null    // CPE noise floor (dBm)
  remoteTxPower: number | null       // CPE TX power (dBm)
  remoteTxThroughputKbps: number | null
  remoteRxThroughputKbps: number | null
  remoteIpAddresses: string[]        // CPE IP addresses
}
```

---

### `POST /api/devices/:id/wireless/config` — Register Wireless Config
**Status:** 201 | 400 | 404 | 409

```ts
// Request body
{
  deviceType: 'STATION' | 'ACCESS_POINT'   // required
  ipAddress?: string | null                // IPv4 or IPv6; used for HTTP API polling
  intervalSecs?: number                    // 60–86400; default 3600
  enabled?: boolean                        // default true
  linkCapacityKbps?: number | null          // STATION only — provisioned uplink capacity (bps)
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

**Business rules:**
- `linkCapacityKbps` may only be set (non-null) for `STATION` devices — returns 400 for `ACCESS_POINT`.
- `clientsProvisionedLimit` may only be set (non-null) for `ACCESS_POINT` devices — returns 400 for `STATION`.

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
  linkCapacityKbps?: number | null         // STATION only — returns 400 if device is ACCESS_POINT
  clientsProvisionedLimit?: number | null // ACCESS_POINT only — returns 400 if device is STATION
}

// Response — same shape as POST 201 above
```

> Returns 404 if no config exists for this device — use `POST` to create it first.

---

### `DELETE /api/devices/:id/wireless/config` — Remove Config
**Status:** 204 | 400 | 404

```ts
// No request body
// Response: 204 No Content
```

> Removes wireless monitoring from the device. The device record itself is not affected.  
> Returns 404 if no config exists.

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
  deviceId: string      // UUID
  requestedAt: string   // ISO 8601 — when the reboot was accepted
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
  id: string          // UUID
  fullName: string
  phone: string
  email: string | null
  cedula: string | null
  createdAt: string   // ISO 8601
  updatedAt: string
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
  id: string             // UUID
  name: string
  downloadMbps: number   // positive integer
  uploadMbps: number     // positive integer
  monthlyPrice: number   // non-negative decimal
  description: string | null
  isActive: boolean
  createdAt: string      // ISO 8601
  updatedAt: string
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
type ContractedServiceStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'

interface ContractedServiceDTO {
  id: string                        // UUID
  customerId: string                // UUID
  servicePlanId: string             // UUID
  deviceId: string | null           // UUID — the CPE device assigned to this service
  status: ContractedServiceStatus
  startDate: string                 // ISO 8601
  createdAt: string                 // ISO 8601
  updatedAt: string
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

| Transition | Requirements | Notes |
|------------|--------------|-------|
| (create) → `PENDING` | — | only possible initial status |
| `PENDING` / `SUSPENDED` → `ACTIVE` | `deviceId` must be set | 409 `"Cannot activate a contracted service without a device assigned"` otherwise |
| `PENDING` / `ACTIVE` → `SUSPENDED` | — | triggers suspension side effects (see below) |
| any → `CANCELLED` | — | **terminal** — every later update returns 409 `"Cannot modify a cancelled contracted service"` |
| any → `PENDING` | **not allowed** | `PENDING` is not a valid `status` value on `PUT` — returns 400 |

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
  contractedServiceId: string  // UUID
  servicePlanId: string        // UUID
  planName: string             // snapshot at generation time
  monthlyPrice: number         // snapshot at generation time
}

interface BillDTO {
  id: string                // UUID
  customerId: string        // UUID
  period: string            // 'YYYY-MM', e.g. '2026-07'
  status: BillStatus
  issueDate: string         // ISO 8601
  dueDate: string           // ISO 8601
  paidAt: string | null     // ISO 8601 — null until marked paid
  total: number             // sum of lineItems monthlyPrice
  lineItems: BillLineItemDTO[]
  createdAt: string         // ISO 8601
  updatedAt: string
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

| Code | Meaning |
|------|---------|
| 400 | Validation error or business rule violation (e.g. duplicate MAC/IP) |
| 401 | Missing, expired, or invalid JWT |
| 403 | Valid token but insufficient role for this operation |
| 404 | Resource not found |
| 409 | Conflict — resource already exists or cannot be deleted (e.g. vendor has models, model has devices) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |
| 503 | Dependent system unavailable — enforcement router unreachable or enforcement not configured (enforcement endpoints only) |

Error body: `{ success: false, error: string }` (standard endpoints) / `{ error: string }` (credentials, polling, wireless)
