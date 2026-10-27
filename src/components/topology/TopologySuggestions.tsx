'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { fetchAllLocations } from '@/hooks/useCatalogs';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/contexts/toast.context';
import { Badge, Button, Checkbox, LoadingSpinner, Select } from '@/components/ui';
import { upstreamLinkError } from '@/constants/topology.constants';
import type { UpstreamLinkResultDTO, UpstreamSuggestionDTO } from '@/types/topology.types';

/**
 * Ticked when the review opens: a first link the network is sure of — a radio
 * that names its AP by MAC, or a PoE port labelled with the device's IP. An
 * IP-only match and a change to an existing link wait for the operator.
 */
const tickedByDefault = (s: UpstreamSuggestionDTO): boolean =>
  !s.currentUpstreamDeviceId && (s.source === 'POE' || s.matchedBy === 'MAC');

const fmt = (iso: string) => new Date(iso).toLocaleString('es');

function SourceCell({ s }: { s: UpstreamSuggestionDTO }) {
  if (s.source === 'POE') {
    return (
      <span title="Un puerto del switch PoE de su sitio está rotulado con la IP de este equipo, y ningún otro lo está.">
        PoE · puerto <span className="font-mono">{s.port}</span>
      </span>
    );
  }
  return (
    <span title={s.observedAt ? `Lectura del radio: ${fmt(s.observedAt)}` : undefined}>
      Radio · {s.matchedBy === 'MAC' ? 'MAC del AP' : 'IP del AP'}
      {s.matchedBy === 'IP' && (
        <Badge variant="warning" className="ml-1.5">
          menos seguro
        </Badge>
      )}
    </span>
  );
}

/**
 * The upstreams the network proposes (`GET /api/topology/suggestions`), for
 * an operator to tick and accept in one go. Refused links stay on screen with
 * their reason after the list is read again.
 */
