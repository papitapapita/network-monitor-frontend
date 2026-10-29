'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Badge, Button, Card, LoadingSpinner } from '@/components/ui';
import { translateRouterReason } from '@/constants/port-speed.constants';
import type { RouterNeighborDTO, RouterPortNeighborsDTO } from '@/types/topology.types';

/** The comment to type on the router; copying is a convenience, the text selects whole when the clipboard is off. */
function SuggestedComment({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Plain-HTTP installs have no clipboard; the text is selectable.
    }
  };
  return (
    <p className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 px-3 py-2 text-sm text-brand-800 dark:text-brand-300">
      <span>
        Comentario sugerido: <span className="font-medium select-all">{text}</span>
      </span>
      <button type="button" onClick={copy} className="text-xs font-medium underline cursor-pointer">
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </p>
  );
}

function NeighborRow({ n }: { n: RouterNeighborDTO }) {
  const what = [n.board ?? n.platform, n.version].filter(Boolean).join(' · ');
  return (
    <li className={`py-2 ${n.wireless ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {n.knownDeviceId ? (
          <Link href={`/devices/${n.knownDeviceId}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
            {n.knownDeviceName}
          </Link>
        ) : (
          <span className="font-medium text-gray-900 dark:text-gray-100">{n.identity ?? 'Sin nombre'}</span>
        )}
        {n.knownDeviceId && n.identity && n.identity !== n.knownDeviceName && (
          <span className="text-xs text-gray-500 dark:text-gray-400">se llama «{n.identity}»</span>
        )}
        {!n.knownDeviceId && <Badge variant="warning">No está en el inventario</Badge>}
        {n.wireless && (
          <span title="Se oye a través de un AP por su radio: no está conectado por cable a este puerto.">
            <Badge variant="neutral">Por radio</Badge>
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
        {[n.ipAddress, n.macAddress].filter(Boolean).map((v, i) => (
          <React.Fragment key={v}>
            {i > 0 && ' · '}
            <span className="font-mono">{v}</span>
          </React.Fragment>
        ))}
        {what && <> · {what}</>}
        {n.remoteInterface && (
          <>
            {' '}
            · su interfaz <span className="font-mono">{n.remoteInterface}</span>
          </>
        )}
      </p>
    </li>
  );
}

function PortCard({ p }: { p: RouterPortNeighborsDTO }) {
  return (
    <Card>
      <Card.Body>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{p.port}</span>
          {p.comment && <span className="text-sm text-gray-600 dark:text-gray-400 wrap-anywhere">{p.comment}</span>}
          {p.uplink && (
            <span title="El puerto hacia la salida a Internet: oye toda la red plana, así que no dice qué hay conectado.">
              <Badge variant="info">Uplink</Badge>
            </span>
          )}
        </div>
        {p.neighbors.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No oye a nadie.</p>
        ) : p.uplink ? (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
              Oye {p.neighbors.length} {p.neighbors.length === 1 ? 'vecino' : 'vecinos'}
            </summary>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {p.neighbors.map((n, i) => (
                <NeighborRow key={i} n={n} />
              ))}
            </ul>
          </details>
        ) : (
          <>
            <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-700/50 text-sm">
              {p.neighbors.filter((n) => !n.wireless).map((n, i) => (
                <NeighborRow key={i} n={n} />
              ))}
            </ul>
            {/* Stations heard through an AP say nothing about the cable; they can be dozens. */}
            {p.neighbors.some((n) => n.wireless) && (
              <details className="mt-1 text-sm">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
                  {p.neighbors.filter((n) => n.wireless).length} más por radio, a través de un AP
                </summary>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {p.neighbors.filter((n) => n.wireless).map((n, i) => (
                    <NeighborRow key={i} n={n} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        {p.suggestedComment && <SuggestedComment text={p.suggestedComment} />}
      </Card.Body>
    </Card>
  );
}

/**
 * What each port of a MikroTik hears over MNDP/CDP/LLDP, matched with
 * inventory (`GET /topology/routers/:id/neighbors`, DEV-198). Read live on
 * every visit; nothing is written to the router — a suggested comment is
 * for the technician to type there.
 */
export function DeviceNeighborsTab({ deviceId }: { deviceId: string }) {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['router-neighbors', deviceId],
    queryFn: async () => {
      const r = await apiService.getRouterNeighbors(deviceId);
      if (r.status === 404) throw new Error('El backend no lee los vecinos de este equipo: no es uno de los MikroTik de la empresa (los switches SwOS no cuentan).');
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al leer los vecinos');
      return r.data;
    },
    staleTime: 0,
  });

  const ports = data?.ports.filter((p) => p.neighbors.length > 0 || p.comment || p.suggestedComment) ?? [];
  const silent = (data?.ports.length ?? 0) - ports.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          Lo que oye cada puerto de este router por MNDP/CDP/LLDP, leído ahora. Un puerto que no es el uplink y oye un solo
          equipo por cable dice qué hay conectado; los que se oyen a través de un AP aparecen atenuados.
        </p>
        <Button size="sm" variant="outline" onClick={() => refetch()} isLoading={isFetching && !isLoading}>
          Leer de nuevo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner message="Leyendo los vecinos del router..." />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
      ) : data!.reason ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No se pudo leer: {translateRouterReason(data!.reason)}</p>
      ) : ports.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Ningún puerto oye a otro equipo.</p>
      ) : (
        <>
          {ports.map((p) => (
            <PortCard key={p.port} p={p} />
          ))}
          {silent > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {silent === 1 ? 'Un puerto más no oye' : `${silent} puertos más no oyen`} a nadie y no tiene{silent === 1 ? '' : 'n'} comentario.
            </p>
          )}
        </>
      )}
    </div>
  );
}
