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
  DeviceCredentialsResponseDTO,
  SetDeviceCredentialsDTO,
} from '../types/device.types';
import {
  LocationResponseDTO,
  LocationListResponse,
  CreateLocationDTO,
  UpdateLocationDTO,
  ListLocationsQuery,
} from '../types/location.types';
import { LocationMapResponse } from '../types/map.types';
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
import {
  WirelessConfigDTO,
  WirelessStatusDTO,
  WirelessAlertDTO,
  WirelessClientsResponse,
  WirelessPollResult,
  WirelessHistoryResponse,
  WirelessHistoryQuery,
  WirelessAlertHistoryQuery,
  CreateWirelessConfigDTO,
  UpdateWirelessConfigDTO,
} from '../types/wireless.types';
import { ApiResponse } from '../types/common.types';
import { LoginResponseDTO } from '../types/auth.types';
import {
  CustomerDTO,
  CustomerListResponse,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  ServicePlanDTO,
  ServicePlanListResponse,
  CreateServicePlanDTO,
  UpdateServicePlanDTO,
  ContractedServiceDTO,
  ContractedServiceListResponse,
  CreateContractedServiceDTO,
  UpdateContractedServiceDTO,
} from '../types/customer.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 204) {
        return { success: true };
      }

      if (response.status === 403) {
        return { success: false, error: 'No tienes permisos suficientes para realizar esta acción.' };
      }

      if (response.status === 401) {
        this.token = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('nms_token');
          localStorage.removeItem('nms_user');
          window.dispatchEvent(new Event('nms:unauthorized'));
        }
        return { success: false, error: 'Sesión expirada. Por favor inicia sesión nuevamente.' };
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

  async login(email: string, password: string): Promise<ApiResponse<LoginResponseDTO>> {
    return this.request<LoginResponseDTO>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
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
  // Device Credentials
  // ============================================================

  async getDeviceCredentials(deviceId: string): Promise<ApiResponse<DeviceCredentialsResponseDTO>> {
    return this.request<DeviceCredentialsResponseDTO>(`/devices/${deviceId}/credentials`);
  }

  async setDeviceCredentials(deviceId: string, data: SetDeviceCredentialsDTO): Promise<ApiResponse<DeviceCredentialsResponseDTO>> {
    return this.request<DeviceCredentialsResponseDTO>(`/devices/${deviceId}/credentials`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteDeviceCredentials(deviceId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/devices/${deviceId}/credentials`, { method: 'DELETE' });
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

  async deleteLocation(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/locations/${id}`, { method: 'DELETE' });
  }

  async getLocationMapPins(): Promise<ApiResponse<LocationMapResponse>> {
    return this.request<LocationMapResponse>('/locations/map');
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

  // ============================================================
  // Wireless Monitoring
  // ============================================================

  async getWirelessConfig(deviceId: string): Promise<ApiResponse<WirelessConfigDTO>> {
    return this.request<WirelessConfigDTO>(`/devices/${deviceId}/wireless/config`);
  }

  async createWirelessConfig(deviceId: string, data: CreateWirelessConfigDTO): Promise<ApiResponse<WirelessConfigDTO>> {
    return this.request<WirelessConfigDTO>(`/devices/${deviceId}/wireless/config`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateWirelessConfig(deviceId: string, data: UpdateWirelessConfigDTO): Promise<ApiResponse<WirelessConfigDTO>> {
    return this.request<WirelessConfigDTO>(`/devices/${deviceId}/wireless/config`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteWirelessConfig(deviceId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/devices/${deviceId}/wireless/config`, { method: 'DELETE' });
  }

  async getWirelessStatus(deviceId: string): Promise<ApiResponse<WirelessStatusDTO>> {
    return this.request<WirelessStatusDTO>(`/devices/${deviceId}/wireless/status`);
  }

  async getWirelessClients(deviceId: string): Promise<ApiResponse<WirelessClientsResponse>> {
    return this.request<WirelessClientsResponse>(`/devices/${deviceId}/wireless/clients`);
  }

  async getWirelessAlerts(deviceId: string): Promise<ApiResponse<WirelessAlertDTO[]>> {
    return this.request<WirelessAlertDTO[]>(`/devices/${deviceId}/wireless/alerts`);
  }

  async triggerWirelessPoll(deviceId: string): Promise<ApiResponse<WirelessPollResult>> {
    return this.request<WirelessPollResult>(`/devices/${deviceId}/wireless/poll`, {
      method: 'POST'
    });
  }

  async getWirelessHistory(
    deviceId: string,
    query: WirelessHistoryQuery
  ): Promise<ApiResponse<WirelessHistoryResponse>> {
    const qs = this.buildQuery({
      from: query.from,
      to: query.to,
      limit: query.limit
    });
    return this.request<WirelessHistoryResponse>(`/devices/${deviceId}/wireless/history${qs}`);
  }

  async getWirelessAlertHistory(
    deviceId: string,
    query?: WirelessAlertHistoryQuery
  ): Promise<ApiResponse<WirelessAlertDTO[]>> {
    const qs = this.buildQuery({
      from: query?.from,
      to: query?.to,
      limit: query?.limit
    });
    return this.request<WirelessAlertDTO[]>(`/devices/${deviceId}/wireless/alerts/history${qs}`);
  }

  async getGlobalWirelessAlerts(deviceId?: string): Promise<ApiResponse<WirelessAlertDTO[]>> {
    const qs = this.buildQuery({ deviceId });
    return this.request<WirelessAlertDTO[]>(`/wireless/alerts${qs}`);
  }

  async getGlobalWirelessAlertHistory(
    deviceId: string,
    query?: WirelessAlertHistoryQuery
  ): Promise<ApiResponse<WirelessAlertDTO[]>> {
    const qs = this.buildQuery({
      deviceId,
      from: query?.from,
      to: query?.to,
      limit: query?.limit
    });
    return this.request<WirelessAlertDTO[]>(`/wireless/alerts/history${qs}`);
  }

  // ============================================================
  // Customers
  // ============================================================

  async listCustomers(query?: { limit?: number; offset?: number }): Promise<ApiResponse<CustomerListResponse>> {
    const qs = this.buildQuery({ limit: query?.limit, offset: query?.offset });
    return this.request<CustomerListResponse>(`/customers${qs}`);
  }

  async getCustomer(id: string): Promise<ApiResponse<CustomerDTO>> {
    return this.request<CustomerDTO>(`/customers/${id}`);
  }

  async createCustomer(data: CreateCustomerDTO): Promise<ApiResponse<CustomerDTO>> {
    return this.request<CustomerDTO>('/customers', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateCustomer(id: string, data: UpdateCustomerDTO): Promise<ApiResponse<CustomerDTO>> {
    return this.request<CustomerDTO>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteCustomer(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/customers/${id}`, { method: 'DELETE' });
  }

  // ============================================================
  // Service Plans
  // ============================================================

  async listServicePlans(query?: { limit?: number; offset?: number }): Promise<ApiResponse<ServicePlanListResponse>> {
    const qs = this.buildQuery({ limit: query?.limit, offset: query?.offset });
    return this.request<ServicePlanListResponse>(`/service-plans${qs}`);
  }

  async getServicePlan(id: string): Promise<ApiResponse<ServicePlanDTO>> {
    return this.request<ServicePlanDTO>(`/service-plans/${id}`);
  }

  async createServicePlan(data: CreateServicePlanDTO): Promise<ApiResponse<ServicePlanDTO>> {
    return this.request<ServicePlanDTO>('/service-plans', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateServicePlan(id: string, data: UpdateServicePlanDTO): Promise<ApiResponse<ServicePlanDTO>> {
    return this.request<ServicePlanDTO>(`/service-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteServicePlan(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/service-plans/${id}`, { method: 'DELETE' });
  }

  // ============================================================
  // Contracted Services
  // ============================================================

  async listContractedServices(query?: { customerId?: string; limit?: number; offset?: number }): Promise<ApiResponse<ContractedServiceListResponse>> {
    const qs = this.buildQuery({ customerId: query?.customerId, limit: query?.limit, offset: query?.offset });
    return this.request<ContractedServiceListResponse>(`/contracted-services${qs}`);
  }

  async getContractedService(id: string): Promise<ApiResponse<ContractedServiceDTO>> {
    return this.request<ContractedServiceDTO>(`/contracted-services/${id}`);
  }

  async createContractedService(data: CreateContractedServiceDTO): Promise<ApiResponse<ContractedServiceDTO>> {
    return this.request<ContractedServiceDTO>('/contracted-services', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateContractedService(id: string, data: UpdateContractedServiceDTO): Promise<ApiResponse<ContractedServiceDTO>> {
    return this.request<ContractedServiceDTO>(`/contracted-services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteContractedService(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/contracted-services/${id}`, { method: 'DELETE' });
  }
}

import { mockApiService } from './mock-api.service';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export const apiService = USE_MOCK ? mockApiService : new ApiService();
export default apiService;
