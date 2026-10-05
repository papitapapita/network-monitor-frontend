'use client';

import React, { useEffect, useState } from 'react';
import { Input, Select, FieldLabel } from '@/components/ui';
import { INTERVAL_UNITS, intervalUnitFor } from '@/constants/polling.constants';

interface Props {
  label: string;
  /** The interval in seconds, as the form holds it — '' defers to the backend default. */
  value: string;
  onChange: (seconds: string) => void;
  error?: string;
  info?: React.ReactNode;
}

const UNIT_OPTIONS = INTERVAL_UNITS.map((u) => ({ value: u.value, label: u.label }));

function toSeconds(amount: string, unit: number): string {
  const trimmed = amount.trim();
  if (!trimmed) return '';
  const n = Number(trimmed);
  // Not a number: pass it through so the form's validator reports it.
  return Number.isFinite(n) ? String(Math.round(n * unit * 1000) / 1000) : trimmed;
}

function fromSeconds(seconds: string): { amount: string; unit: number } {
  const n = Number(seconds);
  if (!seconds.trim() || !Number.isFinite(n)) return { amount: seconds, unit: 1 };
  const unit = intervalUnitFor(n);
  return { amount: String(n / unit), unit };
}

/**
 * An interval typed as an amount plus a unit — "6 horas" instead of 21600 —
 * while the form keeps seconds, the unit the backend and validators speak.
 */
export function IntervalInput({ label, value, onChange, error, info }: Props) {
  const [amount, setAmount] = useState(() => fromSeconds(value).amount);
  const [unit, setUnit] = useState(() => fromSeconds(value).unit);
  const id = label.toLowerCase().replace(/\s+/g, '-');

  // The form can replace the value from outside (load, cancel); re-derive the
  // display then, but not on our own echoes, or typing "1." would snap to "1".
  useEffect(() => {
    if (value === toSeconds(amount, unit)) return;
    const next = fromSeconds(value);
    setAmount(next.amount);
    setUnit(next.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="w-full">
      <FieldLabel htmlFor={id} info={info}>
        {label}
      </FieldLabel>
      <div className="flex gap-2">
        <div className="flex-1 min-w-0">
          <Input
            id={id}
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              onChange(toSeconds(e.target.value, unit));
            }}
            fullWidth
          />
        </div>
        <div className="w-32 shrink-0">
          <Select
            id={`${id}-unit`}
            options={UNIT_OPTIONS}
            value={String(unit)}
            onChange={(e) => {
              const nextUnit = Number(e.target.value);
              setUnit(nextUnit);
              onChange(toSeconds(amount, nextUnit));
            }}
            fullWidth
          />
        </div>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
