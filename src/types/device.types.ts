export type DeviceStatus =
  | 'INVENTORY'
  | 'COMMISSIONING'
  | 'ACTIVE'
  | 'DAMAGED'
  | 'DECOMMISSIONED';

// The role the unit plays in the network — not what kind of hardware it is
// (that is DeviceType, and it lives on the device model).
export type DeviceCategory =
  | 'CPE'
  | 'WIRELESS_CPE'
  | 'ACCESS_POINT'
  | 'GATEWAY'
  | 'AGGREGATION_SWITCH'
  | 'OTHER';

export type DeviceOwnerType = 'COMPANY' | 'CLIENT';

export type DeviceType =
  | 'ANTENNA'
  | 'OTHER'
  | 'RADIO'
  | 'ROUTER'
  | 'ROUTERBOARD'
  | 'SERVER'
  | 'SWITCH';

// ============================================================
// Device
// ============================================================

export interface DeviceResponseDTO {
  id: string;
  deviceModelId: string;
  locationId: string | null;
  /** The on-site probe agent that polls it; null = polled by the server itself. */
  agentId: string | null;
  status: DeviceStatus;
  category: DeviceCategory | null;
  ownerType: DeviceOwnerType | null;
  name: string;
  serialNumber: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  description: string | null;
  installedDate: string | null;
  monitoringEnabled: boolean;
  createdAt: string;
  updatedAt: string;

  /**
   * Soft delete. Null on anything a normal read returns — a deleted device is
   * absent from every listing and 404s on GET. They carry a value only on the
   * recycle bin (`listDevices({ deleted: 'true' })`) and on the record `restore`
   * hands back.
   */
  deletedAt: string | null;
  deletedBy: string | null;

  /**
   * Replacement lineage, both directions readable. A device record is one
   * physical box, so a swap creates a second record and links the two rather
   * than editing the model in place.
   */
  replacedAt: string | null;
  replacesDeviceId: string | null;
  replacedByDeviceId: string | null;

  /**
   * The device this one hangs off on the network — a CPE's AP, an AP's
   * switch, a switch's router. Null = a root (the gateway, or a device nobody
   * has linked yet). See `GET /api/topology`.
   */
  upstreamDeviceId: string | null;
}

export interface CreateDeviceDTO {
  deviceModelId: string;
  name: string;
  ownerType?: DeviceOwnerType | null;
  status?: DeviceStatus;
  category?: DeviceCategory | null;
  locationId?: string | null;
  /**
   * Omitted → the only non-revoked agent, or the server when there is none;
   * refused when there are two or more. `null` always means the server.
   */
  agentId?: string | null;
  /** The device it hangs off; null = a root. Refused for itself, a loop, or an upstream not ACTIVE/COMMISSIONING. */
  upstreamDeviceId?: string | null;
  serialNumber?: string | null;
  macAddress?: string | null;
  ipAddress?: string | null;
  description?: string | null;
  installedDate?: string | null;
  monitoringEnabled?: boolean;
}

export interface UpdateDeviceDTO {
  name?: string;
  /**
   * Correcting a mis-registered model — accepted only while the device is
   * INVENTORY (400 otherwise). Re-sending the model the device already has is a
   * no-op that succeeds in any status.
   */
  deviceModelId?: string;
  status?: DeviceStatus;
  category?: DeviceCategory | null;
  ownerType?: DeviceOwnerType;
  locationId?: string | null;
  /** null = polled by the server; a revoked agent is refused. */
  agentId?: string | null;
  /** The device it hangs off; null = a root. Refused for itself, a loop, or an upstream not ACTIVE/COMMISSIONING. */
  upstreamDeviceId?: string | null;
  serialNumber?: string | null;
  macAddress?: string | null;
  ipAddress?: string | null;
  description?: string | null;
  installedDate?: string | null;
  monitoringEnabled?: boolean;
}

export interface ListDevicesQuery {
  limit?: number;
  offset?: number;
  status?: DeviceStatus;
  category?: DeviceCategory;
  owner?: DeviceOwnerType;
  locationId?: string;
  /** An agent's id, or 'none' for the devices the server polls itself. */
  agentId?: string;
  deviceModelId?: string;
  monitoringEnabled?: boolean;
  /**
   * Soft-deleted devices are hidden unless asked for: 'false' (the default) is
   * live devices only, 'true' is the recycle bin, 'any' is both.
   */
  deleted?: 'true' | 'false' | 'any';
  search?: string;
  /**
   * Matches monitored devices only, and `total` counts the same set. UNKNOWN
   * includes monitored devices never polled.
   */
  connectivity?: ConnectivityStatus;
  /**
   * `downSince` ASC (its default) puts the longest outage first; devices not
   * down follow, unmonitored ones always last.
   */
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status' | 'deletedAt' | 'ipAddress' | 'downSince';
  sortOrder?: 'ASC' | 'DESC';
}

/** The list's own vocabulary — not the polling endpoints' ONLINE/OFFLINE. */
export type ConnectivityStatus = 'UP' | 'DOWN' | 'UNKNOWN';

export interface DeviceConnectivity {
  status: ConnectivityStatus;
  /** When the current outage began; null unless DOWN. */
  downSince: string | null;
  /** Last successful ping. */
  lastSeen: string | null;
}

/**
 * A list row: the device plus its current reachability, so the list needs no
 * per-device polling calls. `GET /api/devices/:id` returns a plain DTO.
 */
export interface DeviceListItemDTO extends DeviceResponseDTO {
  /**
   * Null when monitoring is off — a state recorded before it was switched off
   * is stale and not shown. A monitored device never polled is UNKNOWN.
   */
  connectivity: DeviceConnectivity | null;
}

