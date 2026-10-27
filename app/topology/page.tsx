'use client';

import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { InfoTip } from '@/components/ui';
import { useUrlState } from '@/hooks/useUrlState';
import { TopologySuggestions } from '@/components/topology/TopologySuggestions';

// React Flow measures the window; there is nothing to render on the server.
const NetworkGraph = dynamic(() => import('@/components/topology/NetworkGraph'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner size="lg" message="Cargando topología..." />
    </div>
  ),
});

/** Reachability moves with the polls; a minute is about as fast as they run. */
const REFRESH_MS = 60_000;

type Tab = 'map' | 'suggestions';
const TAB_LABELS: Record<Tab, string> = { map: 'Mapa', suggestions: 'Sugerencias' };

export default function TopologyPage() {
  const url = useUrlState();
  const tab: Tab = url.get('tab') === 'suggestions' ? 'suggestions' : 'map';
  // A device page's «Ver en el mapa» opens the map on it.
  const focusId = url.get('focus') || null;
  const { data, isLoading, error } = useQuery({
    queryKey: ['topology'],
    queryFn: async () => {
      const r = await apiService.getTopology();
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al cargar la topología');
      return r.data;
    },
    refetchInterval: REFRESH_MS,
    enabled: tab === 'map',
  });

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="px-4 sm:px-6 pt-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 pb-2">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Topología</h1>
          <InfoTip>
            De qué equipo cuelga cada uno: el AP de un CPE, el switch de un AP, el router de un switch. Durante una
            caída, el equipo en rojo es donde está la falla; los grises detrás de él están aislados, probablemente
            no dañados. Se actualiza cada minuto.
          </InfoTip>
        </div>
        <nav className="flex gap-6">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => url.set({ tab: t === 'map' ? null : t, focus: null })}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'suggestions' ? (
          <TopologySuggestions />
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" message="Cargando topología..." />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">{(error as Error).message}</div>
        ) : (
          <NetworkGraph nodes={data!.nodes} initialFocus={focusId} />
        )}
      </div>
    </div>
  );
}
