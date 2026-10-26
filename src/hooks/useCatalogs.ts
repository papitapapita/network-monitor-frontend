import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { DeviceListItemDTO, DeviceModelResponseDTO } from '@/types/device.types';
import { LocationResponseDTO } from '@/types/location.types';
import { ContractedServiceDetailDTO, CustomerDTO } from '@/types/customer.types';
import { TechnicianDTO } from '@/types/technician.types';
import { useAgents } from './useAgents';

/** These list endpoints cap `limit` at 100, so a whole catalog takes several calls. */
const PAGE_SIZE = 100;

export async function fetchAllDeviceModels(): Promise<DeviceModelResponseDTO[]> {
  const all: DeviceModelResponseDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listDeviceModels({ limit: PAGE_SIZE, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar modelos');
    all.push(...r.data.deviceModels);
    hasMore = r.data.hasMore;
    offset += PAGE_SIZE;
  }
  return all;
}

export async function fetchAllCustomers(): Promise<CustomerDTO[]> {
  const all: CustomerDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listCustomers({ limit: PAGE_SIZE, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar clientes');
    all.push(...r.data.customers);
    hasMore = r.data.hasMore;
    offset += PAGE_SIZE;
  }
  return all;
}

export async function fetchAllContractedServices(): Promise<ContractedServiceDetailDTO[]> {
  const all: ContractedServiceDetailDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listContractedServices({ limit: PAGE_SIZE, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar servicios');
    all.push(...r.data.contractedServices);
    hasMore = r.data.hasMore;
    offset += PAGE_SIZE;
  }
  return all;
}

export async function fetchAllTechnicians(): Promise<TechnicianDTO[]> {
  const all: TechnicianDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listTechnicians({ limit: PAGE_SIZE, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los técnicos');
    all.push(...r.data.technicians);
    hasMore = r.data.hasMore;
    offset += PAGE_SIZE;
  }
  return all;
}

/**
 * Every live device — for the ticket form's picker and the dashboard. The device
 * list caps `limit` at 300 and is the one catalog that can grow past a few
 * hundred rows, so this is the only fetch-all here that could get expensive —
 * it stays behind `enabled` on the pages that need it.
 *
 * Paging follows `total` and the rows actually returned, not `hasMore` and the
 * limit asked for: a server that clamps the page lower than 300 can still work
 * `hasMore` out from the requested limit and stop us at the first page.
 */
export async function fetchAllDevices(): Promise<DeviceListItemDTO[]> {
  const all: DeviceListItemDTO[] = [];
  for (;;) {
    const r = await apiService.listDevices({ limit: 300, offset: all.length, sortBy: 'name', sortOrder: 'ASC' });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar dispositivos');
    all.push(...r.data.devices);
    if (r.data.devices.length === 0 || all.length >= r.data.total) return all;
  }
}

export async function fetchAllLocations(): Promise<LocationResponseDTO[]> {
  const all: LocationResponseDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listLocations({ limit: PAGE_SIZE, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar las ubicaciones');
    all.push(...r.data.locations);
    hasMore = r.data.hasMore;
    offset += PAGE_SIZE;
  }
  return all;
}

/** Ids the device list only carries as references, resolved to readable names. */
export interface DeviceLookups {
  modelNames: Record<string, string>;
  locationNames: Record<string, string>;
  agentNames: Record<string, string>;
}

/**
 * Model and location names for the optional devices-table columns. Only fetched
 * while one of those columns is visible, so the usual table costs nothing.
 *
 * Shares the `['deviceModels']` and `['locations']` caches with the pages that
 * list them, so a model created elsewhere shows up here through the same
 * invalidation.
 */
export function useDeviceLookups(enabled: boolean): DeviceLookups {
  const { data: models } = useQuery({
    queryKey: ['deviceModels'],
    queryFn: fetchAllDeviceModels,
    enabled,
  });
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: fetchAllLocations,
    enabled,
  });
  const { data: agents } = useAgents(enabled);

  return useMemo(() => {
    const modelNames: Record<string, string> = {};
    models?.forEach((m) => {
      modelNames[m.id] = `${m.vendorName} ${m.model}`;
    });

    const locationNames: Record<string, string> = {};
    locations?.forEach((l) => {
      locationNames[l.id] = l.name;
    });

    const agentNames: Record<string, string> = {};
    agents?.forEach((a) => {
      agentNames[a.id] = a.name;
    });

    return { modelNames, locationNames, agentNames };
  }, [models, locations, agents]);
}
