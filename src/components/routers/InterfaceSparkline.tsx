'use client';

import React from 'react';
import { useWidth } from '@/components/dashboard/charts';
import { fmtBps } from '@/constants/wireless.constants';

const HEIGHT = 32;

/**
 * Download and upload through one interface over the page's last couple of minutes, on one
 * shared scale. A sparkline, not a chart: the exact numbers sit beside it, so
 * it only has to show the shape and which way it is moving.
 */
type Sample = { downBps: number; upBps: number };

export function InterfaceSparkline({ samples, label }: { samples: Sample[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const max = Math.max(1, ...samples.map((s) => Math.max(s.downBps, s.upBps)));
  const pad = 3;
  const x = (i: number) => pad + (samples.length > 1 ? (i / (samples.length - 1)) * (width - 2 * pad) : 0);
  const y = (v: number) => pad + (HEIGHT - 2 * pad) * (1 - v / max);
  const path = (pick: (s: Sample) => number) =>
    samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(pick(s))}`).join(' ');

  return (
    <div ref={ref} className="h-8 w-full min-w-[120px]">
      {width > 0 && samples.length > 1 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`${label}: máximo ${fmtBps(max)}`}>
          <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke="var(--viz-axis)" strokeWidth={1} />
          <path d={path((s) => s.downBps)} fill="none" stroke="var(--viz-series)" strokeWidth={1.5} strokeLinejoin="round" />
          <path d={path((s) => s.upBps)} fill="none" stroke="var(--viz-series-2)" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
