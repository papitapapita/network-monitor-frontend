'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { InfoTip } from '@/components/ui';

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

export default function TopologyPage() {
  // A device page's «Ver en el mapa» opens the map on it.
  const focusId = useSearchParams().get('focus');
  const { data, isLoading, error } = useQuery({
    queryKey: ['topology'],
    queryFn: async () => {
      const r = await apiService.getTopology();
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al cargar la topología');
      return r.data;
    },
    refetchInterval: REFRESH_MS,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      <div className="px-4 sm:px-6 pt-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 pb-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Topología</h1>
          <InfoTip>
            De qué equipo cuelga cada uno: el AP de un CPE, el switch de un AP, el router de un switch. Durante una
            caída, el equipo en rojo es donde está la falla; los grises detrás de él están aislados, probablemente
            no dañados. Se actualiza cada minuto.
          </InfoTip>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
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
