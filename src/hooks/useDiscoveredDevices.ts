import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import type { DiscoveredDeviceDTO } from '@/types/network-scan.types';

/** Shared by the page and the menu count, so an action on one updates both. */
export const DISCOVERED_DEVICES_QUERY_KEY = ['discoveredDevices'] as const;

/** Scans run hours apart and APs are polled every few minutes; faster would only repeat the answer. */
const REFRESH_MS = 5 * 60_000;

/** Hosts the network shows that inventory lacks — pending, or the ignored ones (DEV-200). */
export function useDiscoveredDevices(ignored = false, enabled = true) {
  return useQuery({
    queryKey: [...DISCOVERED_DEVICES_QUERY_KEY, ignored],
    queryFn: async (): Promise<DiscoveredDeviceDTO[]> => {
      const r = await apiService.listDiscoveredDevices(ignored);
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los dispositivos descubiertos');
      return r.data;
    },
    refetchInterval: REFRESH_MS,
    enabled,
  });
}
