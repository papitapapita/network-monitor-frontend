// ============================================================
// Enums
// ============================================================

export type DeviceStatus =
  | 'INVENTORY'
  | 'ACTIVE'
  | 'MAINTENANCE'
  | 'DAMAGED'
  | 'DECOMMISSIONED';

export type DeviceCategory =
  | 'CORE'
  | 'DISTRIBUTION'
  | 'POE'
  | 'ACCESS_POINT'
  | 'CLIENT_CPE';

export type DeviceOwnerType = 'COMPANY' | 'CLIENT';

export type LocationType =
  | 'TOWER'
  | 'NODE'
  | 'DATACENTER'
  | 'POP'
  | 'WAREHOUSE'
  | 'OFFICE';

export type DeviceType =
  | 'ANTENNA'
  | 'OTHER'
  | 'RADIO'
  | 'ROUTER'
  | 'ROUTERBOARD'
  | 'SERVER'
  | 'SWITCH';

export type Manufacturer =
  | 'TP_LINK'
  | 'MIKROTIK'
  | 'UBIQUITI'
  | 'MIMOSA'
  | 'TENDA'
  | 'OTHER';

export type PollingStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

// ============================================================
// Device
// ============================================================

export interface DeviceResponseDTO {
  id: string;
  deviceModelId: string;
  locationId: string | null;
  status: DeviceStatus;
  category: DeviceCategory | null;
  ownerType: DeviceOwnerType;
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
  ownerType: DeviceOwnerType;
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
// Location
// ============================================================

export interface LocationResponseDTO {
  id: string;
  name: string;
  type: LocationType;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationDTO {
  name: string;
  type: LocationType;
  municipality?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
}

export interface UpdateLocationDTO {
  name?: string;
  type?: LocationType;
  municipality?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
}

export interface ListLocationsQuery {
  limit?: number;
  offset?: number;
  type?: LocationType;
}

export interface LocationListResponse {
  locations: LocationResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

// ============================================================
// Device Model
// ============================================================

export interface DeviceModelResponseDTO {
  id: string;
  manufacturer: Manufacturer;
  model: string;
  deviceType: DeviceType;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceModelListResponse {
  deviceModels: DeviceModelResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

// ============================================================
// Polling
// ============================================================

export interface PollingMetrics {
  latencyMs: number;
}

export interface PollingResultDTO {
  id: string;
  deviceId: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  metrics: PollingMetrics | null;
  deviceStatus: PollingStatus;
}

export interface PollingStatusDTO {
  deviceId: string;
  pollingEnabled: boolean;
  intervalSeconds: number;
  failuresBeforeDown: number;
  lastPolled: string | null;
  nextScheduled: string | null;
  currentStatus: PollingStatus;
  lastResult: PollingResultDTO | null;
  consecutiveFailures: number;
}

export interface PollingHistoryStats {
  successRate: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  uptimePercentage: number;
}

export interface PollingHistoryResponse {
  deviceId: string;
  results: PollingResultDTO[];
  totalCount: number;
  statistics: PollingHistoryStats;
}

export interface PollingHistoryQuery {
  fromDate?: string;
  toDate?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface CreatePollingConfigDTO {
  ipAddress?: string | null;
  intervalSeconds?: number;
  failuresBeforeDown?: number;
  enabled?: boolean;
}

export interface PollingConfigDTO {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  intervalSeconds: number;
  failuresBeforeDown: number;
  enabled: boolean;
}

export interface UpdatePollingConfigDTO {
  intervalSeconds?: number;
  failuresBeforeDown?: number;
  enabled?: boolean;
}

export interface ManualPollResultDTO {
  deviceId: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  message: string;
  timestamp: string;
  metrics: PollingMetrics | null;
  deviceStatus: PollingStatus;
}

// ============================================================
// Alerts
// ============================================================

export type AlertSeverity = 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'RESOLVED';

export interface AlertDTO {
  id: string;
  deviceId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  startedAt: string;
  resolvedAt: string | null;
  notifiedAt: string | null;
  recoveryNotifiedAt: string | null;
  durationSecs: number | null;
}

export interface AlertListResponse {
  alerts: AlertDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface ListAlertsQuery {
  deviceId?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// Shared
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
