import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { DeviceModelResponseDTO } from '@/types/device.types';
import { LocationResponseDTO } from '@/types/location.types';

/** Both list endpoints cap `limit` at 100, so the whole catalog takes several calls. */
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

  return useMemo(() => {
    const modelNames: Record<string, string> = {};
    models?.forEach((m) => {
      modelNames[m.id] = `${m.vendorName} ${m.model}`;
    });

    const locationNames: Record<string, string> = {};
    locations?.forEach((l) => {
      locationNames[l.id] = l.name;
    });

    return { modelNames, locationNames };
  }, [models, locations]);
}
