'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { PollingHistoryResponse, PollingResultDTO } from '@/types/polling.types';
import { LegendKey, Tooltip, niceAxis, useWidth } from '@/components/dashboard/charts';

/**
 * The backend's cap on one history page — at a 60 s interval, about 16 of the
 * 24 hours. It bounds the chart only: the figures come from the endpoint's
 * statistics, which cover the whole window.
 */
const WINDOW_LIMIT = 1000;
const WINDOW_HOURS = 24;

export interface PingSummary {
  /** Oldest first, so the chart reads left to right. */
  samples: PollingResultDTO[];
  /** Percent of pings answered in the window; null with no pings at all. */
  availability: number | null;
  avgLatencyMs: number | null;
  lastLatencyMs: number | null;
  failedCount: number;
  /** Pings in the whole window, which may be more than `samples` holds. */
  totalCount: number;
}

function summarise({ results, totalCount, statistics }: PollingHistoryResponse): PingSummary {
  const samples = [...results].reverse();
  const lastAnswered = [...samples].reverse().find((r) => r.status === 'SUCCESS');
  // No unfiltered status is sent, so totalCount is the window's own count.
  const failedCount = Math.round(totalCount * (1 - statistics.successRate / 100));
  return {
    samples,
    availability: totalCount > 0 ? statistics.successRate : null,
    // The endpoint reports 0 when nothing answered; that is no reading, not 0 ms.
    avgLatencyMs: failedCount < totalCount ? statistics.averageResponseTime : null,
    lastLatencyMs: lastAnswered?.metrics?.latencyMs ?? null,
    failedCount,
    totalCount,
  };
}

/**
 * The last day of pings: the endpoint's statistics for the figures (MON-043:
 * they describe the whole date window, not the page) and the newest page of
 * rows for the chart. Skipped while `enabled` is false, since a device
 * nobody polls has no recent pings worth a request.
 */
export function usePingSummary(deviceId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: ['devices', deviceId, 'ping-summary'],
    queryFn: async () => {
      const r = await apiService.getPollingHistory(deviceId, {
        fromDate: new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString(),
        limit: WINDOW_LIMIT,
        sortBy: 'checkedAt',
        sortOrder: 'DESC',
      });
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar el historial de sondeo');
      return summarise(r.data);
    },
    enabled,
  });
  return {
    summary: enabled ? (query.data ?? null) : null,
    loading: query.isFetching,
    refresh: () => { if (enabled) query.refetch(); },
  };
}

export function availabilityTone(pct: number | null): string {
  if (pct === null) return 'text-gray-900 dark:text-gray-100';
  if (pct >= 99) return 'text-green-700 dark:text-green-400';
  if (pct >= 95) return 'text-yellow-700 dark:text-yellow-400';
  return 'text-red-700 dark:text-red-400';
}

const HEIGHT = 180;

const fmtTime = (t: number) => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

/**
 * Latency across the window on a millisecond axis, with each unanswered ping
 * as a red tick on the floor — a gap in the line alone would read as "no
 * data", not "down". Hovering names the nearest ping and what it answered.
 */
