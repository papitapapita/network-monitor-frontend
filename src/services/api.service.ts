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
import { AlertDTO, AlertListResponse, ListAlertsQuery } from '../types/alert.types';
import { NetworkScanRequest, NetworkScanResult } from '../types/network-scan.types';
import {
  WirelessConfigDTO,
  WirelessStatusDTO,
  WirelessAlertDTO,
  WirelessClientsResponse,
  WirelessPollResult,
  WirelessRebootResult,
  WirelessHistoryResponse,
  WirelessHistoryQuery,
  WirelessAlertHistoryQuery,
  CreateWirelessConfigDTO,
  UpdateWirelessConfigDTO,
} from '../types/wireless.types';
import { ApiResponse } from '../types/common.types';
import {
  translateDeviceConflict,
  translateDeviceInvariant,
  translateDeviceDeleteBlocker,
  translateDeviceBinError,
  translateDeviceReplaceError,
  liveDeviceModelMessage,
  binnedDeviceModelMessage,
} from '../constants/device.constants';
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
import {
  EnforcedSuspensionsResponse,
  ServiceEnforcementStatusDTO,
} from '../types/enforcement.types';
import {
  BillDTO,
  BillListResponse,
  ListBillsQuery,
  GenerateBillDTO,
  GenerateBulkBillsDTO,
  BulkGenerateResult,
} from '../types/bill.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * The backend allows 100 reads and 60 writes per minute per resource, and
 * answers a 429 with `Retry-After` in seconds. A read that gives up on the
 * first one leaves the caller with an empty list it cannot tell apart from
 * "there is nothing" — a model picker with no models, a device page with no
 * wireless tab — so reads wait the window out instead. Bounded, because a
 * page that hangs is no better than one that is empty.
 */
const RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_MAX_WAIT_MS = 8_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drops the `body.` / `params.` / `query.` prefix `request()` prepends when it
 * flattens a schema rejection, leaving just the message the backend wrote. The
 * same rule can be refused by the schema or by the domain depending on which
 * layer catches it first, and a translator should not have to know which.
 */
