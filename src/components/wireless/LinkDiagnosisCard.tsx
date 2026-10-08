'use client';

import React, { useState } from 'react';
import { Badge, Button, Card, LoadingSpinner, SectionTitle, Select } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { LegendKey, Tooltip, niceAxis, useWidth } from '@/components/dashboard/charts';
import { StreamErrorNotice, StreamIndicator } from './StreamStatus';
import { useLinkDiagnosis } from '@/hooks/useLinkDiagnosis';
import { useNow } from '@/hooks/useWirelessThroughput';
import { fmtBps, fmtKbps } from '@/constants/wireless.constants';
import type {
  DiagnosisFaultLocation,
  DiagnosisFindingDTO,
  DiagnosisVerdict,
  LinkDiagnosisDTO,
  LinkDiagnosisReportDTO,
  PingSampleDTO,
  PingStatisticsDTO,
  RadioSampleDTO,
} from '@/types/wireless.types';

const DURATION_OPTIONS = [
  { value: '30', label: '30 segundos' },
  { value: '60', label: '1 minuto' },
  { value: '120', label: '2 minutos' },
  { value: '300', label: '5 minutos' },
];

const VERDICT: Record<DiagnosisVerdict, { label: string; variant: BadgeVariant }> = {
  HEALTHY: { label: 'Enlace sano', variant: 'success' },
  DEGRADED: { label: 'Degradado', variant: 'warning' },
  FAILING: { label: 'Fallando', variant: 'danger' },
  INCONCLUSIVE: { label: 'Sin datos suficientes', variant: 'neutral' },
};

const FAULT_LOCATION: Record<DiagnosisFaultLocation, string | null> = {
  NONE: null,
  TARGET_LINK: 'Falla en este equipo o en su propio enlace',
  UPSTREAM: 'Falla aguas arriba: el AP padre o el backhaul',
  UNDETERMINED: 'No se pudo ubicar la falla',
};

const HOP_LABELS: Record<DiagnosisFindingDTO['hop'], string> = {
  TARGET: 'Equipo',
  PARENT: 'AP padre',
  RADIO: 'Radio',
};

const STATUS_TEXT: Record<LinkDiagnosisDTO['status'], string> = {
  RUNNING: 'En curso',
  COMPLETED: 'Finalizado',
  STOPPED: 'Detenido',
};

const fmtMs = (v: number | null) => (v === null ? '—' : `${Math.round(v)} ms`);
const fmtDbm = (v: number | null) => (v === null ? '—' : `${v} dBm`);
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

interface Props {
  deviceId: string;
  canWrite: boolean;
}

/**
 * An on-demand check of one radio for a technician looking at a failing link:
 * ping every second (to the parent AP too, for a station), a radio read every
 * 2 s, and a verdict saying whether the fault is here or upstream. Nothing is
 * stored and no alert comes out of it; the result stays readable for 15
 * minutes after it ends.
 */
