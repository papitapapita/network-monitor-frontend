export type DeviceStatus =
  | 'INVENTORY'
  | 'ACTIVE'
  | 'DAMAGED';

export type DeviceCategory =
  | 'CPE'
  | 'AP'
  | 'ROUTERBOARD'
  | 'SMART_SWITCH'
  | 'SMART_SWITCH_POE'
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
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

export interface DeviceListResponse {
  devices: DeviceResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeviceModelDTO {
  vendorId: string;
  model: string;
  deviceType: DeviceType;
}

export interface UpdateDeviceModelDTO {
  vendorId?: string;
  model?: string;
  deviceType?: DeviceType;
}

export interface DeviceModelListResponse {
  deviceModels: DeviceModelResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
