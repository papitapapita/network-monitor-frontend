/**
 * In-memory mock API service for development without a running backend.
 * Mutations (create/update) persist within the browser session.
 * Enabled via NEXT_PUBLIC_USE_MOCK=true in .env.local.
 */

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
import { LocationMapResponse, MapPin } from '../types/map.types';
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

import {
  MOCK_DEVICES,
  MOCK_LOCATIONS,
  MOCK_DEVICE_MODELS,
  MOCK_POLLING_STATUS,
  MOCK_POLLING_HISTORY,
  MOCK_CUSTOMERS,
  MOCK_SERVICE_PLANS,
  MOCK_CONTRACTED_SERVICES,
} from './mock.data';

// Mutable in-memory stores (seeded once from mock data)
let devices: DeviceResponseDTO[] = [...MOCK_DEVICES];
let locations: LocationResponseDTO[] = [...MOCK_LOCATIONS];
let customers: CustomerDTO[] = [...MOCK_CUSTOMERS];
let servicePlans: ServicePlanDTO[] = [...MOCK_SERVICE_PLANS];
let contractedServices: ContractedServiceDTO[] = [...MOCK_CONTRACTED_SERVICES];
let deviceModels: DeviceModelResponseDTO[] = [...MOCK_DEVICE_MODELS];

const MOCK_VENDORS: VendorDTO[] = [
  { id: 'v-1', name: 'MikroTik', slug: 'mikrotik', description: null, createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 90 * 86_400_000).toISOString() },
  { id: 'v-2', name: 'Ubiquiti', slug: 'ubiquiti', description: null, createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 90 * 86_400_000).toISOString() },
  { id: 'v-3', name: 'Mimosa', slug: 'mimosa', description: null, createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 90 * 86_400_000).toISOString() },
  { id: 'v-4', name: 'TP-Link', slug: 'tp-link', description: null, createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(), updatedAt: new Date(Date.now() - 90 * 86_400_000).toISOString() },
];
let vendors: VendorDTO[] = [...MOCK_VENDORS];
const pollingStatus: Record<string, PollingStatusDTO> = { ...MOCK_POLLING_STATUS };
const pollingHistory: Record<string, ReturnType<typeof MOCK_POLLING_HISTORY[string]['slice']>> = {};
for (const [k, v] of Object.entries(MOCK_POLLING_HISTORY)) pollingHistory[k] = [...v];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

function err(message: string): ApiResponse<never> {
  return { success: false, error: message };
}

function paginate<T>(items: T[], limit = 20, offset = 0): { items: T[]; total: number } {
  return { items: items.slice(offset, offset + limit), total: items.length };
}

class MockApiService {
  // ── Devices ────────────────────────────────────────────────

  async createDevice(data: CreateDeviceDTO): Promise<ApiResponse<DeviceResponseDTO>> {
    const now = new Date().toISOString();
    const device: DeviceResponseDTO = {
      id: `dev-${uid()}`,
      deviceModelId: data.deviceModelId,
      locationId: data.locationId ?? null,
      status: data.status ?? 'INVENTORY',
      category: data.category ?? null,
      ownerType: data.ownerType ?? null,
      name: data.name,
      serialNumber: data.serialNumber ?? null,
      macAddress: data.macAddress ?? null,
      ipAddress: data.ipAddress ?? null,
      description: data.description ?? null,
      installedDate: data.installedDate ?? null,
      monitoringEnabled: data.monitoringEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    };
    devices = [device, ...devices];
    return ok(device);
  }

  async listDevices(query?: ListDevicesQuery): Promise<ApiResponse<DeviceListResponse>> {
    let result = [...devices];

    if (query?.status) result = result.filter((d) => d.status === query.status);
    if (query?.category) result = result.filter((d) => d.category === query.category);
    if (query?.owner) result = result.filter((d) => d.ownerType === query.owner);
    if (query?.locationId) result = result.filter((d) => d.locationId === query.locationId);
    if (query?.deviceModelId) result = result.filter((d) => d.deviceModelId === query.deviceModelId);
    if (query?.monitoringEnabled !== undefined)
      result = result.filter((d) => d.monitoringEnabled === query.monitoringEnabled);
    if (query?.search) {
      const q = query.search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.ipAddress?.toLowerCase().includes(q) ||
          d.macAddress?.toLowerCase().includes(q) ||
          d.serialNumber?.toLowerCase().includes(q)
      );
    }

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const { items, total } = paginate(result, limit, offset);

