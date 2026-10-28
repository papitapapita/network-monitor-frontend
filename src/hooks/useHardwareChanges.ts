import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import type { HardwareChangeDTO } from '@/types/wireless.types';

/** Shared by the page and the menu count, so an action on one updates both. */
export const HARDWARE_CHANGES_QUERY_KEY = ['hardwareChanges'] as const;

/** A radio is re-read on its own interval (minutes to an hour); faster would only repeat the answer. */
const REFRESH_MS = 5 * 60_000;

async function fetchHardwareChanges(): Promise<HardwareChangeDTO[]> {
  const r = await apiService.getHardwareChanges();
  if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los cambios de equipo');
  return r.data.devices;
}

/** Every polled radio whose reported MAC or model no longer matches inventory (WLS-154). */
export function useHardwareChanges(enabled = true) {
  return useQuery({
    queryKey: HARDWARE_CHANGES_QUERY_KEY,
    queryFn: fetchHardwareChanges,
    refetchInterval: REFRESH_MS,
    enabled,
  });
}
