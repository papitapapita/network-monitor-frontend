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

All API responses are wrapped:
```ts
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }
```

---

## Enums

```ts
type LocationType   = 'TOWER' | 'NODE' | 'DATACENTER' | 'POP' | 'WAREHOUSE' | 'OFFICE'
type DeviceStatus   = 'ACTIVE' | 'DAMAGED' | 'DECOMMISSIONED' | 'INVENTORY' | 'MAINTENANCE'
type DeviceCategory = 'CORE' | 'DISTRIBUTION' | 'POE' | 'ACCESS_POINT' | 'CLIENT_CPE'
type DeviceOwner    = 'COMPANY' | 'CLIENT'
type DeviceType     = 'ANTENNA' | 'OTHER' | 'RADIO' | 'ROUTER' | 'ROUTERBOARD' | 'SERVER' | 'SWITCH'
type Vendor         = 'TP_LINK' | 'MIKROTIK' | 'UBIQUITI' | 'MIMOSA' | 'TENDA' | 'OTHER'
type PollingStatus  = 'SUCCESS' | 'FAILED' | 'SKIPPED'
type DeviceOnlineStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN'
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
  ownerType: DeviceOwner
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

interface DeviceModelDTO {
  id: string            // UUID
  manufacturer: Vendor
  model: string
  deviceType: DeviceType
  createdAt: string
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

### `GET /api/locations/:id` — Get by ID
**Status:** 200 | 404

```ts
// Response
{ success: true, data: LocationDTO }
```

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
  ownerType: DeviceOwner       // required
  status?: DeviceStatus        // default: INVENTORY
  category?: DeviceCategory | null
  locationId?: string | null   // UUID
  serialNumber?: string | null // max 100 chars
  macAddress?: string | null   // format AA:BB:CC:DD:EE:FF
  ipAddress?: string | null    // IPv4 or IPv6
  description?: string | null
  installedDate?: string | null // ISO 8601
  monitoringEnabled?: boolean  // default: false
}

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

## Device Models `/api/device-models`

These are read-only from the API (no create/update endpoints yet).

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

## Polling `/api/devices/:id/polling/*`

### `POST /api/devices/:id/poll` — Trigger Manual Poll
**Status:** 200 | 404

```ts
// No request body needed

// Response
{
  success: true,
  data: {
    deviceId: string
    status: PollingStatus
    message: string
    timestamp: string           // ISO 8601
    metrics: { latencyMs: number } | null
    deviceStatus: DeviceOnlineStatus
  }
}
```

---

### `GET /api/devices/:id/polling/status` — Current Status
**Status:** 200 | 404

```ts
// Response
{
  success: true,
  data: {
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
  success: true,
  data: {
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
  success: true,
  data: {
    id: string               // UUID
    deviceId: string         // UUID
    ipAddress: string | null
    intervalSeconds: number
    failuresBeforeDown: number
    enabled: boolean
  }
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
| 404 | Resource not found |
| 500 | Unexpected server error |

Error body: `{ success: false, error: string }`
