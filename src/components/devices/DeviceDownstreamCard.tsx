'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Badge, Card, SectionTitle } from '@/components/ui';
import { REACHABILITY } from '@/constants/topology.constants';

/** Enough to see the shape of an AP's clients; the map holds the rest. */
const LISTED = 25;

/**
 * What hangs off this device on the network (`GET /api/topology/:id/descendants`),
 * with how each one is doing — the "who is affected" view for an AP or switch.
 * Renders nothing for a device with nothing below it, or one off the network.
 */
export function DeviceDownstreamCard({ deviceId }: { deviceId: string }) {
  const [showAll, setShowAll] = useState(false);
  const { data } = useQuery({
    queryKey: ['topology', 'descendants', deviceId],
    queryFn: async () => {
      const r = await apiService.getTopologyDescendants(deviceId);
      // 404: not on the network with nothing below it — nothing to show either way.
      return r.success && r.data ? r.data.nodes : [];
    },
    refetchInterval: 60_000,
  });

  const [self, ...below] = data ?? [];
  if (!self || below.length === 0) return null;

  const names = new Map((data ?? []).map((n) => [n.id, n.name]));
  const down = below.filter((n) => n.reachability === 'DOWN').length;
  const unreachable = below.filter((n) => n.reachability === 'UNREACHABLE').length;
  const listed = showAll ? below : below.slice(0, LISTED);

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle info="Los equipos que dependen de este en la red, directa o indirectamente. Si este cae, quedan sin alcance y no avisan uno por uno.">
            Dependen de este equipo
          </SectionTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">{below.length} equipo{below.length === 1 ? '' : 's'}</span>
            {down > 0 && <Badge variant="danger">{down} caído{down === 1 ? '' : 's'}</Badge>}
            {unreachable > 0 && <Badge variant="neutral">{unreachable} sin alcance</Badge>}
            <Link href={`/topology?focus=${deviceId}`} className="text-brand-600 dark:text-brand-400 hover:underline">
              Ver en el mapa
            </Link>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        <div className="overflow-x-auto table-scroll-x">
          <table className="min-w-full text-sm" aria-label="Equipos que dependen de este">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4 font-medium">Equipo</th>
                <th className="py-2 pr-4 font-medium">IP</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 font-medium">Vía</th>
              </tr>
            </thead>
            <tbody>
              {listed.map((n) => {
                const r = REACHABILITY[n.reachability];
                return (
                  <tr key={n.id} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 pr-4">
                      <Link href={`/devices/${n.id}`} className="text-brand-600 dark:text-brand-400 hover:underline">
                        {n.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-700 dark:text-gray-300">{n.ipAddress ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={r.variant}>{r.label}</Badge>
                    </td>
                    <td className="py-2 text-gray-700 dark:text-gray-300">
                      {n.upstreamDeviceId === deviceId ? 'Directo' : names.get(n.upstreamDeviceId ?? '') ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {below.length > LISTED && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 text-sm text-brand-600 dark:text-brand-400 hover:underline"
          >
            {showAll ? 'Mostrar menos' : `Mostrar los ${below.length}`}
          </button>
        )}
      </Card.Body>
    </Card>
  );
}
