'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Badge, Card, SectionTitle } from '@/components/ui';
import { POE_MODE_LABELS, POE_STATUS, poeReason } from '@/constants/power.constants';
import { POE_ANCHOR } from '@/components/locations/LocationPoeCard';
import type { PowerSourceDTO } from '@/types/power.types';

/**
 * NONE reasons that only say PoE has nothing to do with this device — no IP,
 * no site, or no PoE switch at its site. The card stays out of the way then;
 * the other NONE (a switch is there, no port names it) is worth saying.
 */
const NOT_ON_POE = [
  'The device has no IP address',
  'The device has no location',
  'There is no PoE switch at the device location',
];

function Source({ s }: { s: PowerSourceDTO['sources'][number] }) {
  const status = POE_STATUS[s.status];
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <Link href={`/devices/${s.switchDeviceId}`} className="text-brand-600 dark:text-brand-400 hover:underline">
        {s.switchName}
      </Link>
      <span className="text-gray-700 dark:text-gray-300">
        puerto <span className="font-mono">{s.port}</span>
      </span>
      <Badge variant={status.variant}>{status.label}</Badge>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        Modo {POE_MODE_LABELS[s.mode].toLowerCase()}
        {s.powerWatts != null ? ` · ${s.powerWatts.toFixed(1)} W` : ''}
      </span>
    </li>
  );
}

/**
 * Which PoE port at the device's own site powers it
 * (`GET /api/devices/:id/power-source`), read live from the site's switches.
 */
export function DevicePowerSourceCard({ deviceId, locationId }: { deviceId: string; locationId: string | null }) {
  const { data } = useQuery({
    queryKey: ['powerSource', deviceId],
    queryFn: async () => {
      const r = await apiService.getDevicePowerSource(deviceId);
      return r.success && r.data ? r.data : null;
    },
    enabled: !!locationId,
    staleTime: 30_000,
  });

  if (!data || (data.kind === 'NONE' && NOT_ON_POE.some((r) => data.reason?.includes(r)))) return null;

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle info="El puerto de un switch PoE de su ubicación cuya etiqueta tiene la IP de este equipo. Se lee en vivo del switch.">
            Alimentación PoE
          </SectionTitle>
          {locationId && (
            <Link href={`/locations/${locationId}#${POE_ANCHOR}`} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
              Puertos del sitio
            </Link>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {data.kind === 'FOUND' ? (
          <ul>
            <Source s={data.sources[0]} />
          </ul>
        ) : data.kind === 'DUPLICATE' ? (
          <>
            <p className="mb-2 text-sm text-yellow-700 dark:text-yellow-400">
              Más de un puerto está rotulado con su IP: corrige las etiquetas para saber cuál lo alimenta.
            </p>
            <ul className="space-y-1">
              {data.sources.map((s) => (
                <Source key={`${s.switchDeviceId}:${s.port}`} s={s} />
              ))}
            </ul>
          </>
        ) : (
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>{poeReason(data.reason)}</p>
            {data.kind === 'NONE' && (
              <p className="text-xs">Escribe su IP en la etiqueta del puerto que lo alimenta (en RouterOS, el comentario de la interfaz).</p>
            )}
            {data.unreadSwitches.length > 0 && (
              <ul className="list-disc list-inside text-xs">
                {data.unreadSwitches.map((u) => (
                  <li key={u.deviceId}>
                    <Link href={`/devices/${u.deviceId}`} className="underline">
                      {u.name}
                    </Link>
                    : {poeReason(u.reason)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
