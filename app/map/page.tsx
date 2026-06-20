'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner size="lg" message="Cargando mapa..." />
    </div>
  ),
});

export default function MapPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['locationMapPins'],
    queryFn: async () => {
      const r = await apiService.getLocationMapPins();
      if (!r.success) throw new Error(r.error ?? 'Error al cargar el mapa');
      return r.data!;
    },
  });

  const pins = data?.pins ?? [];
  const totalDevices = pins.reduce((sum, p) => sum + p.devices.length, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mapa de Red</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ubicaciones y dispositivos geolocalizados</p>
          </div>
          {data && (
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{pins.length}</div>
                <div className="text-gray-500 dark:text-gray-400">Ubicaciones</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{totalDevices}</div>
                <div className="text-gray-500 dark:text-gray-400">Dispositivos</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 min-h-0 relative">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" message="Cargando mapa..." />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">Error al cargar el mapa</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
            </div>
          </div>
        )}

        {!isLoading && !error && pins.length === 0 && (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                Sin ubicaciones en el mapa
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Ninguna ubicación tiene coordenadas configuradas.
              </p>
              <Link
                href="/locations"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Administrar ubicaciones →
              </Link>
            </div>
          </div>
        )}

        {!isLoading && !error && pins.length > 0 && (
          <MapView pins={pins} className="h-full w-full" />
        )}
      </div>
    </div>
  );
}
