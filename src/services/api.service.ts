import {
  DeviceResponseDTO,
  DeviceListResponse,
  CreateDeviceDTO,
  UpdateDeviceDTO,
  ListDevicesQuery,
  VendorDTO,
  VendorListResponse,
  CreateVendorDTO,
  UpdateVendorDTO,
  DeviceModelResponseDTO,
  DeviceModelListResponse,
  CreateDeviceModelDTO,
  UpdateDeviceModelDTO,
} from '../types/device.types';
import {
  LocationResponseDTO,
  LocationListResponse,
  CreateLocationDTO,
  UpdateLocationDTO,
  ListLocationsQuery,
} from '../types/location.types';
import {
  PollingStatusDTO,
  PollingHistoryResponse,
  PollingHistoryQuery,
  CreatePollingConfigDTO,
  PollingConfigDTO,
  UpdatePollingConfigDTO,
  ManualPollResultDTO,
} from '../types/polling.types';
import { AlertListResponse, ListAlertsQuery } from '../types/alert.types';
import { NetworkScanRequest, NetworkScanResult } from '../types/network-scan.types';
import { ApiResponse } from '../types/common.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (response.status === 204) {
        return { success: true };
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      // Some endpoints return a wrapped ApiResponse; others return the DTO directly.
      if (data !== null && typeof data === 'object' && 'success' in data && typeof data.success === 'boolean') {
        return data as ApiResponse<T>;
      }
      return { success: true, data: data as T };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  private buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const p = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null && val !== '') {
        p.append(key, String(val));
      }
    }
    const str = p.toString();
    return str ? `?${str}` : '';
  }

  // ============================================================
  // Devices
  // ============================================================

  async createDevice(data: CreateDeviceDTO): Promise<ApiResponse<DeviceResponseDTO>> {
    return this.request<DeviceResponseDTO>('/devices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async listDevices(query?: ListDevicesQuery): Promise<ApiResponse<DeviceListResponse>> {
    const qs = this.buildQuery({
      limit: query?.limit,
      offset: query?.offset,
      status: query?.status,
      category: query?.category,
      owner: query?.owner,
      locationId: query?.locationId,
      deviceModelId: query?.deviceModelId,
      monitoringEnabled: query?.monitoringEnabled,
      search: query?.search,
      sortBy: query?.sortBy,
      sortOrder: query?.sortOrder
    });
    return this.request<DeviceListResponse>(`/devices${qs}`);
  }

  async getDevice(id: string): Promise<ApiResponse<DeviceResponseDTO>> {
    return this.request<DeviceResponseDTO>(`/devices/${id}`);
  }

  async updateDevice(id: string, data: UpdateDeviceDTO): Promise<ApiResponse<DeviceResponseDTO>> {
    return this.request<DeviceResponseDTO>(`/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteDevice(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/devices/${id}`, { method: 'DELETE' });
  }

  // ============================================================
  // Locations
  // ============================================================

  async createLocation(data: CreateLocationDTO): Promise<ApiResponse<LocationResponseDTO>> {
    return this.request<LocationResponseDTO>('/locations', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async listLocations(query?: ListLocationsQuery): Promise<ApiResponse<LocationListResponse>> {
    const qs = this.buildQuery({
      limit: query?.limit,
      offset: query?.offset,
      type: query?.type
    });
    return this.request<LocationListResponse>(`/locations${qs}`);
  }

  async getLocation(id: string): Promise<ApiResponse<LocationResponseDTO>> {
    return this.request<LocationResponseDTO>(`/locations/${id}`);
  }

  async updateLocation(id: string, data: UpdateLocationDTO): Promise<ApiResponse<LocationResponseDTO>> {
    return this.request<LocationResponseDTO>(`/locations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // ============================================================
  // Vendors
  // ============================================================

  async listVendors(query?: { limit?: number; offset?: number }): Promise<ApiResponse<VendorListResponse>> {
    const qs = this.buildQuery({ limit: query?.limit, offset: query?.offset });
    return this.request<VendorListResponse>(`/vendors${qs}`);
  }

  async getVendor(id: string): Promise<ApiResponse<VendorDTO>> {
    return this.request<VendorDTO>(`/vendors/${id}`);
  }

  async createVendor(data: CreateVendorDTO): Promise<ApiResponse<VendorDTO>> {
    return this.request<VendorDTO>('/vendors', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateVendor(id: string, data: UpdateVendorDTO): Promise<ApiResponse<VendorDTO>> {
    return this.request<VendorDTO>(`/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteVendor(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/vendors/${id}`, { method: 'DELETE' });
  }

  // ============================================================
  // Device Models
  // ============================================================

  async listDeviceModels(query?: { limit?: number; offset?: number }): Promise<ApiResponse<DeviceModelListResponse>> {
    const qs = this.buildQuery({ limit: query?.limit, offset: query?.offset });
    return this.request<DeviceModelListResponse>(`/device-models${qs}`);
  }

  async getDeviceModel(id: string): Promise<ApiResponse<DeviceModelResponseDTO>> {
    return this.request<DeviceModelResponseDTO>(`/device-models/${id}`);
  }

  async createDeviceModel(data: CreateDeviceModelDTO): Promise<ApiResponse<DeviceModelResponseDTO>> {
    return this.request<DeviceModelResponseDTO>('/device-models', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateDeviceModel(id: string, data: UpdateDeviceModelDTO): Promise<ApiResponse<DeviceModelResponseDTO>> {
    return this.request<DeviceModelResponseDTO>(`/device-models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteDeviceModel(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/device-models/${id}`, { method: 'DELETE' });
  }

  // ============================================================
  // Polling
  // ============================================================

  async getPollingStatus(deviceId: string): Promise<ApiResponse<PollingStatusDTO>> {
    return this.request<PollingStatusDTO>(`/devices/${deviceId}/polling/status`);
  }

  async getPollingHistory(
    deviceId: string,
    query?: PollingHistoryQuery
  ): Promise<ApiResponse<PollingHistoryResponse>> {
    const qs = this.buildQuery({
      fromDate: query?.fromDate,
      toDate: query?.toDate,
      status: query?.status,
      limit: query?.limit,
      offset: query?.offset
    });
    return this.request<PollingHistoryResponse>(`/devices/${deviceId}/polling/history${qs}`);
  }

  async createPollingConfig(
    deviceId: string,
    data: CreatePollingConfigDTO
  ): Promise<ApiResponse<PollingConfigDTO>> {
    return this.request<PollingConfigDTO>(`/devices/${deviceId}/polling/config`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updatePollingConfig(
    deviceId: string,
    data: UpdatePollingConfigDTO
  ): Promise<ApiResponse<void>> {
    return this.request<void>(`/devices/${deviceId}/polling/config`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async triggerPoll(deviceId: string): Promise<ApiResponse<ManualPollResultDTO>> {
    return this.request<ManualPollResultDTO>(`/devices/${deviceId}/poll`, {
      method: 'POST'
    });
  }

  // ============================================================
  // Alerts
  // ============================================================

  async listAlerts(query?: ListAlertsQuery): Promise<ApiResponse<AlertListResponse>> {
    const qs = this.buildQuery({
      deviceId: query?.deviceId,
      limit: query?.limit,
      offset: query?.offset
    });
    return this.request<AlertListResponse>(`/alerts${qs}`);
  }

  // ============================================================
  // Network Scan
  // ============================================================

  async scanNetwork(data: NetworkScanRequest): Promise<ApiResponse<NetworkScanResult>> {
    return this.request<NetworkScanResult>('/network/scan', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

import { mockApiService } from './mock-api.service';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export const apiService = USE_MOCK ? mockApiService : new ApiService();
export default apiService;
