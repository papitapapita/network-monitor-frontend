import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { AgentDTO } from '@/types/agent.types';

export const AGENTS_QUERY_KEY = ['agents'] as const;

/**
 * An agent reports every 30 s and is marked offline after 5 min of silence,
 * checked once a minute — refetching at the same pace keeps the badges honest
 * without outrunning what the backend can know.
 */
const AGENT_REFRESH_MS = 30_000;

async function fetchAgents(): Promise<AgentDTO[]> {
  const r = await apiService.listAgents();
  if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los agentes');
  return r.data.agents;
}

export function useAgents() {
  return useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: fetchAgents,
    refetchInterval: AGENT_REFRESH_MS,
  });
}
