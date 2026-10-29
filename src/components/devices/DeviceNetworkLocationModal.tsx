'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Button, LoadingSpinner, Modal } from '@/components/ui';
import { UnreadRoutersNotice } from '@/components/topology/UnreadRoutersNotice';
import type { NetworkSightingDTO } from '@/types/topology.types';

function Sighting({ s }: { s: NetworkSightingDTO }) {
  return (
    <>
      <Link href={`/devices/${s.routerDeviceId}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
        {s.routerName}
      </Link>{' '}
      · <span className="font-mono">{s.port}</span>
      {s.portComment && <> ({s.portComment})</>}
      <span className="block text-xs text-gray-500 dark:text-gray-400">
        por la MAC <span className="font-mono">{s.macAddress}</span>
      </span>
    </>
  );
}

/**
 * Which router port the device sits behind (`GET /topology/:id/location`,
 * DEV-199), from every MikroTik's bridge host table read when the dialog
 * opens. Nothing is stored, so each opening asks again.
 */
export function DeviceNetworkLocationModal({ deviceId, isOpen, onClose }: { deviceId: string; isOpen: boolean; onClose: () => void }) {
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['device-network-location', deviceId],
    queryFn: async () => {
      const r = await apiService.getDeviceNetworkLocation(deviceId);
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al buscar dónde está conectado');
      return r.data;
    },
    enabled: isOpen,
    staleTime: 0,
    gcTime: 0,
  });

  const loc = data?.location;
  const others = data?.sightings.filter((s) => !(loc && s.routerDeviceId === loc.routerDeviceId && s.port === loc.port)) ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="¿Dónde está conectado?"
      info="Se buscan las MAC del equipo en la tabla de hosts del bridge de cada MikroTik de la empresa, leída ahora. En la red plana todos los routers del camino lo ven; el más cercano es el que no tiene otro router detrás de ese puerto."
    >
      {isFetching ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner message="Leyendo los routers... puede tardar unos segundos" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
      ) : data ? (
        <div className="space-y-4 text-sm">
          {data.location ? (
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-gray-800 dark:text-gray-200">
              <p className="text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-400">Conectado a</p>
              <p className="mt-1">
                <Sighting s={data.location} />
              </p>
            </div>
          ) : data.sightings.length === 0 ? (
            <p className="text-gray-700 dark:text-gray-300">
              Ningún router lo ve ahora. Un equipo que lleva unos minutos sin tráfico sale de las tablas del bridge, así que esto
              no significa que esté desconectado.
            </p>
          ) : (
            <p className="text-gray-700 dark:text-gray-300">
              Varios routers lo ven, pero no se puede saber cuál es el más cercano.
            </p>
          )}

          {others.length > 0 && (
            <details open={!data.location}>
              <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
                {data.location ? `También lo ve${others.length === 1 ? '' : 'n'} ${others.length} router${others.length === 1 ? '' : 's'} más` : 'Routers que lo ven'}
              </summary>
              <ul className="mt-2 space-y-2 pl-4">
                {others.map((s) => (
                  <li key={`${s.routerDeviceId}-${s.port}-${s.macAddress}`}>
                    <Sighting s={s} />
                  </li>
                ))}
              </ul>
            </details>
          )}

          {data.macAddresses.length > 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              MAC buscadas: <span className="font-mono">{data.macAddresses.join(', ')}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">El equipo no tiene ninguna MAC conocida que buscar.</p>
          )}

          <UnreadRoutersNotice routers={data.unreadRouters} consequence="la respuesta puede estar incompleta" />
        </div>
      ) : null}
      <Modal.Footer>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          Buscar de nuevo
        </Button>
        <Button onClick={onClose}>Cerrar</Button>
      </Modal.Footer>
    </Modal>
  );
}
