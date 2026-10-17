'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, Badge, LoadingSpinner, PageHeader } from '@/components/ui';
import { StreamIndicator, StreamErrorNotice } from '@/components/wireless/StreamStatus';
import { LegendKey } from '@/components/dashboard/charts';
import { InterfaceSparkline } from '@/components/routers/InterfaceSparkline';
import { useRouterTraffic, type LiveRouter } from '@/hooks/useRouterTraffic';
import { useNow } from '@/hooks/useWirelessThroughput';
import { fmtAge, fmtBps } from '@/constants/wireless.constants';
import {
  TRAFFIC_SERIES,
  customerRates,
  isUplinkInterface,
  translateRouterTrafficError,
} from '@/constants/router-traffic.constants';

/**
 * What the main routers carry right now, per interface (MON-060 … MON-066).
 * One SSE connection feeds every card: the opening frame lists every router
 * with `category: 'GATEWAY'`, and each later frame replaces one of them.
 * The backend only asks the routers while someone is watching, and keeps
 * nothing, so the charts start empty and grow while the page stays open.
 */
export default function RouterTrafficPage() {
  const { routers, loaded, intervalSeconds, state, retry } = useRouterTraffic();
  const now = useNow(1_000, state.status !== 'error');
  const [showDown, setShowDown] = useState(false);

  return (
    <div className="p-8">
      <PageHeader
        title="Routers principales"
        info={`Tráfico de cada interfaz de los routers con la categoría Gateway, leído del router cada ${intervalSeconds} s mientras esta página está abierta. Bajada y subida se cuentan del lado de los clientes: en la LAN la bajada es lo que el router envía (TX); en una interfaz cuyo nombre la marca como salida a Internet (wan, isp, uplink…), lo que recibe (RX). Las gráficas muestran los últimos dos minutos.`}
        actions={<StreamIndicator state={state} />}
      />

      <div className="space-y-6">
        <StreamErrorNotice state={state} onRetry={retry} />

        {!loaded ? (
          state.status === 'error' ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Sin datos: la transmisión no está disponible.
            </p>
          ) : (
            <div className="flex justify-center py-6">
              <LoadingSpinner message="Conectando con la transmisión..." />
            </div>
          )
        ) : routers.length === 0 ? (
          <Card>
            <Card.Body>
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No hay routers principales. Un dispositivo aparece aquí cuando su categoría es{' '}
                <span className="font-medium">Gateway (Salida a Internet)</span>.
              </p>
            </Card.Body>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-4">
                {TRAFFIC_SERIES.map((s) => (
                  <LegendKey key={s.key} color={s.color} label={s.label} />
                ))}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={showDown}
                  onChange={(e) => setShowDown(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                Mostrar interfaces sin enlace
              </label>
            </div>
            {routers.map((live) => (
              <RouterCard key={live.router.deviceId} live={live} now={now} showDown={showDown} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** The device page's tab where each kind of `error` is fixed. */
function fixHref(deviceId: string, error: string): string {
  if (/username and password|RouterOS API/.test(error)) return `/devices/${deviceId}?tab=settings`;
  return `/devices/${deviceId}`;
}

function RouterCard({ live, now, showDown }: { live: LiveRouter; now: number; showDown: boolean }) {
  const { router, receivedAt, history } = live;
  const up = router.interfaces.filter((i) => i.running).length;
  const shown = useMemo(
    () => (showDown ? router.interfaces : router.interfaces.filter((i) => i.running)),
    [router.interfaces, showDown]
  );

  // `at` is the server's clock; the age counts on the browser's from the
  // frame's arrival, so clock skew cannot show a fresh read as old.
  const age = router.at ? Math.max(0, (now - receivedAt) / 1000) : null;

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/devices/${router.deviceId}`}
              className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              {router.deviceName}
            </Link>
            {!router.error && router.interfaces.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {up} de {router.interfaces.length} interfaces con enlace
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {age === null ? 'Esperando la primera lectura…' : `Leído ${fmtAge(age)}`}
          </span>
        </div>
      </Card.Header>
      <Card.Body>
        {router.error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <span>{translateRouterTrafficError(router.error)}</span>
            <Link href={fixHref(router.deviceId, router.error)} className="font-medium underline">
              Abrir el dispositivo
            </Link>
          </div>
        ) : router.at === null ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner message="Leyendo el router..." />
          </div>
        ) : shown.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {router.interfaces.length === 0
              ? 'El router no reportó interfaces.'
              : 'Ninguna interfaz tiene enlace.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="pb-2 pr-3 font-medium">Interfaz</th>
                  <th className="pb-2 pr-3 font-medium">Bajada</th>
                  <th className="pb-2 pr-3 font-medium">Subida</th>
                  <th className="pb-2 font-medium w-2/5">Últimos 2 min</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((iface) => {
                  const rates = customerRates(iface);
                  const uplink = isUplinkInterface(iface.name);
                  return (
                  <tr key={iface.name} className="border-b border-gray-100 last:border-0 dark:border-gray-700">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{iface.name}</span>
                        {!iface.running && <Badge variant="neutral">Sin enlace</Badge>}
                        {uplink && <Badge variant="info">Salida a Internet</Badge>}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{iface.type}</div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-900 dark:text-gray-100">
                      {fmtBps(rates.downBps)}
                      <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{uplink ? 'RX' : 'TX'}</span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-900 dark:text-gray-100">
                      {fmtBps(rates.upBps)}
                      <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">{uplink ? 'TX' : 'RX'}</span>
                    </td>
                    <td className="py-2">
                      <InterfaceSparkline
                        samples={(history.get(iface.name) ?? []).map((h) => customerRates({ name: iface.name, ...h }))}
                        label={iface.name}
                      />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
