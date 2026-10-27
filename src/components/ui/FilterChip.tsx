'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Input } from './Input';
import { ChevronDownIcon, CheckIcon, XIcon } from './icons';

const MENU_MIN_WIDTH = 200;

interface ChipFrameProps {
  /** The filter's name, e.g. "Estado" — shown alone while unset, as "Estado: Activo" once set. */
  label: string;
  /** What the filter is set to, or null while unset. */
  valueLabel: string | null;
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onTriggerKeyDown?: (e: React.KeyboardEvent) => void;
  panelRole?: 'listbox' | 'dialog';
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  /** The popover's contents. */
  children: React.ReactNode;
}

/**
 * The chip every toolbar filter is built on: a button that names the filter
 * and opens a popover. Once set it turns brand-tinted, shows the value and
 * grows an × to clear it, so the active filters read at a glance without
 * opening anything.
 */
function ChipFrame({
  label,
  valueLabel,
  onClear,
  isOpen,
  onToggle,
  onClose,
  onTriggerKeyDown,
  panelRole = 'dialog',
  triggerRef,
  children,
}: ChipFrameProps) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = valueLabel !== null;

  // Positioned in viewport space and clamped, like ColumnPicker, so a chip near
  // the right edge doesn't push its menu off-screen.
  const updatePosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const width = Math.max(rect.width, MENU_MIN_WIDTH);
    const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
    setMenuPos({ top: rect.bottom + 4, left, width });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !(target as Element).closest?.('[data-filter-chip-menu]')) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition, onClose]);

  const menu =
    isOpen && menuPos
      ? ReactDOM.createPortal(
          <div
            data-filter-chip-menu
            role={panelRole}
            aria-label={label}
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, minWidth: menuPos.width, zIndex: 9999 }}
            className="max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1.5"
          >
            {children}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`inline-flex h-10 items-stretch rounded-md border text-sm shadow-sm transition-colors ${
        active
          ? 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-700/40'
      }`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup={panelRole}
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) updatePosition();
          onToggle();
        }}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) updatePosition();
          onTriggerKeyDown?.(e);
        }}
        className={`flex items-center gap-1.5 rounded-md pl-3 ${active ? 'pr-1.5' : 'pr-2.5'} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
      >
        {active ? (
          <span className="whitespace-nowrap">
            <span className="text-brand-600 dark:text-brand-300">{label}:</span>{' '}
            <span className="font-medium">{valueLabel}</span>
          </span>
        ) : (
          <span className="whitespace-nowrap">{label}</span>
        )}
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${
            active ? 'text-brand-500 dark:text-brand-400' : 'text-gray-400'
          }`}
        />
      </button>
      {active && (
        <button
          type="button"
          aria-label={`Quitar filtro ${label}`}
          onClick={onClear}
          className="flex items-center rounded-r-md pl-1 pr-2.5 text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <XIcon />
        </button>
      )}
      {menu}
    </div>
  );
}

interface FilterChipOption {
  value: string;
  label: string;
}

interface FilterChipProps {
  label: string;
  value: string;
  /** An option with value `''` is the "all" entry; it's listed first and means unset. */
  options: FilterChipOption[];
  onChange: (value: string) => void;
}

/** A toolbar filter that picks one value from a list. */
export function FilterChip({ label, value, options, onChange }: FilterChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = value ? options.find((o) => o.value === value) : undefined;

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const pick = (opt: FilterChipOption) => {
    onChange(opt.value);
    close();
    buttonRef.current?.focus();
  };

  const open = () => {
    setIsOpen(true);
    setHighlightedIndex(Math.max(options.findIndex((o) => o.value === value), 0));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0) pick(options[highlightedIndex]);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <ChipFrame
      label={label}
      valueLabel={selected?.label ?? null}
      onClear={() => onChange('')}
      isOpen={isOpen}
      onToggle={() => (isOpen ? close() : open())}
      onClose={close}
      onTriggerKeyDown={handleKeyDown}
      panelRole="listbox"
      triggerRef={buttonRef}
    >
      {options.map((opt, i) => {
        const isSelected = opt.value === value;
        return (
          <div
            key={opt.value}
            role="option"
            aria-selected={isSelected}
            onMouseEnter={() => setHighlightedIndex(i)}
            onMouseDown={(e) => { e.preventDefault(); pick(opt); }}
            className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded text-sm cursor-pointer whitespace-nowrap ${
              i === highlightedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
            } ${
              isSelected ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-gray-700 dark:text-gray-200'
            }`}
          >
            {opt.label}
            {isSelected && <CheckIcon className="h-3.5 w-3.5" />}
          </div>
        );
      })}
    </ChipFrame>
  );
}

/** "2026-10-05" → "5 oct", with the year only when it isn't this one. */
function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

interface FilterDateRangeChipProps {
  label: string;
  /** `YYYY-MM-DD`, or `''` for an open end. */
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  /** Clears both ends at once — two separate setters would each push their own URL update. */
  onClear: () => void;
}

/** A toolbar filter over a span of days; either end may stay open. */
export function FilterDateRangeChip({ label, from, to, onFromChange, onToChange, onClear }: FilterDateRangeChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  const valueLabel =
    from && to ? `${formatDay(from)} – ${formatDay(to)}`
    : from ? `desde ${formatDay(from)}`
    : to ? `hasta ${formatDay(to)}`
    : null;

  return (
    <ChipFrame
      label={label}
      valueLabel={valueLabel}
      onClear={onClear}
      isOpen={isOpen}
      onToggle={() => setIsOpen((v) => !v)}
      onClose={close}
    >
      <div className="flex w-64 flex-col gap-3 p-1.5">
        <Input label="Desde" type="date" value={from} max={to || undefined} onChange={(e) => onFromChange(e.target.value)} fullWidth />
        <Input label="Hasta" type="date" value={to} min={from || undefined} onChange={(e) => onToChange(e.target.value)} fullWidth />
      </div>
    </ChipFrame>
  );
}

interface FilterTextChipProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** A toolbar filter on a typed value, e.g. an exact id, that doesn't belong in the main search. */
export function FilterTextChip({ label, value, onChange, placeholder }: FilterTextChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <ChipFrame
      label={label}
      valueLabel={value ? (value.length > 14 ? `${value.slice(0, 12)}…` : value) : null}
      onClear={() => onChange('')}
      isOpen={isOpen}
      onToggle={() => setIsOpen((v) => !v)}
      onClose={close}
    >
      <div className="w-72 p-1.5">
        <Input
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClear={() => onChange('')}
          placeholder={placeholder}
          autoFocus
          fullWidth
        />
      </div>
    </ChipFrame>
  );
}
