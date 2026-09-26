'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Hand-rolled SVG charts for the dashboard. No chart library: the shapes
 * needed are few, and owning them keeps the marks on the app's own tokens
 * (`--viz-*` in globals.css) in both themes.
 *
 * Shared conventions: thin marks, 4px rounded data ends square at the
 * baseline, a 2px surface gap between touching fills, hairline solid grid,
 * text in text colors (never the series color), and every value reachable
 * without hovering — the tooltip only adds precision.
 */

/** Tracks an element's rendered width, so SVG text is laid out at 1:1 scale. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** A round step for about `count` gridlines: 1, 2, 5 × 10^n. */
function niceStep(value: number, count: number): number {
  const raw = Math.max(value, 1) / count;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const step of [1, 2, 5, 10]) {
    if (raw <= step * exp) return step * exp;
  }
  return 10 * exp;
}

/** Axis ceiling and ticks: the first round step at or above the data. */
function niceAxis(value: number, count = 3, integer = false): { max: number; ticks: number[] } {
  const step = integer ? Math.max(1, Math.ceil(niceStep(value, count))) : niceStep(value, count);
  const max = Math.max(step, Math.ceil(value / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= max + step / 2; t += step) ticks.push(t);
  return { max, ticks };
}

/** A rect with only its data end (top) rounded — square where it meets the baseline. */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, h, w / 2);
  return [
    `M${x},${y + h}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + w - radius}`,
    `Q${x + w},${y} ${x + w},${y + radius}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}

export function LegendKey({ color, label, value }: { color: string; label: string; value?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
      {label}
      {value !== undefined && <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>}
    </span>
  );
}

// ------------------------------------------------------------------
// Ring (part-to-whole, ≤ 5 segments)
// ------------------------------------------------------------------

export interface RingSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  href?: string;
}

export function Ring({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: RingSegment[];
  centerValue: string;
  centerLabel: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const size = 148;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  // The 2px surface gap, expressed as arc length (only when there is more than one segment).
  const gap = visible.length > 1 ? 2 : 0;

  const lengths = visible.map((s) => (s.value / total) * circumference);
  const arcs = visible.map((s, i) => ({
    ...s,
    dash: Math.max(0, lengths[i] - gap),
    offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
  }));

  const active = hovered ? segments.find((s) => s.key === hovered) : null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--viz-grid)" strokeWidth={stroke} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={hovered === a.key ? stroke + 4 : stroke}
                strokeDasharray={`${a.dash} ${circumference - a.dash}`}
                strokeDashoffset={-a.offset}
                className="cursor-pointer transition-[stroke-width] duration-150"
                onMouseEnter={() => setHovered(a.key)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {active ? active.value : centerValue}
          </span>
          <span className="max-w-[90px] text-xs leading-tight text-gray-500 dark:text-gray-400">
            {active ? active.label : centerLabel}
          </span>
        </div>
      </div>

      <ul className="w-full space-y-1">
        {segments.map((s) => {
          const content = (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="flex-1 text-sm text-gray-600 dark:text-gray-300">{s.label}</span>
              <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{s.value}</span>
              <span className="w-10 text-right text-xs tabular-nums text-gray-400 dark:text-gray-500">
                {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
              </span>
            </>
          );
          const className = `flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
            hovered === s.key ? 'bg-gray-100 dark:bg-gray-700/60' : ''
          }`;
          return (
            <li key={s.key} onMouseEnter={() => setHovered(s.key)} onMouseLeave={() => setHovered(null)}>
              {s.href ? (
                <Link href={s.href} className={`${className} hover:bg-gray-100 dark:hover:bg-gray-700/60`}>
                  {content}
                </Link>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------
// Stacked columns over days
// ------------------------------------------------------------------

export interface ColumnSeries {
  key: string;
  label: string;
  color: string;
}

export interface ColumnDatum {
  key: string;
  /** Axis label; the chart thins these out to fit its width. */
  tick: string;
  /** Tooltip heading. */
  title: string;
  values: Record<string, number>;
}

export function StackedColumns({
  data,
  series,
  height = 180,
}: {
  data: ColumnDatum[];
  /** Bottom to top. */
  series: ColumnSeries[];
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);

  const margin = { top: 12, right: 16, bottom: 22, left: 28 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const { max, ticks } = niceAxis(Math.max(...totals, 0), 3, true);
  const band = data.length > 0 ? plotW / data.length : 0;
  const barW = Math.min(24, band * 0.6);
  // Label every nth column, counted back from the latest so it is always labeled.
  const labelEvery = band > 0 ? Math.max(1, Math.ceil(48 / band)) : 1;
  const y = (v: number) => margin.top + plotH - (v / max) * plotH;

  const hoveredDatum = hovered !== null ? data[hovered] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Alertas por día">
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
                {t}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const x = margin.left + i * band + (band - barW) / 2;
            let base = 0;
            const segs = series
              .map((s) => ({ s, v: d.values[s.key] ?? 0 }))
              .filter(({ v }) => v > 0);
            return (
              <g key={d.key} opacity={hovered === null || hovered === i ? 1 : 0.45}>
                {segs.map(({ s, v }, j) => {
                  const isTop = j === segs.length - 1;
                  const top = y(base + v);
                  // The 2px surface gap sits under every segment but the first.
                  const bottom = y(base) - (j > 0 ? 2 : 0);
                  base += v;
                  const h = Math.max(0, bottom - top);
                  return isTop ? (
                    <path key={s.key} d={topRoundedRect(x, top, barW, h, 4)} fill={s.color} />
                  ) : (
                    <rect key={s.key} x={x} y={top} width={barW} height={h} fill={s.color} />
                  );
                })}
                {d.tick && (data.length - 1 - i) % labelEvery === 0 && (
                  <text
                    x={x + barW / 2}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-gray-400 text-[10px] dark:fill-gray-500"
                  >
                    {d.tick}
                  </text>
                )}
                {/* Hit target: the whole band, not just the bar. */}
                <rect
                  x={margin.left + i * band}
                  y={margin.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            );
          })}
        </svg>
      )}

      {hoveredDatum && hovered !== null && (
        <Tooltip
          x={margin.left + hovered * band + band / 2}
          y={y(totals[hovered]) - 8}
          containerWidth={width}
        >
          <p className="mb-1 font-medium text-gray-900 dark:text-gray-100">{hoveredDatum.title}</p>
          {[...series].reverse().map((s) => (
            <LegendKey key={s.key} color={s.color} label={s.label} value={hoveredDatum.values[s.key] ?? 0} />
          ))}
        </Tooltip>
      )}
    </div>
  );
}

function Tooltip({
  x,
  y,
  containerWidth,
  children,
}: {
  x: number;
  y: number;
  containerWidth: number;
  children: React.ReactNode;
}) {
  // Flip to the left half past the midpoint so the box never leaves the card.
  const alignRight = x > containerWidth / 2;
  return (
    <div
      className="pointer-events-none absolute z-10 flex min-w-[120px] flex-col gap-0.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-900"
      style={{
        left: alignRight ? undefined : x + 10,
        right: alignRight ? containerWidth - x + 10 : undefined,
        top: Math.max(0, y - 20),
      }}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------
// Area over time (single series)
// ------------------------------------------------------------------

export function AreaTrend({
  points,
  format,
  height = 150,
  label,
}: {
  points: { t: number; v: number }[];
  format: (v: number) => string;
  height?: number;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(null);

  const margin = { top: 10, right: 8, bottom: 20, left: 64 };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const { max, ticks } = niceAxis(Math.max(...points.map((p) => p.v), 0));
  const t0 = points[0]?.t ?? 0;
  const t1 = points[points.length - 1]?.t ?? 1;
  const span = Math.max(1, t1 - t0);
  const x = (t: number) => margin.left + ((t - t0) / span) * plotW;
  const y = (v: number) => margin.top + plotH - (v / max) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t)},${y(p.v)}`).join(' ');
  const area = points.length
    ? `${line} L${x(t1)},${y(0)} L${x(t0)},${y(0)} Z`
    : '';
  const last = points[points.length - 1];
  const fmtTime = (t: number) =>
    new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - rect.left) / rect.width) * span;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].t - t) < Math.abs(points[nearest].t - t)) nearest = i;
    }
    setHovered(nearest);
  };

  const hp = hovered !== null ? points[hovered] : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
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
                {format(t)}
              </text>
            </g>
          ))}
          {points.length > 1 && (
            <>
              <path d={area} fill="var(--viz-series)" opacity={0.1} />
              <path d={line} fill="none" stroke="var(--viz-series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <text x={margin.left} y={height - 4} className="fill-gray-400 text-[10px] dark:fill-gray-500">
                {fmtTime(t0)}
              </text>
              <text x={width - margin.right} y={height - 4} textAnchor="end" className="fill-gray-400 text-[10px] dark:fill-gray-500">
                {fmtTime(t1)}
              </text>
            </>
          )}
          {last && (
            <circle cx={x(last.t)} cy={y(last.v)} r={4} fill="var(--viz-series)" stroke="var(--viz-surface)" strokeWidth={2} />
          )}
          {hp && (
            <>
              <line x1={x(hp.t)} x2={x(hp.t)} y1={margin.top} y2={y(0)} stroke="var(--viz-axis)" strokeWidth={1} />
              <circle cx={x(hp.t)} cy={y(hp.v)} r={4} fill="var(--viz-series)" stroke="var(--viz-surface)" strokeWidth={2} />
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
      {hp && (
        <Tooltip x={x(hp.t)} y={y(hp.v)} containerWidth={width}>
          <p className="text-gray-500 dark:text-gray-400">{fmtTime(hp.t)}</p>
          <p className="font-medium text-gray-900 dark:text-gray-100">{format(hp.v)}</p>
        </Tooltip>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Horizontal bar list (ranked, single series)
// ------------------------------------------------------------------

export interface BarRow {
  key: string;
  label: string;
  href?: string;
  /** Null draws an empty track — "no reading" rather than zero. */
  value: number | null;
  display: string;
  /** Defaults to the series color; pass a status color only when the bar means state. */
  color?: string;
}

export function BarList({ rows, max }: { rows: BarRow[]; max?: number }) {
  const top = max ?? Math.max(...rows.map((r) => r.value ?? 0), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = r.value === null ? 0 : Math.max(1.5, (r.value / top) * 100);
        const label = r.href ? (
          <Link href={r.href} className="truncate text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
            {r.label}
          </Link>
        ) : (
          <span className="truncate text-gray-700 dark:text-gray-300">{r.label}</span>
        );
        return (
          <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={`${r.label}: ${r.display}`}>
            {label}
            <div className="h-2.5 rounded-r bg-transparent">
              {r.value !== null && (
                <div
                  className="h-full rounded-r-[4px] transition-[width] duration-500"
                  style={{ width: `${pct}%`, background: r.color ?? 'var(--viz-series)' }}
                />
              )}
            </div>
            <span className="text-right text-xs font-medium tabular-nums text-gray-900 dark:text-gray-100">{r.display}</span>
          </li>
        );
      })}
    </ul>
  );
}
