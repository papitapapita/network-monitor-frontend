/**
 * Network Device Types
 *
 * TypeScript definitions matching backend DTOs for REQ-002 Network Device CRUD
 */

// Enums
export enum NetworkDeviceType {
  ROUTER = 'ROUTER',
  SWITCH = 'SWITCH',
  ACCESS_POINT = 'ACCESS_POINT',
  FIREWALL = 'FIREWALL',
  LOAD_BALANCER = 'LOAD_BALANCER',
  UNKNOWN = 'UNKNOWN'
}

export enum NetworkDeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
  UNKNOWN = 'UNKNOWN'
}

export enum ConnectivityType {
  ETHERNET = 'ETHERNET',
  FIBER_OPTIC = 'FIBER_OPTIC',
  WIRELESS = 'WIRELESS',
  COPPER = 'COPPER'
}

export enum ManagementProtocol {
  SNMP = 'SNMP',
  SSH = 'SSH',
  TELNET = 'TELNET',
  HTTP = 'HTTP',
  HTTPS = 'HTTPS',
  OTHER = 'OTHER'
}

export enum ActivationStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE'
}

// Polling Configuration
export interface PollingConfiguration {
  id: string;
  deviceId: string;
  intervalSeconds: number;
  retryAttempts: number;
  enabled: boolean;
}

// Network Device Response DTO
export interface NetworkDeviceResponseDTO {
  id: string;
  name: string | null;
  deviceType: string;
  status: string;
  description: string | null;
  ipAddress: string;
  macAddress: string;
  connectivityType: string;
  managementProtocol: string;
  managementPort: number;
  enabledRemoteAccess: boolean;
  deviceId: string;
  location: string | null;
  activationStatus: string;
  activatedAt: string | null;
  activatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  deletionReason: string | null;
  pollingConfiguration: PollingConfiguration;
}

// Create Network Device DTO
export interface CreateNetworkDeviceDTO {
  ipAddress: string;
  macAddress: string;
  deviceId: string;
  activateImmediately?: boolean;

  // Optional fields for ACTIVE mode
  name?: string;
  deviceType?: string;
  description?: string;
  location?: string;
  connectivityType?: string;
  managementProtocol?: string;
  managementPort?: number;
  enabledRemoteAccess?: boolean;
}

// Update Network Device DTO
export interface UpdateNetworkDeviceDTO {
  name?: string;
  description?: string | null;
  location?: string | null;
  managementProtocol?: string;
  managementPort?: number;
  enabledRemoteAccess?: boolean;
}

// Activate Network Device DTO
export interface ActivateNetworkDeviceDTO {
  name: string;
  deviceType: string;
  description?: string;
  location?: string;
  connectivityType?: string;
  managementProtocol?: string;
  managementPort?: number;
  enabledRemoteAccess?: boolean;
}

// Soft Delete DTO
export interface SoftDeleteNetworkDeviceDTO {
  reason?: string;
}

// List Response DTO
export interface NetworkDeviceListResponseDTO {
  devices: NetworkDeviceResponseDTO[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// List Query Params
export interface ListNetworkDevicesQuery {
  limit?: number;
  offset?: number;
  status?: string;
  deviceType?: string;
  activationStatus?: string;
}

// Bulk Import Response DTO
export interface BulkImportResponseDTO {
  success: boolean;
  created: number;
  failed: number;
  total: number;
  validationErrors?: Array<{
    row: number;
    field: string;
    value: string;
    error: string;
  }>;
  duration: number;
}

// API Response Wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// WebSocket Message Types
export enum WebSocketMessageType {
  DEVICE_STATUS_CHANGED = 'DEVICE_STATUS_CHANGED',
  DEVICE_CREATED = 'DEVICE_CREATED',
  DEVICE_UPDATED = 'DEVICE_UPDATED',
  DEVICE_DELETED = 'DEVICE_DELETED',
  DEVICE_ACTIVATED = 'DEVICE_ACTIVATED',
  DEVICE_RESTORED = 'DEVICE_RESTORED'
}

export interface WebSocketMessage<T = any> {
  type: WebSocketMessageType;
  payload: T;
  timestamp: string;
}

export interface DeviceStatusChangedPayload {
  deviceId: string;
  previousStatus: string;
  newStatus: string;
  timestamp: string;
}

export interface DeviceLifecyclePayload {
  deviceId: string;
  deviceName: string | null;
  ipAddress: string;
  timestamp: string;
}