export function TopologySuggestions() {
  const { canWrite } = usePermissions();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState('');
  // The operator's own ticks; a row they never touched follows tickedByDefault.
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [accepting, setAccepting] = useState(false);
  // Refusals from the last accept, by device, kept across the reload.
  const [failed, setFailed] = useState<Record<string, UpstreamLinkResultDTO>>({});

  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: fetchAllLocations });
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['topology', 'suggestions', locationId],
    queryFn: async () => {
      const r = await apiService.getUpstreamSuggestions(locationId || undefined);
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al cargar las sugerencias');
      return r.data;
    },
  });

  const suggestions = useMemo(() => data?.suggestions ?? [], [data]);
  const isTicked = (s: UpstreamSuggestionDTO) => ticks[s.deviceId] ?? tickedByDefault(s);
  const chosen = suggestions.filter(isTicked);
  const allTicked = suggestions.length > 0 && chosen.length === suggestions.length;
  // A refused link the reload no longer proposes still has to be read.
  const orphanFailures = Object.values(failed).filter((f) => !suggestions.some((s) => s.deviceId === f.deviceId));

  const tickAll = (on: boolean) => setTicks(Object.fromEntries(suggestions.map((s) => [s.deviceId, on])));

  const accept = async () => {
    setAccepting(true);
    const r = await apiService.acceptUpstreamLinks(
      chosen.map((s) => ({ deviceId: s.deviceId, upstreamDeviceId: s.suggestedUpstreamDeviceId }))
    );
    setAccepting(false);
    if (!r.success || !r.data) {
      showError(r.error || 'No se pudieron aceptar las sugerencias');
      return;
    }
    const { linked, failed: failedCount, results } = r.data;
    setFailed(Object.fromEntries(results.filter((x) => x.outcome === 'FAILED').map((x) => [x.deviceId, x])));
    setTicks({});
    if (failedCount === 0) showSuccess(`${linked} enlace${linked === 1 ? '' : 's'} creado${linked === 1 ? '' : 's'}.`);
    else showError(`${linked} enlazados, ${failedCount} rechazados: el motivo está en cada fila.`);
    queryClient.invalidateQueries({ queryKey: ['topology'] });
  };

  const names = new Map(suggestions.map((s) => [s.deviceId, s.deviceName]));

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-y-auto h-full">
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
        El sistema propone de qué equipo cuelga cada uno a partir de lo que ya lee: el AP que reporta cada radio cliente
        y los puertos de los switches PoE rotulados con la IP de la antena que alimentan. Nada se enlaza hasta que lo
        aceptes.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setTicks({});
            }}
            options={[{ value: '', label: 'Todas las ubicaciones' }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
            fullWidth
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} isLoading={isFetching && !isLoading}>
          Volver a buscar
        </Button>
        {canWrite && suggestions.length > 0 && (
          <Button size="sm" onClick={accept} isLoading={accepting} disabled={chosen.length === 0} className="sm:ml-auto">
            Aceptar seleccionados ({chosen.length})
          </Button>
        )}
      </div>

      {data && data.unreadSwitches.length > 0 && (
        <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-300">
          <p className="font-medium">
            {data.unreadSwitches.length === 1 ? 'Un switch PoE no se pudo leer' : `${data.unreadSwitches.length} switches PoE no se pudieron leer`}
            : faltan las sugerencias de las antenas que alimentan.
          </p>
          <ul className="mt-1 list-disc list-inside">
            {data.unreadSwitches.map((u) => (
              <li key={u.deviceId}>
                <Link href={`/devices/${u.deviceId}`} className="underline">
                  {u.name}
                </Link>{' '}
                — {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {orphanFailures.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
          <p className="font-medium">Enlaces rechazados</p>
          <ul className="mt-1 list-disc list-inside">
            {orphanFailures.map((f) => (
              <li key={f.deviceId}>
                <Link href={`/devices/${f.deviceId}`} className="underline">
                  {names.get(f.deviceId) ?? 'Equipo'}
                </Link>
                : {upstreamLinkError(f.error) ?? f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner message="Leyendo radios y switches PoE..." />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No hay sugerencias: cada equipo que el sistema sabe ubicar ya cuelga de donde debe.</p>
      ) : (
        <div className="overflow-x-auto table-scroll-x rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm" aria-label="Sugerencias de enlace">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-gray-500 dark:text-gray-400">
                {canWrite && (
                  <th className="py-2 pl-3 w-8">
                    <Checkbox
                      aria-label={allTicked ? 'Desmarcar todas' : 'Marcar todas'}
                      checked={allTicked}
                      onChange={(e) => tickAll(e.target.checked)}
                    />
                  </th>
                )}
                <th className="py-2 px-3 font-medium">Equipo</th>
                <th className="py-2 px-3 font-medium">Cuelga de ahora</th>
                <th className="py-2 px-3 font-medium">Sugerido</th>
                <th className="py-2 px-3 font-medium">Por qué</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => {
                const refusal = failed[s.deviceId];
                return (
                  <React.Fragment key={s.deviceId}>
                    <tr className={`border-t border-gray-100 dark:border-gray-700/50 ${refusal ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}>
                      {canWrite && (
                        <td className="py-2 pl-3 align-top">
                          <Checkbox
                            aria-label={`Aceptar ${s.deviceName} → ${s.suggestedUpstreamDeviceName}`}
                            checked={isTicked(s)}
                            onChange={(e) => setTicks((t) => ({ ...t, [s.deviceId]: e.target.checked }))}
                          />
                        </td>
                      )}
                      <td className="py-2 px-3 align-top">
                        <Link href={`/devices/${s.deviceId}`} className="text-brand-600 dark:text-brand-400 hover:underline">
                          {s.deviceName}
                        </Link>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-mono">{s.ipAddress ?? 'sin IP'}</span>
                          {s.locationName ? ` · ${s.locationName}` : ''}
                        </span>
                      </td>
                      <td className="py-2 px-3 align-top text-gray-700 dark:text-gray-300">
                        {s.currentUpstreamDeviceId ? (
                          <>
                            <Link href={`/devices/${s.currentUpstreamDeviceId}`} className="hover:underline">
                              {s.currentUpstreamDeviceName}
                            </Link>
                            <Badge variant="warning" className="ml-1.5">cambio</Badge>
                          </>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">Nada</span>
                        )}
                      </td>
                      <td className="py-2 px-3 align-top font-medium text-gray-900 dark:text-gray-100">
                        <Link href={`/devices/${s.suggestedUpstreamDeviceId}`} className="hover:underline">
                          {s.suggestedUpstreamDeviceName}
                        </Link>
                      </td>
                      <td className="py-2 px-3 align-top text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        <SourceCell s={s} />
                      </td>
                    </tr>
                    {refusal && (
                      <tr className="bg-red-50/60 dark:bg-red-900/10">
                        <td colSpan={canWrite ? 5 : 4} className="pb-2 px-3 text-xs text-red-700 dark:text-red-400">
                          Rechazado: {upstreamLinkError(refusal.error) ?? refusal.error}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
