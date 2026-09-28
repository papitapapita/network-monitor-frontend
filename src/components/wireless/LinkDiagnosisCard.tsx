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

  const hasParent = !!d.diagnosis?.parent;
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
                      <li key={`${f.hop}:${f.code}`} className="flex items-start gap-2 text-sm">
                        <Badge variant={f.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                          {f.severity === 'CRITICAL' ? 'Crítico' : 'Advertencia'}
                        </Badge>
                        <span className="text-gray-500 dark:text-gray-400">{HOP_LABELS[f.hop]}</span>
                        <span className="text-gray-900 dark:text-gray-100">{f.message}</span>
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
                  <PingTable
                    rows={[
                      {
                        key: 'target',
                        label: `${d.diagnosis.target.name ?? 'Equipo'} (${d.diagnosis.target.ipAddress})`,
                        color: 'var(--viz-series)',
                        stats: d.report.target,
                      },
                      ...(hasParent && d.report.parent
                        ? [
                            {
                              key: 'parent',
                              label: `${d.diagnosis.parent!.name ?? 'AP padre'} (${d.diagnosis.parent!.ipAddress})`,
                              color: 'var(--viz-series-2)',
                              stats: d.report.parent,
                            },
                          ]
                        : []),
                    ]}
                  />
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
                  <RadioSummary radio={lastRadio} throughput={d.report.radio.throughput} />
                </div>
              </>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
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

interface PingRow {
  key: string;
  label: string;
  color: string;
  stats: PingStatisticsDTO;
}

/** The chart's table view — every number the lines stand for, per hop. */
function PingTable({ rows }: { rows: PingRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
            <th className="py-1 pr-3 font-medium">Destino</th>
            <th className="py-1 pr-3 font-medium text-right">Enviados</th>
            <th className="py-1 pr-3 font-medium text-right">Pérdida</th>
            <th className="py-1 pr-3 font-medium text-right">Mín / Prom / Máx</th>
            <th className="py-1 pr-3 font-medium text-right">Jitter</th>
            <th className="py-1 font-medium text-right">Picos ≥150 ms</th>
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
              <td className="py-1.5 pr-3 text-right">{r.stats.sent}</td>
              <td className="py-1.5 pr-3 text-right">{r.stats.lossPercent.toFixed(1)} %</td>
              <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                {fmtMs(r.stats.minMs)} / {fmtMs(r.stats.avgMs)} / {fmtMs(r.stats.maxMs)}
              </td>
              <td className="py-1.5 pr-3 text-right">{fmtMs(r.stats.jitterMs)}</td>
              <td className="py-1.5 text-right">{r.stats.spikeCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RadioSummary({
  radio,
  throughput,
}: {
  radio: RadioSampleDTO | null;
  throughput: { avgTxBps: number | null; avgRxBps: number | null; peakTxBps: number | null; peakRxBps: number | null; linkCapacityKbps: number | null };
}) {
  const items: [string, string][] = [
    ['Señal RX', fmtDbm(radio?.signalRxDbm ?? null)],
    ['Señal TX', fmtDbm(radio?.signalTxDbm ?? null)],
    ['Ruido', fmtDbm(radio?.noiseFloorDbm ?? null)],
    ['SNR', radio?.snrDb != null ? `${radio.snrDb} dB` : '—'],
    ['CCQ', radio?.ccqPercent != null ? `${radio.ccqPercent} %` : '—'],
    ['Latencia de la radio', fmtMs(radio?.radioLatencyMs ?? null)],
    ['CPU', radio?.cpuLoadPercent != null ? `${radio.cpuLoadPercent} %` : '—'],
    [
      'LAN',
      radio?.lanStatus
        ? `${radio.lanStatus === 'UP' ? 'Conectada' : 'Desconectada'}${radio.lanSpeedMbps ? ` · ${radio.lanSpeedMbps} Mbps` : ''}`
        : '—',
    ],
    ['Tráfico TX / RX', `${fmtBps(radio?.throughputTxBps)} / ${fmtBps(radio?.throughputRxBps)}`],
    ['Promedio TX / RX', `${fmtBps(throughput.avgTxBps)} / ${fmtBps(throughput.avgRxBps)}`],
    ['Pico TX / RX', `${fmtBps(throughput.peakTxBps)} / ${fmtBps(throughput.peakRxBps)}`],
    ['Capacidad airMAX TX / RX', `${fmtKbps(radio?.capacityTxKbps)} / ${fmtKbps(radio?.capacityRxKbps)}`],
  ];
  if (throughput.linkCapacityKbps !== null) items.push(['Capacidad del enlace', fmtKbps(throughput.linkCapacityKbps)]);

  if (!radio) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Todavía no hay una lectura exitosa de la radio.</p>;
  }
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
          <dd className="mt-0.5 text-gray-900 dark:text-gray-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------
// Latency chart: one line per hop, lost probes as ticks along the top
// ------------------------------------------------------------------

const HOP_COLORS = { TARGET: 'var(--viz-series)', PARENT: 'var(--viz-series-2)' } as const;

/** A line broken at every lost probe, so a gap reads as "no reply", not as a straight bridge. */
function hopPath(samples: PingSampleDTO[], x: (t: number) => number, y: (v: number) => number): string {
  let d = '';
  let pen = false;
  for (const s of samples) {
    if (s.latencyMs === null) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${x(Date.parse(s.at))},${y(s.latencyMs)} `;
    pen = true;
  }
  return d;
}

function LatencyChart({
  ping,
  startedAt,
  durationSeconds,
  targetLabel,
  parentLabel,
  height = 170,
}: {
  ping: PingSampleDTO[];
  startedAt: number;
  durationSeconds: number;
  targetLabel: string;
  parentLabel: string | null;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverT, setHoverT] = useState<number | null>(null);

  const target = ping.filter((p) => p.hop === 'TARGET');
  const parent = ping.filter((p) => p.hop === 'PARENT');
  const lost = ping.filter((p) => p.latencyMs === null);

  const margin = { top: 14, right: 8, bottom: 20, left: 52 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const { max, ticks } = niceAxis(Math.max(10, ...ping.map((p) => p.latencyMs ?? 0)));
  // The whole session's span, fixed, so the line grows across instead of rescaling.
  const span = durationSeconds * 1000;
  const x = (t: number) => margin.left + (Math.min(Math.max(t - startedAt, 0), span) / span) * plotW;
  const y = (v: number) => margin.top + plotH - (v / max) * plotH;

  const nearest = (samples: PingSampleDTO[], t: number) => {
    let best: PingSampleDTO | null = null;
    for (const s of samples) {
      if (!best || Math.abs(Date.parse(s.at) - t) < Math.abs(Date.parse(best.at) - t)) best = s;
    }
    return best && Math.abs(Date.parse(best.at) - t) <= 1_000 ? best : null;
  };

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverT(startedAt + ((e.clientX - rect.left) / rect.width) * span);
  };

  const hTarget = hoverT !== null ? nearest(target, hoverT) : null;
  const hParent = hoverT !== null && parentLabel ? nearest(parent, hoverT) : null;
  const hoverX = hoverT !== null ? x(hoverT) : null;
  const fmtOffset = (ms: number) => `${Math.round(ms / 1000)} s`;

  const series = [
    { key: 'TARGET' as const, label: targetLabel, samples: target },
    ...(parentLabel ? [{ key: 'PARENT' as const, label: parentLabel, samples: parent }] : []),
  ];

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => {
          const last = s.samples.at(-1);
          return (
            <LegendKey
              key={s.key}
              color={HOP_COLORS[s.key]}
              label={s.label}
              value={last ? (last.latencyMs === null ? 'sin respuesta' : fmtMs(last.latencyMs)) : undefined}
            />
          );
        })}
        {lost.length > 0 && <LegendKey color="var(--viz-critical)" label="Sin respuesta" value={lost.length} />}
      </div>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label="Latencia del ping por destino durante el diagnóstico">
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
                  {t} ms
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
                d={hopPath(s.samples, x, y)}
                fill="none"
                stroke={HOP_COLORS[s.key]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {/* Lost probes: a tick on the top edge, per hop row, where the line breaks. */}
            {lost.map((p) => (
              <line
                key={`${p.hop}:${p.at}`}
                x1={x(Date.parse(p.at))}
                x2={x(Date.parse(p.at))}
                y1={p.hop === 'TARGET' ? 2 : 8}
                y2={p.hop === 'TARGET' ? 8 : 14}
                stroke="var(--viz-critical)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ))}

            {hoverX !== null && (
              <>
                <line x1={hoverX} x2={hoverX} y1={margin.top} y2={y(0)} stroke="var(--viz-axis)" strokeWidth={1} />
                {[hTarget, hParent].map(
                  (s) =>
                    s &&
                    s.latencyMs !== null && (
                      <circle
                        key={s.hop}
                        cx={x(Date.parse(s.at))}
                        cy={y(s.latencyMs)}
                        r={4}
                        fill={HOP_COLORS[s.hop]}
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
              onMouseMove={onMove}
              onMouseLeave={() => setHoverT(null)}
            />
          </svg>
        )}
        {hoverT !== null && hoverX !== null && (hTarget || hParent) && (
          <Tooltip x={hoverX} y={margin.top + plotH / 2} containerWidth={width}>
            <p className="text-gray-500 dark:text-gray-400">{fmtOffset(hoverT - startedAt)}</p>
            {series.map((s) => {
              const sample = s.key === 'TARGET' ? hTarget : hParent;
              if (!sample) return null;
              return (
                <LegendKey
                  key={s.key}
                  color={HOP_COLORS[s.key]}
                  label={s.label}
                  value={sample.latencyMs === null ? 'sin respuesta' : fmtMs(sample.latencyMs)}
                />
              );
            })}
          </Tooltip>
        )}
        {ping.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            Esperando el primer ping...
          </p>
        )}
      </div>
    </div>
  );
}
