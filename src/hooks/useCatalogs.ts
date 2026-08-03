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