export function LinkDiagnosisCard({ deviceId, canWrite }: Props) {
  const d = useLinkDiagnosis(deviceId);
  const [duration, setDuration] = useState('60');
  const running = d.diagnosis?.status === 'RUNNING';
  const now = useNow(1_000, running);

  const lastRadio = [...d.radio].reverse().find((r) => r.ok) ?? null;
  const lastRadioFailure = d.radio.at(-1)?.ok === false ? d.radio.at(-1)! : null;

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle info="Ping cada segundo al equipo (y a su AP padre, si es una estación) y lectura de la radio cada 2 s, durante el tiempo elegido. No guarda nada ni genera alertas; el resultado se puede consultar durante 15 minutos después de terminar.">
            Diagnóstico en vivo
          </SectionTitle>
          <div className="flex flex-wrap items-center gap-3">
            {running && d.streamState && <StreamIndicator state={d.streamState} />}
            {running && canWrite && (
              <Button size="sm" variant="outline" onClick={d.stop} isLoading={d.isStopping}>
                Detener
              </Button>
            )}
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        {d.isLoading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-5">
            {d.error && (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {d.error}
              </p>
            )}
            {running && d.streamState && <StreamErrorNotice state={d.streamState} onRetry={d.retryStream} />}

            {!running &&
              (canWrite ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-44">
                    <Select
                      label="Duración"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      options={DURATION_OPTIONS}
                      fullWidth
                    />
                  </div>
                  <Button onClick={() => d.start(Number(duration))} isLoading={d.isStarting}>
                    {d.diagnosis ? 'Nuevo diagnóstico' : 'Iniciar diagnóstico'}
                  </Button>
                </div>
              ) : (
                !d.diagnosis && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Solo un administrador u operador puede iniciar un diagnóstico.
                  </p>
                )
              ))}

            {d.diagnosis && d.report && (
              <>
                <SessionLine diagnosis={d.diagnosis} now={now} />

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={VERDICT[d.report.verdict].variant}>{VERDICT[d.report.verdict].label}</Badge>
                    {FAULT_LOCATION[d.report.faultLocation] && (
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {FAULT_LOCATION[d.report.faultLocation]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{d.report.summary}</p>
                </div>

                {d.report.findings.length > 0 && (
                  <ul className="space-y-1.5">
                    {d.report.findings.map((f) => (
                      <li
                        key={`${f.hop}:${f.code}`}
                        className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm sm:flex-nowrap"
                      >
                        <Badge variant={f.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                          {f.severity === 'CRITICAL' ? 'Crítico' : 'Advertencia'}
                        </Badge>
                        <span className="text-gray-500 dark:text-gray-400">{HOP_LABELS[f.hop]}</span>
                        {/* Under its badge on a phone, beside it from sm up. */}
                        <span className="basis-full text-gray-900 sm:basis-auto dark:text-gray-100">{f.message}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Latencia (ping)</h3>
                  <LatencyChart
                    ping={d.ping}
                    startedAt={Date.parse(d.diagnosis.startedAt)}
                    durationSeconds={d.diagnosis.durationSeconds}
                    targetLabel={d.diagnosis.target.name ?? d.diagnosis.target.ipAddress}
                    parentLabel={
                      d.diagnosis.parent ? (d.diagnosis.parent.name ?? d.diagnosis.parent.ipAddress) : null
                    }
                  />
                  <StatsTable
                    head="Destino"
                    columns={['Enviados', 'Pérdida', 'Mín / Prom / Máx', 'Jitter', 'Picos ≥150 ms']}
                    rows={pingRows(d.diagnosis, d.report)}
                  />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Tráfico y capacidad</h3>
                  <ThroughputChart
                    radio={d.radio}
                    startedAt={Date.parse(d.diagnosis.startedAt)}
                    durationSeconds={d.diagnosis.durationSeconds}
                  />
                  <StatsTable
                    head="Sentido"
                    columns={['Actual', 'Promedio', 'Pico', 'Capacidad airMAX']}
                    rows={[
                      {
                        key: 'tx',
                        label: 'Subida (TX)',
                        color: TRAFFIC_COLORS.TX,
                        cells: [
                          fmtBps(lastRadio?.throughputTxBps),
                          fmtBps(d.report.radio.throughput.avgTxBps),
                          fmtBps(d.report.radio.throughput.peakTxBps),
                          fmtKbps(lastRadio?.capacityTxKbps),
                        ],
                      },
                      {
                        key: 'rx',
                        label: 'Bajada (RX)',
                        color: TRAFFIC_COLORS.RX,
                        cells: [
                          fmtBps(lastRadio?.throughputRxBps),
                          fmtBps(d.report.radio.throughput.avgRxBps),
                          fmtBps(d.report.radio.throughput.peakRxBps),
                          fmtKbps(lastRadio?.capacityRxKbps),
                        ],
                      },
                    ]}
                  />
                  {d.report.radio.throughput.linkCapacityKbps !== null && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Capacidad del enlace (plan o manual): {fmtKbps(d.report.radio.throughput.linkCapacityKbps)}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Radio{' '}
                    <span className="font-normal text-gray-500 dark:text-gray-400">
                      · {d.report.radio.samples} lectura{d.report.radio.samples === 1 ? '' : 's'}
                      {d.report.radio.failures > 0 && `, ${d.report.radio.failures} fallida${d.report.radio.failures === 1 ? '' : 's'}`}
                    </span>
                  </h3>
                  {lastRadioFailure?.error && (
                    <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
                      Última lectura fallida: {lastRadioFailure.error}
                    </p>
                  )}
                  <RadioSummary radio={lastRadio} />
                </div>
              </>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

function pingRows(diagnosis: LinkDiagnosisDTO, report: LinkDiagnosisReportDTO): StatsRow[] {
  const row = (key: string, label: string, color: string, stats: PingStatisticsDTO): StatsRow => ({
    key,
    label,
    color,
    cells: [
      String(stats.sent),
      `${stats.lossPercent.toFixed(1)} %`,
      `${fmtMs(stats.minMs)} / ${fmtMs(stats.avgMs)} / ${fmtMs(stats.maxMs)}`,
      fmtMs(stats.jitterMs),
      String(stats.spikeCount),
    ],
  });
  const rows = [
    row('target', `${diagnosis.target.name ?? 'Equipo'} (${diagnosis.target.ipAddress})`, HOP_COLORS.TARGET, report.target),
  ];
  if (diagnosis.parent && report.parent) {
    rows.push(row('parent', `${diagnosis.parent.name ?? 'AP padre'} (${diagnosis.parent.ipAddress})`, HOP_COLORS.PARENT, report.parent));
  }
  return rows;
}

function SessionLine({ diagnosis, now }: { diagnosis: LinkDiagnosisDTO; now: number }) {
  if (diagnosis.status === 'RUNNING') {
    const total = diagnosis.durationSeconds;
    const remaining = Math.max(0, Math.min(total, (Date.parse(diagnosis.endsAt) - now) / 1000));
    const pct = ((total - remaining) / total) * 100;
    return (
      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Iniciado {fmtTime(diagnosis.startedAt)}</span>
          <span className="tabular-nums">Quedan {Math.ceil(remaining)} s</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      {STATUS_TEXT[diagnosis.status]} · {fmtTime(diagnosis.startedAt)}
      {diagnosis.endedAt && ` – ${fmtTime(diagnosis.endedAt)}`} · {diagnosis.durationSeconds} s programados
    </p>
  );
}


interface StatsRow {
  key: string;
  label: string;
  color: string;
  /** One per column, in the table's column order. */
  cells: string[];
}

/**
 * A chart's table view — every number the lines stand for. A table on wider
 * screens; on a phone each row becomes its own block of label/value pairs, so
 * nothing has to scroll sideways.
 */
function StatsTable({ head, columns, rows }: { head: string; columns: string[]; rows: StatsRow[] }) {
  return (
    <div className="mt-3">
      <table className="hidden w-full text-sm sm:table">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="py-1 pr-3 font-medium">{head}</th>
            {columns.map((c, i) => (
              <th key={c} className={`py-1 font-medium text-right ${i < columns.length - 1 ? 'pr-3' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums text-gray-900 dark:text-gray-100">
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-gray-100 dark:border-gray-700">
              <td className="py-1.5 pr-3">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="break-all">{r.label}</span>
                </span>
              </td>
              {r.cells.map((cell, i) => (
                <td key={columns[i]} className={`py-1.5 text-right whitespace-nowrap ${i < r.cells.length - 1 ? 'pr-3' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <div key={r.key} className="border-t border-gray-100 pt-2 dark:border-gray-700">
            <p className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
              <span className="min-w-0 break-all">{r.label}</span>
            </p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {r.cells.map((cell, i) => (
                <div key={columns[i]}>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">{columns[i]}</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-gray-100">{cell}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadioSummary({ radio }: { radio: RadioSampleDTO | null }) {
  if (!radio) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Todavía no hay una lectura exitosa de la radio.</p>;
  }
  const items: [string, string][] = [
    ['Señal RX', fmtDbm(radio.signalRxDbm)],
    ['Señal TX', fmtDbm(radio.signalTxDbm)],
    ['Ruido', fmtDbm(radio.noiseFloorDbm)],
    ['SNR', radio.snrDb != null ? `${radio.snrDb} dB` : '—'],
    ['CCQ', radio.ccqPercent != null ? `${radio.ccqPercent} %` : '—'],
    ['Latencia de la radio', fmtMs(radio.radioLatencyMs)],
    ['CPU', radio.cpuLoadPercent != null ? `${radio.cpuLoadPercent} %` : '—'],
    [
      'LAN',
      radio.lanStatus
        ? `${radio.lanStatus === 'UP' ? 'Conectada' : 'Desconectada'}${radio.lanSpeedMbps ? ` · ${radio.lanSpeedMbps} Mbps` : ''}`
        : '—',
    ],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
          <dd className="mt-0.5 break-words text-gray-900 dark:text-gray-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------
// Session chart: lines over the session's fixed span, gaps where a
// sample is missing, failures as ticks along the top
// ------------------------------------------------------------------

interface ChartPoint {
  t: number;
  /** Null = no value at this instant (a lost probe, a failed read): the line breaks. */
  v: number | null;
}

interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** A reference rather than a measurement, e.g. the link's estimated capacity. */
  dashed?: boolean;
  points: ChartPoint[];
}

interface ChartMark {
  key: string;
  t: number;
  /** Stacks the ticks of different sources on the top edge, 0 being the topmost. */
  row: number;
}

/** A line broken at every missing value, so a gap reads as "nothing", not as a straight bridge. */
function seriesPath(points: ChartPoint[], x: (t: number) => number, y: (v: number) => number): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (p.v === null) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${x(p.t)},${y(p.v)} `;
    pen = true;
  }
  return d;
}

function ChartLegendKey({ color, dashed, label, value }: { color: string; dashed?: boolean; label: string; value?: React.ReactNode }) {
  if (!dashed) return <LegendKey color={color} label={label} value={value} />;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
      <span className="w-3 shrink-0 border-t-2 border-dashed" style={{ borderColor: color }} />
      {label}
      {value !== undefined && <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>}
    </span>
  );
}

function SessionChart({
  series,
  marks,
  markLabel,
  startedAt,
  durationSeconds,
  snapMs,
  floor,
  fmtValue,
  fmtTick,
  ariaLabel,
  emptyText,
  height = 170,
}: {
  series: ChartSeries[];
  marks: ChartMark[];
  /** The legend entry for the ticks along the top. */
  markLabel: string;
  startedAt: number;
  durationSeconds: number;
  /** How far from the pointer a sample may sit and still be read out — about one sampling interval. */
  snapMs: number;
  /** The least the y axis reaches, so a quiet line does not fill the whole height. */
  floor: number;
  fmtValue: (v: number | null) => string;
  fmtTick: (v: number) => string;
  ariaLabel: string;
  emptyText: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverT, setHoverT] = useState<number | null>(null);

  const margin = { top: 14, right: 8, bottom: 20, left: 56 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const peak = Math.max(floor, ...series.flatMap((s) => s.points.map((p) => p.v ?? 0)));
  const { max, ticks } = niceAxis(peak);
  // The whole session's span, fixed, so the line grows across instead of rescaling.
  const span = durationSeconds * 1000;
  const x = (t: number) => margin.left + (Math.min(Math.max(t - startedAt, 0), span) / span) * plotW;
  const y = (v: number) => margin.top + plotH - (v / max) * plotH;

  const nearest = (points: ChartPoint[], t: number) => {
    let best: ChartPoint | null = null;
    for (const p of points) {
      if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
    }
    return best && Math.abs(best.t - t) <= snapMs ? best : null;
  };

  // Pointer events, so a finger dragging across the chart reads it out too.
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverT(startedAt + ((e.clientX - rect.left) / rect.width) * span);
  };

  const hovered = hoverT !== null ? series.map((s) => ({ s, p: nearest(s.points, hoverT) })) : [];
  const hoverX = hoverT !== null ? x(hoverT) : null;
  const empty = series.every((s) => s.points.length === 0);
  // Too narrow for a floating box beside the pointer: the legend reads out the
  // hovered instant instead of the latest sample.
  const narrow = width < 480;
  const readout = narrow && hoverT !== null && hovered.some((h) => h.p);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {readout && (
          <span className="text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
            {Math.round((hoverT - startedAt) / 1000)} s
          </span>
        )}
        {series.map((s, i) => {
          const shown = readout ? hovered[i].p : s.points.at(-1);
          return (
            <ChartLegendKey
              key={s.key}
              color={s.color}
              dashed={s.dashed}
              label={s.label}
              value={shown ? fmtValue(shown.v) : readout ? '—' : undefined}
            />
          );
        })}
        {marks.length > 0 && <LegendKey color="var(--viz-critical)" label={markLabel} value={marks.length} />}
      </div>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel}>
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
                <text
                  x={margin.left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-gray-400 text-[10px] tabular-nums dark:fill-gray-500"
                >
                  {fmtTick(t)}
                </text>
              </g>
            ))}
            <text x={margin.left} y={height - 4} className="fill-gray-400 text-[10px] dark:fill-gray-500">
              0 s
            </text>
            <text x={width - margin.right} y={height - 4} textAnchor="end" className="fill-gray-400 text-[10px] dark:fill-gray-500">
              {durationSeconds} s
            </text>

            {series.map((s) => (
              <path
                key={s.key}
                d={seriesPath(s.points, x, y)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? '4 3' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {marks.map((m) => (
              <line
                key={m.key}
                x1={x(m.t)}
                x2={x(m.t)}
                y1={2 + m.row * 6}
                y2={8 + m.row * 6}
                stroke="var(--viz-critical)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ))}

            {hoverX !== null && (
              <>
                <line x1={hoverX} x2={hoverX} y1={margin.top} y2={y(0)} stroke="var(--viz-axis)" strokeWidth={1} />
                {hovered.map(
                  ({ s, p }) =>
                    p &&
                    p.v !== null && (
                      <circle
                        key={s.key}
                        cx={x(p.t)}
                        cy={y(p.v)}
                        r={s.dashed ? 3 : 4}
                        fill={s.color}
                        stroke="var(--viz-surface)"
                        strokeWidth={2}
                      />
                    )
                )}
              </>
            )}
            <rect
              x={margin.left}
              y={0}
              width={plotW}
              height={margin.top + plotH}
              fill="transparent"
              style={{ touchAction: 'pan-y' }}
              onPointerDown={onMove}
              onPointerMove={onMove}
              onPointerLeave={() => setHoverT(null)}
              onPointerCancel={() => setHoverT(null)}
            />
          </svg>
        )}
        {!narrow && hoverT !== null && hoverX !== null && hovered.some((h) => h.p) && (
          <Tooltip x={hoverX} y={margin.top + plotH / 2} containerWidth={width}>
            <p className="text-gray-500 dark:text-gray-400">{Math.round((hoverT - startedAt) / 1000)} s</p>
            {hovered.map(
              ({ s, p }) =>
                p && (
                  // A narrow card would otherwise squeeze each row onto two lines.
                  <span key={s.key} className="whitespace-nowrap">
                    <ChartLegendKey color={s.color} dashed={s.dashed} label={s.label} value={fmtValue(p.v)} />
                  </span>
                )
            )}
          </Tooltip>
        )}
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  );
}

const HOP_COLORS = { TARGET: 'var(--viz-series)', PARENT: 'var(--viz-series-2)' } as const;

/** Ping latency, one line per hop; lost probes as ticks along the top. */
function LatencyChart({
  ping,
  startedAt,
  durationSeconds,
  targetLabel,
  parentLabel,
}: {
  ping: PingSampleDTO[];
  startedAt: number;
  durationSeconds: number;
  targetLabel: string;
  parentLabel: string | null;
}) {
  const points = (hop: PingSampleDTO['hop']) =>
    ping.filter((p) => p.hop === hop).map((p) => ({ t: Date.parse(p.at), v: p.latencyMs }));
  const series: ChartSeries[] = [
    { key: 'TARGET', label: targetLabel, color: HOP_COLORS.TARGET, points: points('TARGET') },
    ...(parentLabel ? [{ key: 'PARENT', label: parentLabel, color: HOP_COLORS.PARENT, points: points('PARENT') }] : []),
  ];
  const marks = ping
    .filter((p) => p.latencyMs === null)
    .map((p) => ({ key: `${p.hop}:${p.at}`, t: Date.parse(p.at), row: p.hop === 'TARGET' ? 0 : 1 }));

  return (
    <SessionChart
      series={series}
      marks={marks}
      markLabel="Sin respuesta"
      startedAt={startedAt}
      durationSeconds={durationSeconds}
      snapMs={1_000}
      floor={10}
      fmtValue={(v) => (v === null ? 'sin respuesta' : fmtMs(v))}
      fmtTick={(v) => `${v} ms`}
      ariaLabel="Latencia del ping por destino durante el diagnóstico"
      emptyText="Esperando el primer ping..."
    />
  );
}

const TRAFFIC_COLORS = { TX: 'var(--viz-series)', RX: 'var(--viz-series-2)' } as const;

/** An axis label short enough for the margin: "20 Mbps", "500 Kbps". */
function fmtBpsTick(v: number): string {
  if (v === 0) return '0';
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)} Mbps`;
  if (v >= 1_000) return `${+(v / 1_000).toFixed(1)} Kbps`;
  return `${v} bps`;
}

/**
 * Traffic through the radio, TX and RX, against the airMAX capacity — the most
 * the link could carry at that moment — as a dashed line in the same color.
 * Failed radio reads break the lines and tick the top edge.
 */
function ThroughputChart({
  radio,
  startedAt,
  durationSeconds,
}: {
  radio: RadioSampleDTO[];
  startedAt: number;
  durationSeconds: number;
}) {
  const at = (r: RadioSampleDTO) => Date.parse(r.at);
  const kbps = (v: number | null) => (v === null ? null : v * 1000);
  const series: ChartSeries[] = [
    { key: 'TX', label: 'Subida (TX)', color: TRAFFIC_COLORS.TX, points: radio.map((r) => ({ t: at(r), v: r.ok ? r.throughputTxBps : null })) },
    { key: 'RX', label: 'Bajada (RX)', color: TRAFFIC_COLORS.RX, points: radio.map((r) => ({ t: at(r), v: r.ok ? r.throughputRxBps : null })) },
  ];
  // Only drawn when the radio reports it; an empty dashed legend would just be noise.
  if (radio.some((r) => r.capacityTxKbps !== null)) {
    series.push({
      key: 'CAP_TX',
      label: 'Capacidad TX',
      color: TRAFFIC_COLORS.TX,
      dashed: true,
      points: radio.map((r) => ({ t: at(r), v: r.ok ? kbps(r.capacityTxKbps) : null })),
    });
  }
  if (radio.some((r) => r.capacityRxKbps !== null)) {
    series.push({
      key: 'CAP_RX',
      label: 'Capacidad RX',
      color: TRAFFIC_COLORS.RX,
      dashed: true,
      points: radio.map((r) => ({ t: at(r), v: r.ok ? kbps(r.capacityRxKbps) : null })),
    });
  }
  const marks = radio.filter((r) => !r.ok).map((r) => ({ key: r.at, t: at(r), row: 0 }));

  return (
    <SessionChart
      series={series}
      marks={marks}
      markLabel="Lectura fallida"
      startedAt={startedAt}
      durationSeconds={durationSeconds}
      snapMs={2_000}
      floor={1_000_000}
      fmtValue={(v) => (v === null ? 'sin lectura' : fmtBps(v))}
      fmtTick={fmtBpsTick}
      ariaLabel="Tráfico y capacidad de la radio durante el diagnóstico"
      emptyText="Esperando la primera lectura de la radio..."
    />
  );
}
