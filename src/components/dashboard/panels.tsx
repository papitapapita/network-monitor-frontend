'use client';

import React from 'react';
import Link from 'next/link';
import { Badge, SectionTitle } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { CheckIcon } from '@/components/ui/icons';
import { fmtDuration, type Problem } from './dashboardModel';

type Tone = 'critical' | 'warning' | 'good' | 'neutral';

const TONE_ACCENT: Record<Tone, string> = {
  critical: 'bg-[var(--viz-critical)]',
  warning: 'bg-[var(--viz-warning)]',
  good: 'bg-[var(--viz-good)]',
  neutral: 'bg-gray-200 dark:bg-gray-600',
};

/**
 * A headline number. The accent bar carries the state, but the sub line
 * always says it in words too — color never stands alone.
 */
export function KpiTile({
  label,
  value,
  sub,
  tone,
  href,
  loading,
  adornment,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone: Tone;
  href: string;
  loading?: boolean;
  adornment?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-4 pl-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${TONE_ACCENT[tone]}`} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
        {adornment}
      </div>
      {loading ? (
        <span className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
      ) : (
        <span className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">{value}</span>
      )}
      {sub && !loading && <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</span>}
    </Link>
  );
}

/** A dashboard card: title row, optional link out, and its own loading / error state. */
export function Panel({
  title,
  info,
  action,
  aside,
  loading,
  error,
  className = '',
  children,
}: {
  title: string;
  info?: React.ReactNode;
  action?: { href: string; label: string };
  aside?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle as="h2" info={info} className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </SectionTitle>
        <div className="flex shrink-0 items-center gap-3">
          {aside}
          {action && (
            <Link href={action.href} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              {action.label} →
            </Link>
          )}
        </div>
      </header>
      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-gray-100 dark:bg-gray-700" style={{ width: `${90 - i * 18}%` }} />
          ))}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

const SEVERITY_BADGE: Record<Problem['severity'], { variant: BadgeVariant; label: string }> = {
  CRITICAL: { variant: 'danger', label: 'Crítico' },
  WARNING: { variant: 'warning', label: 'Advertencia' },
};

export function ProblemList({ problems, now }: { problems: Problem[]; now: number }) {
  if (problems.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
          <CheckIcon className="h-5 w-5" />
        </span>
        <p className="font-medium text-gray-900 dark:text-gray-100">Todo en orden</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ningún dispositivo caído ni alertas abiertas.</p>
      </div>
    );
  }

  return (
    <ul className="-mx-2 max-h-[22rem] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700/70">
      {problems.map((p) => {
        const badge = SEVERITY_BADGE[p.severity];
        const age = p.since ? fmtDuration((now - new Date(p.since).getTime()) / 1000) : null;
        return (
          <li key={p.key}>
            <Link
              href={`/devices/${p.deviceId}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <Badge variant={badge.variant} className="shrink-0">
                {p.kind === 'down' ? 'Caído' : badge.label}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {p.deviceName}
                  {p.locationName && (
                    <span className="font-normal text-gray-500 dark:text-gray-400"> · {p.locationName}</span>
                  )}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400" title={p.title}>
                  {p.title}
                  {p.detail && <span className="text-gray-400 dark:text-gray-500"> · {p.detail}</span>}
                </p>
              </div>
              <span className="shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {age ?? '—'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** A small labeled figure inside a panel. */
export function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

/** Proportional strip of a whole, for a compact breakdown. */
export function StackedStrip({ parts }: { parts: { key: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total === 0) return <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700" />;
  return (
    <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <div key={p.key} style={{ flexGrow: p.value, background: p.color }} />
        ))}
    </div>
  );
}
