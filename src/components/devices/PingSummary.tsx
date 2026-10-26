'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { PollingHistoryResponse, PollingResultDTO } from '@/types/polling.types';
import { useWidth } from '@/components/dashboard/charts';

/**
 * The backend's cap on one history page — at a 60 s interval, about 16 of the
 * 24 hours. It bounds the sparkline only: the figures come from the endpoint's
 * statistics, which cover the whole window.
 */
const WINDOW_LIMIT = 1000;
const WINDOW_HOURS = 24;

export interface PingSummary {
  /** Oldest first, so the sparkline reads left to right. */
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
 * rows for the sparkline. Skipped while `enabled` is false, since a device
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

const HEIGHT = 40;

/**
 * Latency across the window, with each unanswered ping as a red tick on the
 * floor — a gap in the line alone would read as "no data", not "down".
 */
export function LatencySparkline({ samples }: { samples: PollingResultDTO[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  if (samples.length < 2) return null;

  const t0 = new Date(samples[0].timestamp).getTime();
  const span = Math.max(1, new Date(samples[samples.length - 1].timestamp).getTime() - t0);
  const max = Math.max(1, ...samples.map((s) => s.metrics?.latencyMs ?? 0));
  const pad = 3;
  const x = (s: PollingResultDTO) => pad + ((new Date(s.timestamp).getTime() - t0) / span) * (width - 2 * pad);
  const y = (ms: number) => pad + (HEIGHT - 2 * pad) * (1 - ms / max);

  // Break the line at every failure so it never bridges an outage.
  let path = '';
  let penUp = true;
  for (const s of samples) {
    if (s.status !== 'SUCCESS' || !s.metrics) {
      penUp = true;
      continue;
    }
    path += `${penUp ? 'M' : 'L'}${x(s)},${y(s.metrics.latencyMs)} `;
    penUp = false;
  }

  return (
    <div ref={ref} className="h-10 w-full">
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`Latencia: máximo ${Math.round(max)} ms`}>
          <line x1={pad} x2={width - pad} y1={HEIGHT - pad} y2={HEIGHT - pad} stroke="var(--viz-axis)" strokeWidth={1} />
          <path d={path} fill="none" stroke="var(--viz-series)" strokeWidth={1.5} strokeLinejoin="round" />
          {samples
            .filter((s) => s.status !== 'SUCCESS')
            .map((s) => (
              <line
                key={s.id}
                x1={x(s)}
                x2={x(s)}
                y1={HEIGHT - pad}
                y2={HEIGHT - pad - 8}
                stroke="var(--viz-critical)"
                strokeWidth={1.5}
              />
            ))}
        </svg>
      )}
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

/** Availability and latency over the last day, plus the latency line. */
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
      <LatencySparkline samples={summary.samples} />
    </div>
  );
}