export interface DeviceListResponse {
  devices: DeviceListItemDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

/**
 * The three statuses a unit that is off the network can hold. Each needs an
 * identifier you can read off the box, none of them polls, and they are the
 * only values `replaceDevice` accepts for the outgoing unit.
 */
export type RetiredDeviceStatus = 'INVENTORY' | 'DAMAGED' | 'DECOMMISSIONED';

/**
 * Swapping one physical box for another. Everything the new unit does not carry
 * itself — location, category, owner, the released IP, the credentials and the
 * customer's contracted service — is inherited from the unit being retired.
 */
export interface ReplaceDeviceDTO {
  deviceModelId: string;
  /** Where the outgoing unit lands: back in stock, broken, or retired for good. */
  retiredStatus: RetiredDeviceStatus;
  /** Defaults to the retired unit's name. */
  name?: string;
  /** At least one of serialNumber / macAddress is required — it is a different box. */
  serialNumber?: string;
  macAddress?: string;
  description?: string;
  /** ISO 8601; defaults to now. */
  installedDate?: string;
}

export interface ReplaceDeviceResultDTO {
  retiredDevice: DeviceResponseDTO;
  newDevice: DeviceResponseDTO;
  /**
   * True when the new model has no radio, so the site's wireless config was
   * deleted along with the swap. Nothing re-creates it — worth saying loudly.
   */
  wirelessConfigRemoved: boolean;
  credentialsTransferred: boolean;
  contractedServiceTransferred: boolean;
  /** Devices that hung off the old unit, now hanging off the new one (DEV-185). */
  downstreamDevicesMoved: number;
}

/**
 * `POST /devices/:id/swap-hardware`: two existing units that physically traded
 * places. Model, serial and MAC are exchanged; everything else — IP, location,
 * status, credentials, service, wireless config, history — stays with each
 * record, because history follows the site, not the box (DEV-161).
 */
export interface SwapHardwareResultDTO {
  /** `:id`, now carrying the other unit's hardware. */
  device: DeviceResponseDTO;
  /** `otherDeviceId`, now carrying `:id`'s former hardware. */
  otherDevice: DeviceResponseDTO;
}

// ============================================================
// Vendor
// ============================================================

export interface VendorDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorListResponse {
  vendors: VendorDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface CreateVendorDTO {
  name: string;
  slug: string;
  description?: string | null;
}

export interface UpdateVendorDTO {
  name?: string;
  slug?: string;
  description?: string | null;
}

// ============================================================
// Device Model
// ============================================================

export interface DeviceModelResponseDTO {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  model: string;
  deviceType: DeviceType;
  isWireless: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeviceModelDTO {
  vendorId: string;
  model: string;
  deviceType: DeviceType;
  isWireless: boolean;
}

export interface UpdateDeviceModelDTO {
  vendorId?: string;
  model?: string;
  deviceType?: DeviceType;
  isWireless?: boolean;
}

export interface DeviceModelListResponse {
  deviceModels: DeviceModelResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

// ============================================================
// Device Credentials
// ============================================================

export interface DeviceCredentialsResponseDTO {
  deviceId: string;
  snmpVersion: 1 | 2 | 3;
  snmpCommunity: '***' | null;
  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;
  snmpV3AuthKey: '***' | null;
  snmpV3PrivProto: 'DES' | 'AES' | null;
  snmpV3PrivKey: '***' | null;
  snmpPort: number;
  httpUsername: string | null;
  httpPassword: '***' | null;
  httpPort: number;
  /** Default 22. RouterOS backups log in here with the HTTP login (BKP-054). */
  sshPort: number;
  /** Default 8728. Live router traffic reads the RouterOS API here with the HTTP login (MON-060). */
  apiPort: number;
  hasSnmpCredentials: boolean;
  hasHttpCredentials: boolean;
}

/** The same record with every secret in plaintext — only from the reveal endpoint (DEV-134). */
export interface RevealedDeviceCredentialsDTO {
  deviceId: string;
  snmpVersion: 1 | 2 | 3;
  snmpCommunity: string | null;
  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;
  snmpV3AuthKey: string | null;
  snmpV3PrivProto: 'DES' | 'AES' | null;
  snmpV3PrivKey: string | null;
  snmpPort: number;
  httpUsername: string | null;
  httpPassword: string | null;
  httpPort: number;
  sshPort: number;
  apiPort: number;
}

export interface CredentialRevealUnlockDTO {
  /** Sent as `X-Credential-Reveal-Token`; opens nothing but the reveal endpoint. */
  revealToken: string;
  expiresInSeconds: number;
}

export interface SetDeviceCredentialsDTO {
  // A device needs an HTTP login, SNMP access, or both (DEV-133). Every field
  // is optional: omit it to keep the stored value, send null to clear it.

  // HTTP / web-UI login — send both, null both to clear, or omit both to keep.
  httpUsername?: string | null;
  httpPassword?: string | null;
  httpPort?: number; // 1–65535; omit to keep the stored value (default 443)
  sshPort?: number; // 1–65535; omit to keep the stored value (default 22)
  apiPort?: number; // 1–65535; omit to keep the stored value (default 8728)

  // SNMP — Mimosa is polled with these. snmpVersion becomes required as soon
  // as any other SNMP field is sent.
  snmpVersion?: 1 | 2 | 3;
  snmpCommunity?: string | null;
  snmpV3AuthUser?: string | null;
  snmpV3AuthProto?: 'MD5' | 'SHA' | null;
  snmpV3AuthKey?: string | null;
  snmpV3PrivProto?: 'DES' | 'AES' | null;
  snmpV3PrivKey?: string | null;
  snmpPort?: number; // 1–65535; default 161
}
