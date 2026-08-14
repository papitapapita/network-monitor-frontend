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
  ReplaceDeviceDTO,
  ReplaceDeviceResultDTO,
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
  TicketDTO,
  TicketDetailDTO,
  TicketListResponse,
  TechnicianDaySheetDTO,
} from '../types/ticket.types';
import { TechnicianDTO, TechnicianListResponse } from '../types/technician.types';
import {
  PollingStatusDTO,
  PollingHistoryResponse,
  PollingHistoryQuery,
  CreatePollingConfigDTO,
  PollingConfigDTO,
  UpdatePollingConfigDTO,
  ManualPollResultDTO,
} from '../types/polling.types';
import {
  AlertDTO,
  AlertListResponse,
  ListAlertsQuery,
  BulkClearAlertsRequest,
  BulkClearAlertsResult,
  BulkDeleteAlertsResult,
} from '../types/alert.types';
import { NetworkScanRequest, NetworkScanResult } from '../types/network-scan.types';
import { ApiResponse } from '../types/common.types';
import { SseState } from './sse';
import {
  DeviceConflict,
  duplicateIpError,
  duplicateMacError,
  missingIdentifierError,
  normalizeMacAddress,
  requiresIdentifier,
  RESTORE_GRACE_DAYS,
  liveDeviceModelMessage,
  binnedDeviceModelMessage,
} from '../constants/device.constants';
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

function conflict(c: DeviceConflict): ApiResponse<never> {
  return { success: false, error: c.message, errorField: c.field ?? undefined };
}

/**
 * Deleting a device is a soft delete, so the array keeps tombstones and every
 * read path has to step over them — a deleted device is absent from listings
 * and 404s on GET, exactly as it does on the real API.
 */
const liveDevices = (): DeviceResponseDTO[] => devices.filter((d) => !d.deletedAt);

const findLiveDevice = (id: string): DeviceResponseDTO | undefined =>
  devices.find((d) => d.id === id && !d.deletedAt);

/** Stands in for the authenticated user id the backend records on a delete. */
const MOCK_USER_ID = 'mock-user';

/**
 * The part of the backend's "monitoring stopped" transition mock mode can
 * honour: polling stops and the last reading is dropped, because nothing will
 * poll again to correct it. The config's settings survive for a later resume,
 * and `lastResult` stays so "last checked N days ago" copy still has a date.
 * Resolving an open device_unreachable alert has no counterpart here — mock
 * mode does not keep an alerts store.
 */
function stopMonitoring(deviceId: string): void {
  const status = pollingStatus[deviceId];
  if (!status) return;
  status.pollingEnabled = false;
  status.currentStatus = 'UNKNOWN';
  status.consecutiveFailures = 0;
  status.lastPolled = null;
  status.nextScheduled = null;
}

/**
 * A MAC address belongs to at most one device, and so does an IP — the backend
 * enforces both, so mock mode has to as well or the forms look permissive here
 * and reject on the real API. `exceptId` is the device being updated.
 *
 * Only live devices are considered: a delete releases its MAC and IP straight
 * away, without waiting for the grace period to lapse.
 */
function findDeviceConflict(
  data: { macAddress?: string | null; ipAddress?: string | null },
  exceptId?: string
): DeviceConflict | null {
  const others = liveDevices().filter((d) => d.id !== exceptId);

  if (data.macAddress) {
    const mac = normalizeMacAddress(data.macAddress);
    if (others.some((d) => d.macAddress && normalizeMacAddress(d.macAddress) === mac)) {
      return duplicateMacError(data.macAddress);
    }
  }

  if (data.ipAddress && others.some((d) => d.ipAddress === data.ipAddress)) {
    return duplicateIpError(data.ipAddress);
  }

  return null;
}

/**
 * A retired device — INVENTORY, DAMAGED or DECOMMISSIONED — must carry a serial
 * number or a MAC, since the network cannot reach it and what is written on the
 * box is all there is to track it by. The backend refuses the write otherwise,
 * so mock mode has to as well. Takes the device as it would stand after the
 * write, since an update can drop the last identifier it had or move it into a
 * status that demands one.
 */
function findMissingIdentifier(next: DeviceResponseDTO): DeviceConflict | null {
  return requiresIdentifier(next.status) && !next.serialNumber && !next.macAddress
    ? missingIdentifierError(next.status)
    : null;
}

