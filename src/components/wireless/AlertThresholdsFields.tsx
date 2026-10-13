'use client';

import React from 'react';
import { Checkbox, IconButton, Input, SectionTitle } from '@/components/ui';
import {
  CHANNEL_WIDTHS,
  SEVERITY_GROUPS,
  SINGLE_GROUPS,
  WIDTH_GROUPS,
  SeverityGroupKey,
  SingleGroupKey,
  ThresholdErrors,
  ThresholdGroupKey,
  ThresholdsDraft,
  WidthGroupKey,
  WidthRow,
} from '@/constants/alert-thresholds.constants';

function RemoveIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/** A device's view: each group follows the install until it is overridden. */
export interface OverrideControls {
  /** The install's set, shown in a group the device does not override. */
  inherited: ThresholdsDraft;
  overridden: Partial<Record<ThresholdGroupKey, boolean>>;
  onToggle: (key: ThresholdGroupKey, on: boolean) => void;
}

interface Props {
  draft: ThresholdsDraft;
  onChange: (draft: ThresholdsDraft) => void;
  errors: ThresholdErrors;
  disabled?: boolean;
  override?: OverrideControls;
}

/**
 * The editor for one set of wireless alert thresholds (WLS-200), shared by the
 * install's settings card and a device's overrides (WLS-201).
 */
export function AlertThresholdsFields({ draft, onChange, errors, disabled = false, override }: Props) {
  const isOn = (key: ThresholdGroupKey) => !override || !!override.overridden[key];
  const shown = (key: ThresholdGroupKey) => (isOn(key) ? draft : override!.inherited);
  const locked = (key: ThresholdGroupKey) => disabled || !isOn(key);

  const toggle = (key: ThresholdGroupKey) =>
    override && (
      <Checkbox
        id={`override-${key}`}
        checked={isOn(key)}
        onChange={(e) => override.onToggle(key, e.target.checked)}
        disabled={disabled}
        label="Personalizar"
      />
    );

  const severityRow = (key: SeverityGroupKey) => {
    const meta = SEVERITY_GROUPS[key];
    const value = shown(key)[key];
    const set = (patch: Partial<typeof value>) => onChange({ ...draft, [key]: { ...draft[key], ...patch } });
    return (
      <div key={key} role="group" aria-label={meta.label} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle as="h3" className="text-sm font-medium text-gray-900 dark:text-gray-100" info={meta.info}>
            {meta.label}
          </SectionTitle>
          {toggle(key)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Advertencia (${meta.unit})`}
            type="number"
            min={meta.min}
            max={meta.max}
            value={value.warning}
            onChange={(e) => set({ warning: e.target.value })}
            error={isOn(key) ? errors[`${key}.warning`] : undefined}
            disabled={locked(key)}
            fullWidth
          />
          <Input
            label={`Crítica (${meta.unit})`}
            type="number"
            min={meta.min}
            max={meta.max}
            value={value.critical}
            onChange={(e) => set({ critical: e.target.value })}
            error={isOn(key) ? errors[`${key}.critical`] : undefined}
            disabled={locked(key)}
            fullWidth
          />
        </div>
      </div>
    );
  };

  const singleField = (key: SingleGroupKey) => {
    const meta = SINGLE_GROUPS[key];
    return (
      <div key={key} className="space-y-2">
        {override && <div className="flex justify-end">{toggle(key)}</div>}
        <Input
          label={`${meta.label} (${meta.unit})`}
          type="number"
          min={meta.min}
          max={meta.max}
          value={shown(key)[key]}
          onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
          error={isOn(key) ? errors[key] : undefined}
          info={meta.info}
          disabled={locked(key)}
          fullWidth
        />
      </div>
    );
  };

  const widthTable = (key: WidthGroupKey) => {
    const meta = WIDTH_GROUPS[key];
    const rows = shown(key)[key];
    // A device may add widths but cannot drop one the install checks (WLS-201).
    const fixed = new Set(override ? override.inherited[key].map((r) => r.width) : []);
    const unused = CHANNEL_WIDTHS.filter((w) => !rows.some((r) => r.width === w));
    const setRows = (next: WidthRow[]) =>
      onChange({ ...draft, [key]: [...next].sort((a, b) => Number(a.width) - Number(b.width)) });
    return (
      <div key={key} role="group" aria-label={meta.label} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle as="h3" className="text-sm font-medium text-gray-900 dark:text-gray-100" info={meta.info}>
            {meta.label} ({meta.unit})
          </SectionTitle>
          {toggle(key)}
        </div>
        {rows.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No se revisa en ningún ancho de canal.</p>
        )}
        {rows.map((row, i) => (
          <div key={row.width} className="flex items-start gap-2">
            <span className="w-20 shrink-0 pt-2 text-sm text-gray-700 dark:text-gray-300">{row.width} MHz</span>
            <div className="flex-1">
              <Input
                aria-label={`${meta.label} a ${row.width} MHz`}
                type="number"
                min={meta.min}
                max={meta.max}
                step={meta.decimals ? '0.1' : '1'}
                value={row.value}
                onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                error={isOn(key) ? errors[`${key}.${row.width}`] : undefined}
                disabled={locked(key)}
                fullWidth
              />
            </div>
            {!locked(key) && !fixed.has(row.width) && (
              <IconButton
                icon={<RemoveIcon />}
                label={`Dejar de revisar ${row.width} MHz`}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
              />
            )}
          </div>
        ))}
        {!locked(key) && unused.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Revisar también:</span>
            {unused.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setRows([...rows, { width: w, value: '' }])}
                className="rounded-full border border-gray-300 dark:border-gray-600 px-2.5 py-0.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                + {w} MHz
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Enlace</p>
        {(Object.keys(SEVERITY_GROUPS) as SeverityGroupKey[]).map(severityRow)}
      </section>
      <section className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Equipo y AP</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(SINGLE_GROUPS) as SingleGroupKey[]).map(singleField)}
        </div>
      </section>
      <section className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Por ancho de canal</p>
        {(Object.keys(WIDTH_GROUPS) as WidthGroupKey[]).map(widthTable)}
      </section>
    </div>
  );
}