    return ok({
      devices: items,
      total,
      hasMore: offset + items.length < total,
      limit,
      offset,
    });
  }

  async getDevice(id: string): Promise<ApiResponse<DeviceResponseDTO>> {
    const device = devices.find((d) => d.id === id);
    return device ? ok(device) : err('Device not found');
  }

  async updateDevice(id: string, data: UpdateDeviceDTO): Promise<ApiResponse<DeviceResponseDTO>> {
    const idx = devices.findIndex((d) => d.id === id);
    if (idx === -1) return err('Device not found');
    const updated = { ...devices[idx], ...data, updatedAt: new Date().toISOString() };
    devices[idx] = updated;
    return ok(updated);
  }

  async deleteDevice(id: string): Promise<ApiResponse<void>> {
    const idx = devices.findIndex((d) => d.id === id);
    if (idx === -1) return err('Device not found');
    devices = devices.filter((d) => d.id !== id);
    return { success: true };
  }

  // ── Locations ──────────────────────────────────────────────

  async createLocation(data: CreateLocationDTO): Promise<ApiResponse<LocationResponseDTO>> {
    const now = new Date().toISOString();
    const location: LocationResponseDTO = {
      id: `loc-${uid()}`,
      name: data.name,
      type: data.type,
      municipality: data.municipality ?? null,
      neighborhood: data.neighborhood ?? null,
      address: data.address ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      altitude: data.altitude ?? null,
      createdAt: now,
      updatedAt: now,
    };
    locations = [location, ...locations];
    return ok(location);
  }

  async listLocations(query?: ListLocationsQuery): Promise<ApiResponse<LocationListResponse>> {
    let result = [...locations];
    if (query?.type) result = result.filter((l) => l.type === query.type);

    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const { items, total } = paginate(result, limit, offset);

    return ok({
      locations: items,
      total,
      hasMore: offset + items.length < total,
      limit,
      offset,
    });
  }

  async getLocation(id: string): Promise<ApiResponse<LocationResponseDTO>> {
    const location = locations.find((l) => l.id === id);
    return location ? ok(location) : err('Location not found');
  }

  async updateLocation(
    id: string,
    data: UpdateLocationDTO
  ): Promise<ApiResponse<LocationResponseDTO>> {
    const idx = locations.findIndex((l) => l.id === id);
    if (idx === -1) return err('Location not found');
    const updated = { ...locations[idx], ...data, updatedAt: new Date().toISOString() };
    locations[idx] = updated;
    return ok(updated);
  }

  async deleteLocation(id: string): Promise<ApiResponse<void>> {
    const idx = locations.findIndex((l) => l.id === id);
    if (idx === -1) return err('Location not found');
    locations = locations.filter((l) => l.id !== id);
    return { success: true };
  }

  async getLocationMapPins(): Promise<ApiResponse<LocationMapResponse>> {
    const pins: MapPin[] = locations
      .filter((l) => l.latitude !== null && l.longitude !== null)
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        locationType: loc.type,
        latitude: loc.latitude!,
        longitude: loc.longitude!,
        altitude: loc.altitude,
        municipality: loc.municipality,
        neighborhood: loc.neighborhood,
        address: loc.address,
        devices: devices
          .filter((d) => d.locationId === loc.id)
          .map((d) => ({
            id: d.id,
            name: d.name,
            status: d.status,
            category: d.category,
            ipAddress: d.ipAddress,
            macAddress: d.macAddress,
            monitoringEnabled: d.monitoringEnabled,
          })),
      }));
    return ok({ total: pins.length, pins });
  }

  // ── Vendors ────────────────────────────────────────────────

  async listVendors(query?: { limit?: number; offset?: number }): Promise<ApiResponse<VendorListResponse>> {
    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const { items, total } = paginate(vendors, limit, offset);
    return ok({ vendors: items, total, hasMore: offset + items.length < total, limit, offset });
  }

  async getVendor(id: string): Promise<ApiResponse<VendorDTO>> {
    const vendor = vendors.find((v) => v.id === id);
    return vendor ? ok(vendor) : err('Vendor not found');
  }

  async createVendor(data: CreateVendorDTO): Promise<ApiResponse<VendorDTO>> {
    const now = new Date().toISOString();
    const vendor: VendorDTO = {
      id: `v-${uid()}`,
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      createdAt: now,
      updatedAt: now,
    };
    vendors = [vendor, ...vendors];
    return ok(vendor);
  }

  async updateVendor(id: string, data: UpdateVendorDTO): Promise<ApiResponse<VendorDTO>> {
    const idx = vendors.findIndex((v) => v.id === id);
    if (idx === -1) return err('Vendor not found');
    const updated = { ...vendors[idx], ...data, updatedAt: new Date().toISOString() };
    vendors[idx] = updated;
    return ok(updated);
  }

  async deleteVendor(id: string): Promise<ApiResponse<void>> {
    const idx = vendors.findIndex((v) => v.id === id);
    if (idx === -1) return err('Vendor not found');
    vendors = vendors.filter((v) => v.id !== id);
    return { success: true };
  }

  // ── Device Models ──────────────────────────────────────────

  async listDeviceModels(query?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<DeviceModelListResponse>> {
    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const { items, total } = paginate(deviceModels, limit, offset);
    return ok({
      deviceModels: items,
      total,
      hasMore: offset + items.length < total,
      limit,
      offset,
    });
  }

  async getDeviceModel(id: string): Promise<ApiResponse<DeviceModelResponseDTO>> {
    const model = deviceModels.find((m) => m.id === id);
    return model ? ok(model) : err('Device model not found');
  }

  async createDeviceModel(data: CreateDeviceModelDTO): Promise<ApiResponse<DeviceModelResponseDTO>> {
    const vendor = vendors.find((v) => v.id === data.vendorId);
    if (!vendor) return err('Vendor not found');
    const now = new Date().toISOString();
    const model: DeviceModelResponseDTO = {
      id: `dm-${uid()}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorSlug: vendor.slug,
      model: data.model,
      deviceType: data.deviceType,
      isWireless: data.isWireless,
      createdAt: now,
      updatedAt: now,
    };
    deviceModels = [model, ...deviceModels];
    return ok(model);
  }

  async updateDeviceModel(id: string, data: UpdateDeviceModelDTO): Promise<ApiResponse<DeviceModelResponseDTO>> {
    const idx = deviceModels.findIndex((m) => m.id === id);
    if (idx === -1) return err('Device model not found');

    let vendorName = deviceModels[idx].vendorName;
    let vendorSlug = deviceModels[idx].vendorSlug;
    if (data.vendorId) {
      const vendor = vendors.find((v) => v.id === data.vendorId);
      if (!vendor) return err('Vendor not found');
      vendorName = vendor.name;
      vendorSlug = vendor.slug;
    }

    const updated: DeviceModelResponseDTO = {
      ...deviceModels[idx],
      ...data,
      vendorName,
      vendorSlug,
      updatedAt: new Date().toISOString(),
    };
    deviceModels[idx] = updated;
    return ok(updated);
  }

  async deleteDeviceModel(id: string): Promise<ApiResponse<void>> {
    const idx = deviceModels.findIndex((m) => m.id === id);
    if (idx === -1) return err('Device model not found');
    deviceModels = deviceModels.filter((m) => m.id !== id);
    return { success: true };
  }

  // ── Polling ────────────────────────────────────────────────

  async getPollingStatus(deviceId: string): Promise<ApiResponse<PollingStatusDTO>> {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return err('Device not found');

    if (!pollingStatus[deviceId]) {
      pollingStatus[deviceId] = {
        deviceId,
        pollingEnabled: device.monitoringEnabled,
        intervalSeconds: 60,
        failuresBeforeDown: 3,
        lastPolled: null,
        nextScheduled: null,
        currentStatus: 'UNKNOWN',
        lastResult: null,
        consecutiveFailures: 0,
      };
    }
    return ok(pollingStatus[deviceId]);
  }

  async getPollingHistory(
    deviceId: string,
    query?: PollingHistoryQuery
  ): Promise<ApiResponse<PollingHistoryResponse>> {
    const history = pollingHistory[deviceId] ?? [];

    let filtered = [...history];
    if (query?.status) filtered = filtered.filter((r) => r.status === query.status);
    if (query?.fromDate) filtered = filtered.filter((r) => r.timestamp >= query.fromDate!);
    if (query?.toDate) filtered = filtered.filter((r) => r.timestamp <= query.toDate!);

    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;
    const { items, total } = paginate(filtered, Number(limit), Number(offset));

    const successes = items.filter((r) => r.status === 'SUCCESS');
    const latencies = successes.map((r) => r.metrics?.latencyMs ?? 0).filter((v) => v > 0);
    const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    return ok({
      deviceId,
      results: items,
      totalCount: total,
      statistics: {
        successRate: total > 0 ? (successes.length / items.length) * 100 : 0,
        averageResponseTime: Math.round(avg),
        minResponseTime: latencies.length ? Math.min(...latencies) : 0,
        maxResponseTime: latencies.length ? Math.max(...latencies) : 0,
        uptimePercentage: total > 0 ? (successes.length / items.length) * 100 : 0,
      },
    });
  }

  async createPollingConfig(
    deviceId: string,
    data: CreatePollingConfigDTO
  ): Promise<ApiResponse<PollingConfigDTO>> {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return err('Device not found');
    pollingStatus[deviceId] = {
      deviceId,
      pollingEnabled: data.enabled ?? true,
      intervalSeconds: data.intervalSeconds ?? 60,
      failuresBeforeDown: data.failuresBeforeDown ?? 3,
      lastPolled: null,
      nextScheduled: null,
      currentStatus: 'UNKNOWN',
      lastResult: null,
      consecutiveFailures: 0,
    };
    return {
      success: true,
      data: {
        id: crypto.randomUUID(),
        deviceId,
        ipAddress: data.ipAddress ?? null,
        intervalSeconds: data.intervalSeconds ?? 60,
        failuresBeforeDown: data.failuresBeforeDown ?? 3,
        enabled: data.enabled ?? true,
      },
    };
  }

  async updatePollingConfig(
    deviceId: string,
    data: UpdatePollingConfigDTO
  ): Promise<ApiResponse<void>> {
    if (!pollingStatus[deviceId]) {
      const device = devices.find((d) => d.id === deviceId);
      if (!device) return err('Device not found');
      pollingStatus[deviceId] = {
        deviceId,
        pollingEnabled: false,
        intervalSeconds: 60,
        failuresBeforeDown: 3,
        lastPolled: null,
        nextScheduled: null,
        currentStatus: 'UNKNOWN',
        lastResult: null,
        consecutiveFailures: 0,
      };
    }
    if (data.enabled !== undefined) pollingStatus[deviceId].pollingEnabled = data.enabled;
    if (data.intervalSeconds !== undefined)
      pollingStatus[deviceId].intervalSeconds = data.intervalSeconds;
    if (data.failuresBeforeDown !== undefined)
      pollingStatus[deviceId].failuresBeforeDown = data.failuresBeforeDown;
    return { success: true };
  }

  async triggerPoll(deviceId: string): Promise<ApiResponse<ManualPollResultDTO>> {
    const device = devices.find((d) => d.id === deviceId);
    if (!device) return err('Device not found');

    const success = Math.random() > 0.2;
    const now = new Date().toISOString();
    const latencyMs = success ? 8 + Math.floor(Math.random() * 50) : undefined;
    const newStatus = success ? 'ONLINE' : 'OFFLINE';

    const historyEntry = {
      id: `poll-manual-${uid()}`,
      deviceId,
      timestamp: now,
      status: (success ? 'SUCCESS' : 'FAILED') as 'SUCCESS' | 'FAILED',
      metrics: latencyMs ? { latencyMs } : null,
      deviceStatus: newStatus as 'ONLINE' | 'OFFLINE' | 'UNKNOWN',
    };

    // Update polling status
    if (pollingStatus[deviceId]) {
      pollingStatus[deviceId].lastPolled = now;
      pollingStatus[deviceId].lastResult = historyEntry;
      pollingStatus[deviceId].currentStatus = newStatus;
      pollingStatus[deviceId].consecutiveFailures = success
        ? 0
        : pollingStatus[deviceId].consecutiveFailures + 1;
    }

    // Push to history
    if (!pollingHistory[deviceId]) pollingHistory[deviceId] = [];
    pollingHistory[deviceId].unshift(historyEntry);

    return ok({
      deviceId,
      status: success ? 'SUCCESS' : 'FAILED',
      message: success ? `Responded in ${latencyMs}ms` : 'Host unreachable',
      timestamp: now,
      metrics: latencyMs ? { latencyMs } : null,
      deviceStatus: newStatus,
    });
  }

  // ============================================================
  // Alerts
  // ============================================================

  async listAlerts(query?: ListAlertsQuery): Promise<ApiResponse<AlertListResponse>> {
    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;
    const slice = Array<never>().slice(offset, offset + limit);
    return ok({
      alerts: slice,
      total: 0,
      hasMore: false,
      limit,
      offset,
    });
  }

  // ── Device Credentials ────────────────────────────────────

  async getDeviceCredentials() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async setDeviceCredentials() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async deleteDeviceCredentials() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }

  // ── Network Scan ───────────────────────────────────────────

  async scanNetwork(data: NetworkScanRequest): Promise<ApiResponse<NetworkScanResult>> {
    const [baseIp] = data.segment.split('/');
    const parts = baseIp.split('.').slice(0, 3).join('.');
    const count = 8 + Math.floor(Math.random() * 8);
    const usedLast = new Set<number>();

    const manufacturers = ['MikroTik', 'Ubiquiti', 'Cisco', 'TP-Link', null];
    const discoveredHosts = Array.from({ length: count }, () => {
      let last: number;
      do { last = 1 + Math.floor(Math.random() * 254); } while (usedLast.has(last));
      usedLast.add(last);
      return {
        ipAddress: `${parts}.${last}`,
        latencyMs: 1 + Math.floor(Math.random() * 30),
        macAddress: Array.from({ length: 6 }, () =>
          Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
        ).join(':'),
        manufacturer: manufacturers[Math.floor(Math.random() * manufacturers.length)],
      };
    });

    return ok({
      segment: data.segment,
      scannedCount: 256,
      responsiveCount: count,
      discoveredHosts,
    });
  }

  // ============================================================
  // Wireless Monitoring (stubs — not available in mock mode)
  // ============================================================

  async getWirelessConfig() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async createWirelessConfig() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async updateWirelessConfig() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async deleteWirelessConfig() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async getWirelessStatus() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async getWirelessClients() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async getWirelessAlerts() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async triggerWirelessPoll() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async getWirelessHistory() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async getWirelessAlertHistory() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async getGlobalWirelessAlerts() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async getGlobalWirelessAlertHistory() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setToken(_token: string | null) {}

  async login(email: string, _password: string): Promise<ApiResponse<{ token: string; user: { id: string; email: string; role: 'ADMIN' | 'OPERATOR' | 'VIEWER' } }>> {
    return {
      success: true,
      data: {
        token: 'mock-token',
        user: { id: 'mock-user', email, role: 'ADMIN' },
      },
    };
  }

  // ── Customers ──────────────────────────────────────────────

  async listCustomers(query?: { limit?: number; offset?: number }): Promise<ApiResponse<CustomerListResponse>> {
    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const { items, total } = paginate(customers, limit, offset);
    return ok({ customers: items, total, hasMore: offset + items.length < total, limit, offset });
  }

  async getCustomer(id: string): Promise<ApiResponse<CustomerDTO>> {
    const c = customers.find((x) => x.id === id);
    return c ? ok(c) : err('Customer not found');
  }

  async createCustomer(data: CreateCustomerDTO): Promise<ApiResponse<CustomerDTO>> {
    const now = new Date().toISOString();
    const c: CustomerDTO = { id: `cust-${uid()}`, fullName: data.fullName, phone: data.phone, email: data.email ?? null, cedula: data.cedula ?? null, createdAt: now, updatedAt: now };
    customers = [c, ...customers];
    return ok(c);
  }

  async updateCustomer(id: string, data: UpdateCustomerDTO): Promise<ApiResponse<CustomerDTO>> {
    const idx = customers.findIndex((x) => x.id === id);
    if (idx === -1) return err('Customer not found');
    const updated = { ...customers[idx], ...data, updatedAt: new Date().toISOString() };
    customers[idx] = updated;
    return ok(updated);
  }

  async deleteCustomer(id: string): Promise<ApiResponse<void>> {
    const idx = customers.findIndex((x) => x.id === id);
    if (idx === -1) return err('Customer not found');
    customers = customers.filter((x) => x.id !== id);
    return { success: true };
  }

  // ── Service Plans ──────────────────────────────────────────

  async listServicePlans(query?: { limit?: number; offset?: number }): Promise<ApiResponse<ServicePlanListResponse>> {
    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const { items, total } = paginate(servicePlans, limit, offset);
    return ok({ servicePlans: items, total, hasMore: offset + items.length < total, limit, offset });
  }

  async getServicePlan(id: string): Promise<ApiResponse<ServicePlanDTO>> {
    const p = servicePlans.find((x) => x.id === id);
    return p ? ok(p) : err('Service plan not found');
  }

  async createServicePlan(data: CreateServicePlanDTO): Promise<ApiResponse<ServicePlanDTO>> {
    const now = new Date().toISOString();
    const p: ServicePlanDTO = { id: `plan-${uid()}`, name: data.name, downloadMbps: data.downloadMbps, uploadMbps: data.uploadMbps, monthlyPrice: data.monthlyPrice, description: data.description ?? null, isActive: data.isActive ?? true, createdAt: now, updatedAt: now };
    servicePlans = [p, ...servicePlans];
    return ok(p);
  }

  async updateServicePlan(id: string, data: UpdateServicePlanDTO): Promise<ApiResponse<ServicePlanDTO>> {
    const idx = servicePlans.findIndex((x) => x.id === id);
    if (idx === -1) return err('Service plan not found');
    const updated = { ...servicePlans[idx], ...data, updatedAt: new Date().toISOString() };
    servicePlans[idx] = updated;
    return ok(updated);
  }

  async deleteServicePlan(id: string): Promise<ApiResponse<void>> {
    const idx = servicePlans.findIndex((x) => x.id === id);
    if (idx === -1) return err('Service plan not found');
    servicePlans = servicePlans.filter((x) => x.id !== id);
    return { success: true };
  }

  // ── Contracted Services ────────────────────────────────────

  async listContractedServices(query?: { customerId?: string; limit?: number; offset?: number }): Promise<ApiResponse<ContractedServiceListResponse>> {
    const limit = query?.limit ?? 20;
    const offset = query?.offset ?? 0;
    const filtered = query?.customerId ? contractedServices.filter((x) => x.customerId === query.customerId) : contractedServices;
    const { items, total } = paginate(filtered, limit, offset);
    return ok({ contractedServices: items, total, hasMore: offset + items.length < total, limit, offset });
  }

  async getContractedService(id: string): Promise<ApiResponse<ContractedServiceDTO>> {
    const cs = contractedServices.find((x) => x.id === id);
    return cs ? ok(cs) : err('Contracted service not found');
  }

  async createContractedService(data: CreateContractedServiceDTO): Promise<ApiResponse<ContractedServiceDTO>> {
    const now = new Date().toISOString();
    const cs: ContractedServiceDTO = { id: `cs-${uid()}`, customerId: data.customerId, servicePlanId: data.servicePlanId, deviceId: data.deviceId ?? null, status: 'ACTIVE', startDate: data.startDate ?? now, createdAt: now, updatedAt: now };
    contractedServices = [cs, ...contractedServices];
    return ok(cs);
  }

  async updateContractedService(id: string, data: UpdateContractedServiceDTO): Promise<ApiResponse<ContractedServiceDTO>> {
    const idx = contractedServices.findIndex((x) => x.id === id);
    if (idx === -1) return err('Contracted service not found');
    const updated = { ...contractedServices[idx], ...data, updatedAt: new Date().toISOString() };
    contractedServices[idx] = updated;
    return ok(updated);
  }

  async deleteContractedService(id: string): Promise<ApiResponse<void>> {
    const idx = contractedServices.findIndex((x) => x.id === id);
    if (idx === -1) return err('Contracted service not found');
    contractedServices = contractedServices.filter((x) => x.id !== id);
    return { success: true };
  }
}

export const mockApiService = new MockApiService();
