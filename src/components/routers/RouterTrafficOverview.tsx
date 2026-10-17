'use client';

import React from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui';
import { StreamErrorNotice } from '@/components/wireless/StreamStatus';
import { DualTrend, LegendKey } from '@/components/dashboard/charts';
import { InterfaceSparkline } from '@/components/routers/InterfaceSparkline';
import type { UseRouterTrafficResult } from '@/hooks/useRouterTraffic';
import { fmtBps } from '@/constants/wireless.constants';
import {
  TRAFFIC_SERIES,
  customerRates,
  routerTotals,
  translateRouterTrafficError,
} from '@/constants/router-traffic.constants';

/**
 * The network's traffic as the main routers see it: the current download and
 * upload, their line since the page opened, and one row per router. Takes the
 * hook's result rather than opening its own stream, so a page that also shows
 * a headline figure holds one stream slot, not two.
 */
export function RouterTrafficOverview({ traffic, chartHeight = 180 }: { traffic: UseRouterTrafficResult; chartHeight?: number }) {
  const { routers, loaded, totalHistory, state, retry } = traffic;
  const now = totalHistory.at(-1);

  if (state.status === 'error' && !loaded) return <StreamErrorNotice state={state} onRetry={retry} />;
  if (!loaded) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner message="Conectando con los routers..." />
      </div>
    );
  }
  if (routers.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        No hay routers principales. Un dispositivo aparece aquí cuando su categoría es{' '}
        <span className="font-medium">Gateway (Salida a Internet)</span>.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <StreamErrorNotice state={state} onRetry={retry} />
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        {TRAFFIC_SERIES.map((s) => (
          <div key={s.key}>
            <LegendKey color={s.color} label={s.label} />
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
              {now ? fmtBps(now[s.key]) : '—'}
            </p>
          </div>
        ))}
      </div>

      {totalHistory.length < 2 ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Reuniendo lecturas…</p>
      ) : (
        <DualTrend
          label="Tráfico de los routers principales"
          height={chartHeight}
          series={TRAFFIC_SERIES}
          points={totalHistory.map((p) => ({ t: p.t, values: { downBps: p.downBps, upBps: p.upBps } }))}
          format={(v) => fmtBps(v)}
        />
      )}

      {/* With one router the figures above already are its own. */}
      {routers.length > 1 && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700/70 dark:border-gray-700">
          {routers.map(({ router, history }) => {
            const totals = routerTotals(router.interfaces);
            return (
              <li key={router.deviceId} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-4 py-2.5 text-sm">
                <Link
                  href={`/devices/${router.deviceId}`}
                  className="truncate font-medium text-gray-700 hover:text-brand-600 dark:text-gray-300 dark:hover:text-brand-400"
                >
                  {router.deviceName}
                </Link>
                {router.error ? (
                  <span className="truncate text-xs text-amber-700 dark:text-amber-400" title={translateRouterTrafficError(router.error)}>
                    {translateRouterTrafficError(router.error)}
                  </span>
                ) : totals ? (
                  <InterfaceSparkline
                    label={router.deviceName}
                    samples={(history.get(totals.iface.name) ?? []).map((h) => customerRates({ name: totals.iface.name, ...h }))}
                  />
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {router.at === null ? 'Leyendo…' : 'Sin interfaces con enlace'}
                  </span>
                )}
                <span className="whitespace-nowrap text-right text-xs tabular-nums text-gray-900 dark:text-gray-100">
                  {totals ? `↓ ${fmtBps(totals.downBps)} · ↑ ${fmtBps(totals.upBps)}` : '—'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