function paginate<T>(items: T[], limit = 20, offset = 0): { items: T[]; total: number } {
  return { items: items.slice(offset, offset + limit), total: items.length };
}

class MockApiService {
  // ── Devices ────────────────────────────────────────────────

  async createDevice(data: CreateDeviceDTO): Promise<ApiResponse<DeviceResponseDTO>> {
    const taken = findDeviceConflict(data);
    if (taken) return conflict(taken);

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
      deletedAt: null,
      deletedBy: null,
      replacedAt: null,
      replacesDeviceId: null,
      replacedByDeviceId: null,
    };
    const missing = findMissingIdentifier(device);
    if (missing) return conflict(missing);

    devices = [device, ...devices];
    return ok(device);
  }

  async listDevices(query?: ListDevicesQuery): Promise<ApiResponse<DeviceListResponse>> {
    // Soft-deleted devices are hidden unless asked for: 'true' is the recycle
    // bin on its own, 'any' is the only way both share a page.
    const deleted = query?.deleted ?? 'false';
    let result =
      deleted === 'true' ? devices.filter((d) => d.deletedAt)
      : deleted === 'any' ? [...devices]
      : liveDevices();

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

    // The bin is read newest-deleted-first, so the sort has to work here too.
    if (query?.sortBy) {
      const field = query.sortBy;
      const direction = query.sortOrder === 'ASC' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const l = a[field] ?? '';
        const r = b[field] ?? '';
        return l === r ? 0 : (l < r ? -1 : 1) * direction;
      });
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
    const device = findLiveDevice(id);
    return device ? ok(device) : err('Device not found');
  }

  async updateDevice(id: string, data: UpdateDeviceDTO): Promise<ApiResponse<DeviceResponseDTO>> {
    const idx = devices.findIndex((d) => d.id === id && !d.deletedAt);
    if (idx === -1) return err('Device not found');

    const taken = findDeviceConflict(data, id);
    if (taken) return conflict(taken);

    const updated = { ...devices[idx], ...data, updatedAt: new Date().toISOString() };
    const missing = findMissingIdentifier(updated);
    if (missing) return conflict(missing);

    devices[idx] = updated;
    return ok(updated);
  }

  /**
   * Soft delete. The row survives a 7-day grace period so `restoreDevice` can
   * bring it back, but it leaves every listing at once and monitoring stops.
   *
   * The live-contracted-service guard is simulated; the open-ticket one is not,
   * since mock mode does not simulate tickets at all.
   */
  async deleteDevice(id: string): Promise<ApiResponse<void>> {
    const idx = devices.findIndex((d) => d.id === id && !d.deletedAt);
    if (idx === -1) return err('Device not found');

    const live = contractedServices.find((cs) => cs.deviceId === id && cs.status !== 'CANCELLED');
    if (live) {
      return err(
        `Cannot delete a device with a live contracted service (status ${live.status}). Cancel the service first.`
      );
    }

    devices[idx] = {
      ...devices[idx],
      deletedAt: new Date().toISOString(),
      deletedBy: MOCK_USER_ID,
      monitoringEnabled: false,
    };
    stopMonitoring(id);
    return { success: true };
  }


  /**
   * Undoes a soft delete. Monitoring stays off whatever the device had before —
   * putting it back in service is a second, deliberate action.
   */
  async restoreDevice(id: string): Promise<ApiResponse<DeviceResponseDTO>> {
    const idx = devices.findIndex((d) => d.id === id);
    if (idx === -1) return err('Device not found');
    if (!devices[idx].deletedAt) return err('Cannot restore a device that is not deleted');

    const deletedAt = new Date(devices[idx].deletedAt!).getTime();
    if (Date.now() - deletedAt > RESTORE_GRACE_DAYS * 24 * 60 * 60 * 1000) {
      return err('Cannot restore a device whose 7-day grace period expired');
    }

    const restored: DeviceResponseDTO = {
      ...devices[idx],
      deletedAt: null,
      deletedBy: null,
      monitoringEnabled: false,
      updatedAt: new Date().toISOString(),
    };
    devices[idx] = restored;
    return ok(restored);
  }

  /** Ends the grace period now. Everything hanging off the device goes with it. */
  async purgeDevice(id: string): Promise<ApiResponse<void>> {
    const device = devices.find((d) => d.id === id);
    if (!device) return err('Device not found');
    if (!device.deletedAt) {
      return err(
        'Cannot permanently delete a device that is not in the recycle bin. Delete it first.'
      );
    }

    devices = devices.filter((d) => d.id !== id);
    delete pollingStatus[id];
    delete pollingHistory[id];
    return { success: true };
  }

  /**
   * Retires this unit and creates its successor in one step, carrying the
   * location, category, owner, released IP and credentials across.
   */
  async replaceDevice(
    id: string,
    data: ReplaceDeviceDTO
  ): Promise<ApiResponse<ReplaceDeviceResultDTO>> {
    const idx = devices.findIndex((d) => d.id === id && !d.deletedAt);
    if (idx === -1) return err('Device not found');

    const retiring = devices[idx];
    if (retiring.replacedByDeviceId) return err('Device has already been replaced');
    if (!data.serialNumber?.trim() && !data.macAddress?.trim()) {
      return err('The replacement device must have at least a serial number or MAC address');
    }

    const model = deviceModels.find((m) => m.id === data.deviceModelId);
    if (!model) return err(`Device model not found: ${data.deviceModelId}`);

    const taken = findDeviceConflict(data, id);
    if (taken) return conflict(taken);

    const now = new Date().toISOString();
    // The retired unit releases its IP, and the successor takes it over — which
    // is what decides whether the new one starts commissioning or on the shelf.
    const inheritedIp = retiring.ipAddress;

    const newDevice: DeviceResponseDTO = {
      id: `dev-${uid()}`,
      deviceModelId: data.deviceModelId,
      locationId: retiring.locationId,
      status: inheritedIp ? 'COMMISSIONING' : 'INVENTORY',
      category: retiring.category,
      ownerType: retiring.ownerType,
      name: data.name?.trim() || retiring.name,
      serialNumber: data.serialNumber?.trim() || null,
      macAddress: data.macAddress?.trim() || null,
      ipAddress: inheritedIp,
      description: data.description?.trim() || null,
      installedDate: data.installedDate ?? now,
      monitoringEnabled: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
      replacedAt: now,
      replacesDeviceId: retiring.id,
      replacedByDeviceId: null,
    };

    const retiredDevice: DeviceResponseDTO = {
      ...retiring,
      status: data.retiredStatus,
      ipAddress: null,
      monitoringEnabled: false,
      replacedByDeviceId: newDevice.id,
      updatedAt: now,
    };

    devices[idx] = retiredDevice;
    devices = [newDevice, ...devices];
    stopMonitoring(retiring.id);
    if (pollingHistory[retiring.id]) pollingHistory[newDevice.id] = [];

    // The contracted service follows the hardware, so the customer keeps their
    // service on the box that is actually installed.
    const service = contractedServices.find(
      (cs) => cs.deviceId === retiring.id && cs.status !== 'CANCELLED'
    );
    if (service) service.deviceId = newDevice.id;

    return ok({
      retiredDevice,
      newDevice,
      // Mock mode stubs out credentials and wireless configs, so there is
      // nothing to carry across or drop — the real API reports both.
      wirelessConfigRemoved: false,
      credentialsTransferred: false,
      contractedServiceTransferred: !!service,
    });
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
        devices: liveDevices()
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

  /**
   * Mirrors the real DeleteDeviceModelUseCase: a live device blocks the
   * delete outright (DEV-026); a model whose only remaining devices are
   * soft-deleted is stalled behind a confirmation (DEV-030) instead of either
   * silently succeeding or purging the recycle bin unasked.
   */
  async deleteDeviceModel(id: string, purgeBinnedDevices?: boolean): Promise<ApiResponse<void>> {
    const idx = deviceModels.findIndex((m) => m.id === id);
    if (idx === -1) return err('Device model not found');

    const live = devices.filter((d) => d.deviceModelId === id && !d.deletedAt);
    if (live.length > 0) return err(liveDeviceModelMessage(live.length));

    const binned = devices.filter((d) => d.deviceModelId === id && d.deletedAt);
    if (binned.length > 0 && !purgeBinnedDevices) {
      return {
        success: false,
        binnedDeviceCount: binned.length,
        error: binnedDeviceModelMessage(binned.length),
      };
    }

    for (const device of binned) {
      devices = devices.filter((d) => d.id !== device.id);
      delete pollingStatus[device.id];
      delete pollingHistory[device.id];
    }

    deviceModels = deviceModels.filter((m) => m.id !== id);
    return { success: true };
  }

  // ── Polling ────────────────────────────────────────────────

  async getPollingStatus(deviceId: string): Promise<ApiResponse<PollingStatusDTO>> {
    const device = findLiveDevice(deviceId);
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
    const device = findLiveDevice(deviceId);
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
      const device = findLiveDevice(deviceId);
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
    const device = findLiveDevice(deviceId);
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

  async getAlert(_id: string): Promise<ApiResponse<AlertDTO>> {
    return err('Alerta no encontrada');
  }

  async clearAlert(_id: string): Promise<ApiResponse<AlertDTO>> {
    return err('Alerta no encontrada');
  }

  async deleteAlert(_id: string): Promise<ApiResponse<void>> {
    return { success: true };
  }

  // There is no alerts store to act on, so the bulk routes report empty
  // buckets rather than inventing refusals the real API would not send.
  async bulkClearAlerts(_request: BulkClearAlertsRequest): Promise<ApiResponse<BulkClearAlertsResult>> {
    return ok({ cleared: [], skipped: [], failed: [] });
  }

  async bulkDeleteAlerts(ids: string[]): Promise<ApiResponse<BulkDeleteAlertsResult>> {
    return ok({ deleted: ids, skipped: [], failed: [] });
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
  async clearWirelessAlert() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async bulkClearWirelessAlerts() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async triggerWirelessPoll() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async rebootWirelessDevice() {
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

  // The streams have no mock either: there is no poller behind them to invent
  // readings from. Report the same unavailability the rest of this section
  // does, through the state channel the consumers already render.
  streamWirelessThroughput(
    _deviceId: string,
    handlers: { onState?: (state: SseState) => void }
  ): () => void {
    handlers.onState?.({ status: 'error', error: 'No disponible en modo mock' });
    return () => {};
  }

  streamFleetThroughput(handlers: { onState?: (state: SseState) => void }): () => void {
    handlers.onState?.({ status: 'error', error: 'No disponible en modo mock' });
    return () => {};
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
    // Matches the backend default (schema.prisma: @default(PENDING)).
    const cs: ContractedServiceDTO = { id: `cs-${uid()}`, customerId: data.customerId, servicePlanId: data.servicePlanId, deviceId: data.deviceId ?? null, status: 'PENDING', startDate: data.startDate ?? now, createdAt: now, updatedAt: now };
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

  // ── Suspension enforcement ─────────────────────────────────
  // No router in mock mode, so enforcement is reported as unknown.

  async listEnforcedSuspensions() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async getContractedServiceEnforcement() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }

  // ── Bills ──────────────────────────────────────────────────
  // Billing is backend-only; mock mode does not fabricate invoices.

  async listBills() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async getBill() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async generateBill() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async generateBulkBills() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async payBill() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async markBillOverdue() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async cancelBill() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }
  async downloadBillPdf() {
    return { success: false as const, error: 'No disponible en modo mock' };
  }

  // ── Tickets & technicians ──────────────────────────────────
  // A ticket is a state machine with terminal states, and half-simulating it
  // here would teach the UI rules the backend does not actually have. Mock mode
  // says so instead.
  //
  // These are typed as `ApiResponse<T>` rather than inferred: `apiService` is a
  // union of this class and the real one, so a stub that infers the narrower
  // `{ success: false; error: string }` strips `errorField` and `status` off
  // every call site that reads them.

  async listTickets(): Promise<ApiResponse<TicketListResponse>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async getTicket(): Promise<ApiResponse<TicketDetailDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async createTicket(): Promise<ApiResponse<TicketDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async updateTicket(): Promise<ApiResponse<TicketDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async deleteTicket(): Promise<ApiResponse<void>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async assignTicket(): Promise<ApiResponse<TicketDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async scheduleTicket(): Promise<ApiResponse<TicketDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async startTicket(): Promise<ApiResponse<TicketDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async resolveTicket(): Promise<ApiResponse<TicketDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async cancelTicket(): Promise<ApiResponse<TicketDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async getTechnicianDaySheet(): Promise<ApiResponse<TechnicianDaySheetDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }

  async listTechnicians(): Promise<ApiResponse<TechnicianListResponse>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async getTechnician(): Promise<ApiResponse<TechnicianDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async createTechnician(): Promise<ApiResponse<TechnicianDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async updateTechnician(): Promise<ApiResponse<TechnicianDTO>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
  async deleteTechnician(): Promise<ApiResponse<void>> {
    return { success: false, error: 'No disponible en modo mock' };
  }
}

export const mockApiService = new MockApiService();
