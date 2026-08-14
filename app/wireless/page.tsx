'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, Badge, LoadingSpinner, PageHeader } from '@/components/ui';
import { StreamIndicator, StreamErrorNotice } from '@/components/wireless/StreamStatus';
import {
  useFleetThroughput,
  useNow,
  liveAgeSeconds,
  type LiveReading,
} from '@/hooks/useWirelessThroughput';
import {
  fmtAge,
  fmtBps,
  fmtKbps,
  utilisationBarClass,
  utilisationVariant,
} from '@/constants/wireless.constants';
import { apiService } from '@/services/api.service';

type SortField = 'name' | 'total' | 'utilisation' | 'age';

interface Row {
  entry: LiveReading;
  name: string;
  ipAddress: string | null;
  ageSeconds: number;
}

/**
 * Fleet-wide live throughput. One SSE connection feeds every row: the opening
 * frame carries the whole fleet, and each later frame replaces a single device.
 *
 * Only devices that have been polled at least once appear — the backend leaves
 * the rest out rather than sending a row of nulls that would read as an idle
 * link instead of an unknown one.
 */
export default function WirelessThroughputPage() {
  const { entries, state, retry } = useFleetThroughput();
  const now = useNow(1_000, state.status !== 'error');

  // The stream carries ids only, so names come from the device list. One fetch:
  // the roster changes far more slowly than the readings do.
  const [names, setNames] = useState<Record<string, { name: string; ipAddress: string | null }>>({});
  const [namesLoading, setNamesLoading] = useState(true);

  useEffect(() => {
    apiService.listDevices({ limit: 300 }).then((result) => {
      if (result.success && result.data) {
        setNames(
          Object.fromEntries(
            result.data.devices.map((d) => [d.id, { name: d.name, ipAddress: d.ipAddress }])
          )
        );
      }
      setNamesLoading(false);
    });
  }, []);

  const [sortField, setSortField] = useState<SortField>('total');
  const [ascending, setAscending] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const list = [...entries.values()].map((entry) => ({
      entry,
      // A device polled for the first time mid-stream arrives before the roster
      // fetch knows it; its id is still something to search for.
      name: names[entry.reading.deviceId]?.name ?? entry.reading.deviceId.slice(0, 8),
      ipAddress: names[entry.reading.deviceId]?.ipAddress ?? null,
      ageSeconds: liveAgeSeconds(entry, now),
    }));

    const value = (row: Row): number | string => {
      switch (sortField) {
        case 'name':
          return row.name.toLowerCase();
        case 'total':
          return row.entry.reading.throughputTotalBps ?? -1;
        case 'utilisation':
          return row.entry.reading.utilisationPercent ?? -1;
        case 'age':
          return row.ageSeconds;
      }
    };

    return list.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'es', { sensitivity: 'base' });
      return ascending ? cmp : -cmp;
    });
  }, [entries, names, now, sortField, ascending]);

  const totals = useMemo(() => {
    let tx = 0;
    let rx = 0;
    let stale = 0;
    let saturated = 0;
    for (const { entry } of rows) {
      tx += entry.reading.throughputTxBps ?? 0;
      rx += entry.reading.throughputRxBps ?? 0;
      if (entry.reading.stale) stale++;
      if ((entry.reading.utilisationPercent ?? 0) >= 90) saturated++;
    }
    return { tx, rx, stale, saturated };
  }, [rows]);

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setAscending((v) => !v);
    } else {
      setSortField(field);
      // Traffic and load read top-down; names read A→Z.
      setAscending(field === 'name');
    }
  };

  const sortArrow = (field: SortField) => (sortField === field ? (ascending ? ' ▲' : ' ▼') : '');

  return (
    <div className="p-8">
      <PageHeader
        title="Tráfico en vivo"
        subtitle="Throughput de cada radio, actualizado cuando el sondeo guarda una lectura nueva"
        actions={<StreamIndicator state={state} />}
      />

      <div className="space-y-6">
        <StreamErrorNotice state={state} onRetry={retry} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryTile label="Enlaces con lecturas" value={String(rows.length)} />
          <SummaryTile label="Subida total (TX)" value={fmtBps(totals.tx)} />
          <SummaryTile label="Bajada total (RX)" value={fmtBps(totals.rx)} />
          <SummaryTile
            label="Al 90% del plan o más"
            value={String(totals.saturated)}
            tone={totals.saturated > 0 ? 'danger' : undefined}
          />
        </div>

        <Card>
          <Card.Header>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Enlaces</h2>
              {totals.stale > 0 && (
                <Badge variant="warning">
                  {totals.stale === 1
                    ? '1 lectura desactualizada'
                    : `${totals.stale} lecturas desactualizadas`}
                </Badge>
              )}
            </div>
          </Card.Header>
          <Card.Body>
            {rows.length === 0 ? (
              state.status === 'error' ? (
                <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Sin datos: la transmisión no está disponible.
                </p>
              ) : namesLoading || state.status === 'connecting' ? (
                <div className="flex justify-center py-6">
                  <LoadingSpinner message="Conectando con la transmisión..." />
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Ningún equipo inalámbrico ha sido sondeado todavía.
                </p>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <SortableHeader onClick={() => toggleSort('name')}>
                        Equipo{sortArrow('name')}
                      </SortableHeader>
                      <th className="pb-2 pr-3 font-medium">Tipo</th>
                      <th className="pb-2 pr-3 font-medium">TX</th>
                      <th className="pb-2 pr-3 font-medium">RX</th>
                      <SortableHeader onClick={() => toggleSort('total')}>
                        Total{sortArrow('total')}
                      </SortableHeader>
                      <SortableHeader onClick={() => toggleSort('utilisation')}>
                        Uso del plan{sortArrow('utilisation')}
                      </SortableHeader>
                      <SortableHeader onClick={() => toggleSort('age')}>
                        Medido{sortArrow('age')}
                      </SortableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ entry, name, ipAddress, ageSeconds }) => {
                      const r = entry.reading;
                      return (
                        <tr
                          key={r.deviceId}
                          className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                        >
                          <td className="py-2 pr-3">
                            <Link
                              href={`/devices/${r.deviceId}`}
                              className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {name}
                            </Link>
                            {ipAddress && (
                              <div className="font-mono text-xs text-gray-400 dark:text-gray-500">
                                {ipAddress}
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">
                            {r.deviceType === 'ACCESS_POINT' ? 'Access Point' : 'Estación'}
                          </td>
                          <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                            {fmtBps(r.throughputTxBps)}
                          </td>
                          <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                            {fmtBps(r.throughputRxBps)}
                          </td>
                          <td className="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">
                            {fmtBps(r.throughputTotalBps)}
                          </td>
                          <td className="py-2 pr-3">
                            {/* An AP has no provisioned plan, so it never has a
                                utilisation — say so instead of showing 0%. */}
                            {r.linkCapacityKbps === null ? (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                Sin plan
                              </span>
                            ) : (
                              <div className="min-w-[120px]">
                                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {fmtKbps(r.linkCapacityKbps)}
                                  </span>
                                  <Badge variant={utilisationVariant(r.utilisationPercent)}>
                                    {r.utilisationPercent !== null
                                      ? `${r.utilisationPercent.toFixed(0)} %`
                                      : '—'}
                                  </Badge>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${utilisationBarClass(r.utilisationPercent)}`}
                                    style={{ width: `${Math.min(r.utilisationPercent ?? 0, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {fmtAge(ageSeconds)}
                            </span>
                            {r.stale && (
                              <Badge variant="warning" className="ml-2">
                                Antigua
                              </Badge>
                            )}
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
      </div>
    </div>
  );
}

function SortableHeader({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <th className="pb-2 pr-3 font-medium">
      <button
        onClick={onClick}
        className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"
      >
        {children}
      </button>
    </th>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger';
}) {
  const colorClass =
    tone === 'danger'
      ? 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
      : 'text-gray-900 bg-gray-50 dark:bg-gray-800 dark:text-gray-100';
  return (
    <div className={`overflow-hidden rounded-lg p-4 ${colorClass}`}>
      <p className="text-xl font-bold sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs font-medium leading-tight opacity-75 sm:text-sm">{label}</p>
    </div>
  );
}
