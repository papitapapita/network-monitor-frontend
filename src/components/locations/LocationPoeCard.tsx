'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Badge, Card, IconButton, LoadingSpinner, SectionTitle } from '@/components/ui';
import { POE_MATCH, POE_MODE_LABELS, POE_STATUS, POE_SWITCH_OS_LABELS, poeReason } from '@/constants/power.constants';
import type { PoePortDTO, PoeSwitchDTO } from '@/types/power.types';

export const POE_ANCHOR = 'poe';

function RefreshIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function PortRow({ p }: { p: PoePortDTO }) {
  const status = POE_STATUS[p.status];
  const match = POE_MATCH[p.match.kind];
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700/50">
      <td className="py-2 pr-4 font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">{p.port}</td>
      <td className="py-2 pr-4">
        {p.match.deviceId ? (
          <Link href={`/devices/${p.match.deviceId}`} className="text-brand-600 dark:text-brand-400 hover:underline">
            {p.match.deviceName}
          </Link>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">—</span>
        )}
        <span className="block text-xs text-gray-500 dark:text-gray-400 wrap-anywhere">
          Etiqueta: <span className="font-mono">{p.label || '(vacía)'}</span>
        </span>
        {p.match.kind !== 'MATCHED' && (
          <span className="mt-1 inline-flex items-center gap-1" title={match.hint}>
            <Badge variant={match.variant}>{match.label}</Badge>
            {p.match.kind === 'MATCHED_OTHER_LOCATION' && (
              <span className="text-xs text-gray-500 dark:text-gray-400">registrado en {p.match.deviceLocationName ?? 'ninguna ubicación'}</span>
            )}
          </span>
        )}
      </td>
      <td className="py-2 pr-4 whitespace-nowrap">
        <Badge variant={status.variant}>{status.label}</Badge>
        <span className="block text-xs text-gray-500 dark:text-gray-400">Modo: {POE_MODE_LABELS[p.mode]}</span>
      </td>
      <td className="py-2 text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
        {p.powerWatts != null ? `${p.powerWatts.toFixed(1)} W` : '—'}
        {p.voltage != null && <span className="block text-xs text-gray-500 dark:text-gray-400">{p.voltage.toFixed(1)} V</span>}
      </td>
    </tr>
  );
}

function SwitchBlock({ sw }: { sw: PoeSwitchDTO }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
        <Link href={`/devices/${sw.deviceId}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
          {sw.name}
        </Link>
        {sw.ipAddress && <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{sw.ipAddress}</span>}
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {POE_SWITCH_OS_LABELS[sw.firmware]}
          {sw.firmwareVersion ? ` ${sw.firmwareVersion}` : ''}
        </span>
      </div>
      {!sw.readable ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No se leyó: {poeReason(sw.reason)}</p>
      ) : sw.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">No se pudo leer: {poeReason(sw.error)}</p>
      ) : sw.ports.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No tiene puertos de salida PoE.</p>
      ) : (
        <div className="overflow-x-auto table-scroll-x">
          <table className="min-w-full text-sm" aria-label={`Puertos PoE de ${sw.name}`}>
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-1 pr-4 font-medium">Puerto</th>
                <th className="py-1 pr-4 font-medium">Alimenta a</th>
                <th className="py-1 pr-4 font-medium">Estado</th>
                <th className="py-1 font-medium text-right">Consumo</th>
              </tr>
            </thead>
            <tbody>
              {sw.ports.map((p) => (
                <PortRow key={p.port} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * The PoE switches at a site and what each port powers, read live from the
 * switches (`GET /api/locations/:id/poe-ports`). Read only for now: turning a
 * port off and on comes in a later phase. Nothing renders for a site with no
 * PoE switch.
 */
export function LocationPoeCard({ locationId }: { locationId: string }) {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['poePorts', locationId],
    queryFn: async () => {
      const r = await apiService.getLocationPoePorts(locationId);
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al leer los puertos PoE');
      return r.data;
    },
    staleTime: 30_000,
  });

  if (data && data.switches.length === 0) return null;

  return (
    <div id={POE_ANCHOR} className="scroll-mt-4">
      <Card className="mb-6">
        <Card.Header>
          <div className="flex items-center justify-between gap-2">
            <SectionTitle info="Se leen en vivo de cada switch PoE de la ubicación. Cada puerto nombra la antena que alimenta por la primera IP de su etiqueta (en RouterOS, el comentario de la interfaz; en SwOS, el nombre del puerto).">
              Puertos PoE
            </SectionTitle>
            <IconButton icon={isFetching ? null : <RefreshIcon />} label="Leer de nuevo" size="sm" onClick={() => refetch()} isLoading={isFetching} />
          </div>
        </Card.Header>
        <Card.Body>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Leyendo los switches..." />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
          ) : (
            <div className="space-y-6">
              {data!.switches.map((sw) => (
                <SwitchBlock key={sw.deviceId} sw={sw} />
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
