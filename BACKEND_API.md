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

## Enums

```ts
type LocationType   = 'TOWER' | 'NODE' | 'DATACENTER' | 'POP' | 'WAREHOUSE' | 'OFFICE' | 'OTHER'
type DeviceStatus   = 'ACTIVE' | 'DAMAGED' | 'INVENTORY'
type DeviceCategory = 'CPE' | 'WIRELESS_CPE' | 'AP' | 'ROUTERBOARD' | 'SMART_SWITCH' | 'SMART_SWITCH_POE' | 'OTHER'
type DeviceOwner    = 'COMPANY' | 'CLIENT'
type DeviceType     = 'ANTENNA' | 'OTHER' | 'RADIO' | 'ROUTER' | 'ROUTERBOARD' | 'SERVER' | 'SWITCH'
type PollingStatus      = 'SUCCESS' | 'FAILED' | 'SKIPPED'
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
- `ACTIVE` status → `ipAddress` required
- Any `category` set → `ipAddress` required

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
  httpPort: number               // default 80
  hasSnmpCredentials: boolean    // true if the effective SNMP secret is present
  hasHttpCredentials: boolean    // true if both httpUsername and httpPassword are set
}
```

---

### `PUT /api/devices/:id/credentials` — Set Credentials
**Status:** 200 | 400 | 404

Fully replaces the stored credentials for the device (upsert).

```ts
// Request body
{
  snmpVersion: 1 | 2 | 3         // required

  // SNMP v1/v2 fields
  snmpCommunity?: string | null  // required when snmpVersion = 1 or 2

  // SNMP v3 fields
  snmpV3AuthUser?: string | null   // required when snmpVersion = 3
  snmpV3AuthProto?: 'MD5' | 'SHA' | null  // required when snmpVersion = 3
  snmpV3AuthKey?: string | null    // required when snmpVersion = 3
  snmpV3PrivProto?: 'DES' | 'AES' | null  // optional privacy protocol
  snmpV3PrivKey?: string | null    // required when snmpV3PrivProto is set

  // HTTP / web-UI credentials (optional for all SNMP versions)
  httpUsername?: string | null
  httpPassword?: string | null

  // Ports
  snmpPort?: number   // 1–65535; default 161
  httpPort?: number   // 1–65535; default 80
}

// Response — DeviceCredentialsResponseDTO (raw, no wrapper)
```

**Business rules:**
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

```ts
interface AlertDTO {
  id: string                        // UUID
  deviceId: string                  // UUID
  severity: AlertSeverity
  status: AlertStatus
  startedAt: string                 // ISO 8601
  resolvedAt: string | null         // ISO 8601 — null while alert is open
  notifiedAt: string | null         // ISO 8601 — null if Telegram send failed
  recoveryNotifiedAt: string | null // ISO 8601 — null if not yet resolved/sent
  durationSecs: number | null       // seconds device was offline; null while open
}
```

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
  txRateMbps: number | null
  rxRateMbps: number | null
  frequencyMhz: number | null
  channelWidthMhz: number | null
  txPowerDbm: number | null
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
  clientsProvisioned: number | null
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
  metric: string            // e.g. "signal_rx_dbm"
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
  intervalSecs?: number                    // 30–86400; default 3600
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
  intervalSecs?: number                   // 30–86400
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
| 409 | Conflict — resource already exists or cannot be deleted (e.g. vendor has models, model has devices) |
| 500 | Unexpected server error |

Error body: `{ success: false, error: string }` (standard endpoints) / `{ error: string }` (credentials, polling, wireless)