export function LatencyChart({ samples }: { samples: PollingResultDTO[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);
  if (samples.length < 2) return null;

  const times = samples.map((s) => new Date(s.timestamp).getTime());
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const span = Math.max(1, t1 - t0);
  const { max, ticks } = niceAxis(Math.max(1, ...samples.map((s) => s.metrics?.latencyMs ?? 0)), 3, true);
  const margin = { top: 10, right: 8, bottom: 20, left: 52 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = HEIGHT - margin.top - margin.bottom;
  const x = (t: number) => margin.left + ((t - t0) / span) * plotW;
  const y = (ms: number) => margin.top + plotH * (1 - ms / max);
  const floor = y(0);

  // Break the line at every failure so it never bridges an outage.
  let path = '';
  let penUp = true;
  samples.forEach((s, i) => {
    if (s.status !== 'SUCCESS' || !s.metrics) {
      penUp = true;
      return;
    }
    path += `${penUp ? 'M' : 'L'}${x(times[i])},${y(s.metrics.latencyMs)} `;
    penUp = false;
  });

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left) / rect.width) * span;
    let nearest = 0;
    for (let i = 1; i < times.length; i++) {
      if (Math.abs(times[i] - t) < Math.abs(times[nearest] - t)) nearest = i;
    }
    setHovered(nearest);
  };

  const hs = hovered !== null ? samples[hovered] : null;
  const hx = hovered !== null ? x(times[hovered]) : 0;
  const hy = hs?.metrics && hs.status === 'SUCCESS' ? y(hs.metrics.latencyMs) : floor;

  return (
    <div>
      <div ref={ref} className="relative w-full" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={`Latencia de ping: máximo ${max} ms`}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? 'var(--viz-axis)' : 'var(--viz-grid)'}
                  strokeWidth={1}
                />
                <text x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-gray-400 text-[10px] tabular-nums dark:fill-gray-500">
                  {t} ms
                </text>
              </g>
            ))}
            <path d={path} fill="none" stroke="var(--viz-series)" strokeWidth={1.5} strokeLinejoin="round" />
            {samples.map((s, i) =>
              s.status !== 'SUCCESS' ? (
                <line key={s.id} x1={x(times[i])} x2={x(times[i])} y1={floor} y2={floor - 10} stroke="var(--viz-critical)" strokeWidth={1.5} />
              ) : null,
            )}
            <text x={margin.left} y={HEIGHT - 4} className="fill-gray-400 text-[10px] dark:fill-gray-500">
              {fmtTime(t0)}
            </text>
            <text x={width - margin.right} y={HEIGHT - 4} textAnchor="end" className="fill-gray-400 text-[10px] dark:fill-gray-500">
              {fmtTime(t1)}
            </text>
            {hs && (
              <>
                <line x1={hx} x2={hx} y1={margin.top} y2={floor} stroke="var(--viz-axis)" strokeWidth={1} />
                <circle
                  cx={hx}
                  cy={hy}
                  r={4}
                  fill={hs.status === 'SUCCESS' ? 'var(--viz-series)' : 'var(--viz-critical)'}
                  stroke="var(--viz-surface)"
                  strokeWidth={2}
                />
              </>
            )}
            <rect
              x={margin.left}
              y={margin.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              onMouseMove={onMove}
              onMouseLeave={() => setHovered(null)}
            />
          </svg>
        )}
        {hs && (
          <Tooltip x={hx} y={hy} containerWidth={width}>
            <p className="text-gray-500 dark:text-gray-400">{fmtTime(times[hovered!])}</p>
            <p className={`font-medium ${hs.status === 'SUCCESS' ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-400'}`}>
              {hs.status === 'SUCCESS' && hs.metrics ? `${Math.round(hs.metrics.latencyMs)} ms` : 'Sin respuesta'}
            </p>
          </Tooltip>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <LegendKey color="var(--viz-series)" label="Latencia del ping" />
        <LegendKey color="var(--viz-critical)" label="Sin respuesta" />
      </div>
    </div>
  );
}

/** One figure on the health strip: a small label over a large value. */
export function HealthTile({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 min-w-0">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100 wrap-anywhere">{children}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 wrap-anywhere">{hint}</div>}
    </div>
  );
}

/** Availability and latency over the last day, plus the latency chart. */
export function PingSummaryTiles({ summary }: { summary: PingSummary }) {
  if (summary.totalCount === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Sin sondeos en las últimas {WINDOW_HOURS} h.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <HealthTile
          label={`Disponibilidad (${WINDOW_HOURS} h)`}
          hint={summary.failedCount > 0 ? `${summary.failedCount} sin respuesta` : 'Todos respondieron'}
        >
          <span className={availabilityTone(summary.availability)}>
            {summary.availability !== null ? `${summary.availability.toFixed(summary.availability === 100 ? 0 : 1)}%` : '—'}
          </span>
        </HealthTile>
        <HealthTile label="Latencia actual">
          {summary.lastLatencyMs !== null ? `${Math.round(summary.lastLatencyMs)} ms` : '—'}
        </HealthTile>
        <HealthTile label={`Latencia promedio (${WINDOW_HOURS} h)`}>
          {summary.avgLatencyMs !== null ? `${Math.round(summary.avgLatencyMs)} ms` : '—'}
        </HealthTile>
      </div>
      <div>
        <h4 className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Latencia del ping · últimas {WINDOW_HOURS} h</h4>
        <LatencyChart samples={summary.samples} />
      </div>
    </div>
  );
}
