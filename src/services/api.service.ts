/**
 * API Service
 *
 * Centralized API client for backend communication
 */

import {
  NetworkDeviceResponseDTO,
  NetworkDeviceListResponseDTO,
  CreateNetworkDeviceDTO,
  UpdateNetworkDeviceDTO,
  ActivateNetworkDeviceDTO,
  SoftDeleteNetworkDeviceDTO,
  ListNetworkDevicesQuery,
  BulkImportResponseDTO,
  ApiResponse
} from '../types/device.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generic HTTP request handler
   */
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

      // Handle 204 No Content
      if (response.status === 204) {
        return { success: true };
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // ========================================
  // Network Device CRUD Operations
  // ========================================

  /**
   * Create a new network device
   * POST /network-devices
   */
  async createDevice(
    data: CreateNetworkDeviceDTO
  ): Promise<ApiResponse<NetworkDeviceResponseDTO>> {
    return this.request<NetworkDeviceResponseDTO>('/network-devices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Get all network devices with pagination
   * GET /network-devices
   */
  async listDevices(
    query?: ListNetworkDevicesQuery
  ): Promise<ApiResponse<NetworkDeviceListResponseDTO>> {
    const params = new URLSearchParams();
    if (query?.limit) params.append('limit', query.limit.toString());
    if (query?.offset) params.append('offset', query.offset.toString());
    if (query?.status) params.append('status', query.status);
    if (query?.deviceType) params.append('deviceType', query.deviceType);
    if (query?.activationStatus) params.append('activationStatus', query.activationStatus);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<NetworkDeviceListResponseDTO>(`/network-devices${queryString}`);
  }

  /**
   * Get device by ID
   * GET /network-devices/:id
   */
  async getDeviceById(id: string): Promise<ApiResponse<NetworkDeviceResponseDTO>> {
    return this.request<NetworkDeviceResponseDTO>(`/network-devices/${id}`);
  }

  /**
   * Get device by IP address
   * GET /network-devices/by-ip?ip=...
   */
  async getDeviceByIp(ipAddress: string): Promise<ApiResponse<NetworkDeviceResponseDTO>> {
    return this.request<NetworkDeviceResponseDTO>(
      `/network-devices/by-ip?ip=${encodeURIComponent(ipAddress)}`
    );
  }

  /**
   * Update device
   * PUT /network-devices/:id
   */
  async updateDevice(
    id: string,
    data: UpdateNetworkDeviceDTO
  ): Promise<ApiResponse<NetworkDeviceResponseDTO>> {
    return this.request<NetworkDeviceResponseDTO>(`/network-devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Hard delete device
   * DELETE /network-devices/:id
   */
  async deleteDevice(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/network-devices/${id}`, {
      method: 'DELETE'
    });
  }

  // ========================================
  // REQ-002: Lifecycle Operations
  // ========================================

  /**
   * Activate a DRAFT device to ACTIVE
   * POST /network-devices/:id/activate
   */
  async activateDevice(
    id: string,
    data: ActivateNetworkDeviceDTO
  ): Promise<ApiResponse<NetworkDeviceResponseDTO>> {
    return this.request<NetworkDeviceResponseDTO>(`/network-devices/${id}/activate`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Soft delete device with 7-day grace period
   * DELETE /network-devices/:id/soft
   */
  async softDeleteDevice(
    id: string,
    data?: SoftDeleteNetworkDeviceDTO
  ): Promise<ApiResponse<NetworkDeviceResponseDTO>> {
    return this.request<NetworkDeviceResponseDTO>(`/network-devices/${id}/soft`, {
      method: 'DELETE',
      body: JSON.stringify(data || {})
    });
  }

  /**
   * Restore soft-deleted device
   * POST /network-devices/:id/restore
   */
  async restoreDevice(id: string): Promise<ApiResponse<NetworkDeviceResponseDTO>> {
    return this.request<NetworkDeviceResponseDTO>(`/network-devices/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  // ========================================
  // REQ-002: Bulk Import
  // ========================================

  /**
   * Bulk import devices from CSV
   * POST /network-devices/bulk-import
   */
  async bulkImportDevices(
    file: File,
    activateImmediately: boolean = false
  ): Promise<ApiResponse<BulkImportResponseDTO>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('activateImmediately', activateImmediately.toString());

    try {
      const response = await fetch(`${this.baseUrl}/network-devices/bulk-import`, {
        method: 'POST',
        body: formData
        // Don't set Content-Type header - browser will set it with boundary
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Download CSV template
   * GET /network-devices/bulk-import/template
   */
  async downloadCSVTemplate(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/network-devices/bulk-import/template`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'network-devices-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
