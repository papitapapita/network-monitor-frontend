import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { TopologyDTO } from '@/types/topology.types';

export const TOPOLOGY_QUERY_KEY = ['topology'] as const;

async function fetchTopology(): Promise<TopologyDTO> {
  const r = await apiService.getTopology();
  if (!r.success || !r.data) throw new Error(r.error ?? 'Error al cargar la topología');
  return r.data;
}

/**
 * The whole network graph, refetched every `refreshMs` while mounted. The
 * topology page and the location map share the key, so whichever is open
 * reads the other's last answer straight away.
 */
export function useTopology({ refreshMs, enabled = true }: { refreshMs: number; enabled?: boolean }) {
  return useQuery({
    queryKey: TOPOLOGY_QUERY_KEY,
    queryFn: fetchTopology,
    refetchInterval: refreshMs,
    enabled,
  });
}