const stripValidationPrefix = (error: string): string =>
  error.replace(/^(body|params|query)(\.[\w.[\]]+)?:\s*/, '');

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * Sends the request, retrying a rate-limited **read** once the window the
   * server names has passed. Only reads: replaying a POST or a PATCH could
   * create the same record twice, and no header can tell us whether the first
   * attempt landed before the limiter turned it away.
   */
  private async send(url: string, init: RequestInit): Promise<Response> {
    const isRead = (init.method ?? 'GET').toUpperCase() === 'GET';
    let response = await fetch(url, init);

    for (let attempt = 0; isRead && response.status === 429 && attempt < RATE_LIMIT_RETRIES; attempt++) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000;
      // Past the cap the honest answer is the 429 itself: a page frozen for a
      // minute helps nobody, and the caller can offer a retry.
      if (waitMs > RATE_LIMIT_MAX_WAIT_MS) break;
      await sleep(waitMs);
      response = await fetch(url, init);
    }

    return response;
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

      const response = await this.send(`${this.baseUrl}${endpoint}`, { ...options, headers });

      if (response.status === 204) {
        return { success: true };
      }

      if (response.status === 403) {
        return { success: false, status: 403, error: 'No tienes permisos suficientes para realizar esta acción.' };
      }

      if (response.status === 429) {
        return { success: false, status: 429, error: 'Demasiadas solicitudes. Por favor espera un momento e inténtalo de nuevo.' };
      }

      if (response.status === 401) {
        this.token = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('nms_token');
          localStorage.removeItem('nms_user');
          window.dispatchEvent(new Event('nms:unauthorized'));
        }
        return { success: false, status: 401, error: 'Sesión expirada. Por favor inicia sesión nuevamente.' };
      }

      const data = await response.json();

      if (!response.ok) {
        // Zod validation failures come back as { error: 'Validation failed', details: [{field, message}] } —
        // the top-level error alone doesn't say what's actually wrong.
        if (Array.isArray(data.details) && data.details.length > 0) {
          const detail = data.details
            .map((d: { field?: string; message?: string }) => d.field ? `${d.field}: ${d.message}` : d.message)
            .join('; ');
          return { success: false, status: response.status, error: detail };
        }
        return {
          success: false,
          status: response.status,
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
    const result = await this.request<DeviceResponseDTO>('/devices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return this.translateDeviceError(result);
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
      // Omitted means live devices only; 'true' is the recycle bin.
      deleted: query?.deleted,
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
    const result = await this.request<DeviceResponseDTO>(`/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return this.translateDeviceError(result);
  }

  /**
   * Soft delete: the device leaves every listing at once, but the row and its
   * collected history survive a 7-day grace period, so `restoreDevice` can bring
   * it back and `purgeDevice` can end it early.
   *
   * Refused while a live contracted service or an open ticket still points at
   * the device — both `400`s the caller is expected to show, since neither is
   * fixable from a delete dialog.
   */
  async deleteDevice(id: string): Promise<ApiResponse<void>> {
    const result = await this.request<void>(`/devices/${id}`, { method: 'DELETE' });
    if (!result.success && result.error) {
      const blocked = translateDeviceDeleteBlocker(result.error);
      if (blocked) return { success: false, status: result.status, error: blocked.message };
    }
    return result;
  }

  /** Undoes a soft delete, inside the grace period. Comes back with monitoring off. */
  async restoreDevice(id: string): Promise<ApiResponse<DeviceResponseDTO>> {
    const result = await this.request<DeviceResponseDTO>(`/devices/${id}/restore`, {
      method: 'POST',
    });
    return this.translateBinError(result);
  }

  /**
   * Ends the grace period now instead of waiting it out. Every ping result,
   * alert, wireless snapshot and credential belonging to the device goes with
   * it — there is no undo.
   */
  async purgeDevice(id: string): Promise<ApiResponse<void>> {
    const result = await this.request<void>(`/devices/${id}/purge`, { method: 'DELETE' });
    return this.translateBinError(result);
  }

  /**
   * Swaps one physical box for another: retires this device into `retiredStatus`
   * and creates its successor, carrying the location, category, owner, IP,
   * credentials and contracted service across.
   */
  async replaceDevice(
    id: string,
    data: ReplaceDeviceDTO
  ): Promise<ApiResponse<ReplaceDeviceResultDTO>> {
    const result = await this.request<ReplaceDeviceResultDTO>(`/devices/${id}/replace`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!result.success && result.error) {
      const translated = translateDeviceReplaceError(result.error);
      if (translated) {
        return { success: false, status: result.status, error: translated.message, errorField: translated.field ?? undefined };
      }
    }
    return result;
  }

  // The backend replies in English when a MAC or IP is already taken by another
  // device, and likewise when a status invariant is broken (a retired device
  // without a serial number or MAC, an ACTIVE one without an IP or location).
  // The rest of this UI is in Spanish, so surface the same fact in that language
  // and tag the field it belongs to.
  private translateDeviceError<T>(result: ApiResponse<T>): ApiResponse<T> {
    if (!result.success && result.error) {
      const translated = translateDeviceConflict(result.error) ?? translateDeviceInvariant(result.error);
      if (translated) {
        return { success: false, error: translated.message, errorField: translated.field ?? undefined };
      }
    }
    return result;
  }

  // Restore and purge are refused on the state of the tombstone — an expired
  // grace period, a device that was never deleted — so the answer belongs in a
  // banner, not on a form field.
  private translateBinError<T>(result: ApiResponse<T>): ApiResponse<T> {
    if (!result.success && result.error) {
      const translated = translateDeviceBinError(result.error);
      if (translated) return { success: false, status: result.status, error: translated };
    }
    return result;
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
    const result = await this.request<void>(`/locations/${id}`, { method: 'DELETE' });
    return this.translateLocationError(result);
  }

  async getLocationMapPins(): Promise<ApiResponse<LocationMapResponse>> {
    return this.request<LocationMapResponse>('/locations/map');
  }

  // The backend replies in English when a location still has devices assigned to
  // it, refusing the delete; the rest of this UI is in Spanish, so surface the
  // same fact in that language.
  private translateLocationError<T>(result: ApiResponse<T>): ApiResponse<T> {
    if (!result.success && result.error) {
      const match = result.error.match(
        /^Cannot delete location: it has (\d+) device\(s\) assigned\. Reassign or remove those devices first\.$/
      );
      if (match) {
        const count = Number(match[1]);
        const noun = count === 1 ? 'dispositivo asignado' : 'dispositivos asignados';
        return {
          success: false,
          error: `No se puede eliminar la ubicación: tiene ${count} ${noun}. Reasigne o elimine esos dispositivos primero.`,
        };
      }
    }
    return result;
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
    const result = await this.request<VendorDTO>('/vendors', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return this.translateVendorError(result);
  }

  async updateVendor(id: string, data: UpdateVendorDTO): Promise<ApiResponse<VendorDTO>> {
    const result = await this.request<VendorDTO>(`/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return this.translateVendorError(result);
  }

  async deleteVendor(id: string): Promise<ApiResponse<void>> {
    const result = await this.request<void>(`/vendors/${id}`, { method: 'DELETE' });
    return this.translateVendorError(result);
  }

  // The backend replies in English for these vendor conflicts; the rest of this UI
  // is in Spanish, so surface the same facts in that language.
  private translateVendorError<T>(result: ApiResponse<T>): ApiResponse<T> {
    if (!result.success && result.error) {
      const slugMatch = result.error.match(/^A vendor with slug "(.+)" already exists$/);
      if (slugMatch) {
        return {
          success: false,
          error: `Ya existe un fabricante con el slug "${slugMatch[1]}"`,
          errorField: 'slug',
        };
      }

      // The name is unique too, and compared exactly — "Ubiquiti" and "ubiquiti"
      // are two names, though their slugs would collide anyway.
      const nameMatch = result.error.match(/^A vendor with name "(.+)" already exists$/);
      if (nameMatch) {
        return {
          success: false,
          error: `Ya existe un fabricante con el nombre "${nameMatch[1]}"`,
          errorField: 'name',
        };
      }

      const modelsMatch = result.error.match(
        /^Cannot delete vendor: it has (\d+) device model\(s\) associated\. Remove all device models first\.$/
      );
      if (modelsMatch) {
        const count = Number(modelsMatch[1]);
        const noun = count === 1 ? 'modelo de dispositivo asociado' : 'modelos de dispositivo asociados';
        return {
          success: false,
          error: `No se puede eliminar el fabricante: tiene ${count} ${noun}. Elimina primero todos los modelos de dispositivo.`,
        };
      }

      // Deleting an id nobody recognizes (a stale tab, say) is a caller error,
      // not a no-op — it fails loudly instead of the record just staying gone.
      if (/^Vendor not found: /.test(result.error)) {
        return { success: false, error: 'No se encontró el fabricante.' };
      }
    }
    return result;
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
    const result = await this.request<DeviceModelResponseDTO>('/device-models', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return this.translateDeviceModelError(result);
  }

  async updateDeviceModel(id: string, data: UpdateDeviceModelDTO): Promise<ApiResponse<DeviceModelResponseDTO>> {
    const result = await this.request<DeviceModelResponseDTO>(`/device-models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return this.translateDeviceModelError(result);
  }

  /**
   * `purgeBinnedDevices` is the DEV-030 confirmation: only send it once the
   * operator has agreed to permanently remove the model's recycled devices
   * along with it. Omitting it (the default) refuses instead of guessing.
   */
  async deleteDeviceModel(id: string, purgeBinnedDevices?: boolean): Promise<ApiResponse<void>> {
    const qs = this.buildQuery({ purgeBinnedDevices: purgeBinnedDevices ? true : undefined });
    const result = await this.request<void>(`/device-models/${id}${qs}`, { method: 'DELETE' });
    return this.translateDeviceModelError(result);
  }

  // The backend replies in English for these device model conflicts; the rest of this UI
  // is in Spanish, so surface the same fact in that language.
  private translateDeviceModelError<T>(result: ApiResponse<T>): ApiResponse<T> {
    if (!result.success && result.error) {
      const duplicateMatch = result.error.match(/^A device model "(.+)" already exists for this vendor$/);
      if (duplicateMatch) {
        return {
          success: false,
          error: `Ya existe un modelo de dispositivo "${duplicateMatch[1]}" para este fabricante`,
        };
      }

      // Turning isWireless off is refused while any device on the model still
      // holds a wireless config — those configs carry operator-entered values,
      // so the backend never deletes them on its own.
      const wirelessMatch = result.error.match(
        /^Cannot mark device model as non-wireless: (\d+) device\(s\) built on it have a wireless config\. Delete those wireless configs first\.$/
      );
      if (wirelessMatch) {
        const count = Number(wirelessMatch[1]);
        const subject = count === 1
          ? '1 dispositivo de este modelo tiene configuración inalámbrica'
          : `${count} dispositivos de este modelo tienen configuración inalámbrica`;
        const tail = count === 1
          ? 'Elimina esa configuración inalámbrica primero.'
          : 'Elimina esas configuraciones inalámbricas primero.';
        return {
          success: false,
          error: `No se puede quitar el modo inalámbrico: ${subject}. ${tail}`,
        };
      }

      const devicesMatch = result.error.match(
        /^Cannot delete device model: it has (\d+) device\(s\) associated\. Reassign or remove those devices first\.$/
      );
      if (devicesMatch) {
        return { success: false, error: liveDeviceModelMessage(Number(devicesMatch[1])) };
      }

      // DEV-030: every remaining device on the model is already in the recycle
      // bin. Surface the count so the caller can confirm and retry with
      // purgeBinnedDevices=true rather than treating this as a dead end.
      const binnedMatch = result.error.match(
        /^Cannot delete device model: it has (\d+) device\(s\) in the recycle bin\. Retry with purgeBinnedDevices=true to remove them permanently along with the model\.$/
      );
      if (binnedMatch) {
        const count = Number(binnedMatch[1]);
        return { success: false, binnedDeviceCount: count, error: binnedDeviceModelMessage(count) };
      }
    }
    return result;
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

  async getAlert(id: string): Promise<ApiResponse<AlertDTO>> {
    return this.request<AlertDTO>(`/alerts/${id}`);
  }

  /** Only RESOLVED alerts can be deleted; an OPEN one returns 409. ADMIN only. */
  async deleteAlert(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/alerts/${id}`, { method: 'DELETE' });
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

  async rebootWirelessDevice(deviceId: string): Promise<ApiResponse<WirelessRebootResult>> {
    return this.request<WirelessRebootResult>(`/devices/${deviceId}/wireless/reboot`, {
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

  // ==================== Suspension Enforcement ====================
  // Both endpoints query the router live; a failed call means "unknown", not
  // "not enforced" — callers must not treat an error as a negative answer.

  async listEnforcedSuspensions(): Promise<ApiResponse<EnforcedSuspensionsResponse>> {
    return this.request<EnforcedSuspensionsResponse>('/enforcement/suspensions');
  }

  async getContractedServiceEnforcement(id: string): Promise<ApiResponse<ServiceEnforcementStatusDTO>> {
    return this.request<ServiceEnforcementStatusDTO>(`/contracted-services/${id}/enforcement`);
  }

  // ==================== Bills ====================

  async generateBill(data: GenerateBillDTO): Promise<ApiResponse<BillDTO>> {
    return this.request<BillDTO>('/bills/generate', { method: 'POST', body: JSON.stringify(data) });
  }

  async generateBulkBills(data: GenerateBulkBillsDTO): Promise<ApiResponse<BulkGenerateResult>> {
    return this.request<BulkGenerateResult>('/bills/generate-bulk', { method: 'POST', body: JSON.stringify(data) });
  }

  async listBills(query?: ListBillsQuery): Promise<ApiResponse<BillListResponse>> {
    const qs = this.buildQuery({
      customerId: query?.customerId,
      status: query?.status,
      year: query?.year,
      month: query?.month,
      limit: query?.limit,
      offset: query?.offset,
    });
    return this.request<BillListResponse>(`/bills${qs}`);
  }

  async getBill(id: string): Promise<ApiResponse<BillDTO>> {
    return this.request<BillDTO>(`/bills/${id}`);
  }

  async payBill(id: string): Promise<ApiResponse<BillDTO>> {
    return this.request<BillDTO>(`/bills/${id}/pay`, { method: 'POST' });
  }

  async markBillOverdue(id: string): Promise<ApiResponse<BillDTO>> {
    return this.request<BillDTO>(`/bills/${id}/overdue`, { method: 'POST' });
  }

  async cancelBill(id: string): Promise<ApiResponse<BillDTO>> {
    return this.request<BillDTO>(`/bills/${id}/cancel`, { method: 'POST' });
  }

  // The PDF endpoint returns a binary document, not the JSON envelope, so it
  // bypasses request() and carries the Bearer token on a raw fetch → blob.
  async downloadBillPdf(id: string): Promise<ApiResponse<Blob>> {
    try {
      const headers: Record<string, string> = {};
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
      const response = await fetch(`${this.baseUrl}/bills/${id}/pdf`, { headers });
      if (!response.ok) {
        let error = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const data = await response.json();
          error = data.error || data.message || error;
        } catch {
          /* non-JSON error body */
        }
        return { success: false, error };
      }
      const blob = await response.blob();
      return { success: true, data: blob };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }
}

import { mockApiService } from './mock-api.service';

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export const apiService = USE_MOCK ? mockApiService : new ApiService();
export default apiService;
