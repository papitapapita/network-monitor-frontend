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
}

export interface CreateDeviceDTO {
  deviceModelId: string;
  name: string;
  ownerType?: DeviceOwnerType | null;
  status?: DeviceStatus;
  category?: DeviceCategory | null;
  locationId?: string | null;
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
  deviceModelId?: string;
  monitoringEnabled?: boolean;
  /**
   * Soft-deleted devices are hidden unless asked for: 'false' (the default) is
   * live devices only, 'true' is the recycle bin, 'any' is both.
   */
  deleted?: 'true' | 'false' | 'any';
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status' | 'deletedAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface DeviceListResponse {
  devices: DeviceResponseDTO[];
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
  hasSnmpCredentials: boolean;
  hasHttpCredentials: boolean;
}

export interface SetDeviceCredentialsDTO {
  // HTTP / web-UI credentials — the required pair, replaced on every call.
  httpUsername: string;
  httpPassword: string;
  httpPort?: number; // 1–65535; default 443

  // SNMP — optional, not consumed by any collector yet. Omit a field to keep the
  // stored value; send null to clear it. snmpVersion becomes required as soon as
  // any other SNMP field is sent.
  snmpVersion?: 1 | 2 | 3;
  snmpCommunity?: string | null;
  snmpV3AuthUser?: string | null;
  snmpV3AuthProto?: 'MD5' | 'SHA' | null;
  snmpV3AuthKey?: string | null;
  snmpV3PrivProto?: 'DES' | 'AES' | null;
  snmpV3PrivKey?: string | null;
  snmpPort?: number; // 1–65535; default 161
}
