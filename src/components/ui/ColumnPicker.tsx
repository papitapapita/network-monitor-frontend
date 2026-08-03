'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './Button';

export interface PickableColumn {
  /** Matches the `key` of the DataTable column it shows or hides. */
  key: string;
  /** Name shown in the picker. */
  label: string;
  /** Always visible — listed as a checked, non-clickable entry. */
  locked?: boolean;
}

export interface ColumnVisibility {
  visibleKeys: string[];
  toggle: (key: string) => void;
  reset: () => void;
  isDefault: boolean;
}

/**
 * Which optional columns a table shows, remembered in localStorage.
 *
 * The stored preference is read after mount so the server and the first client
 * render agree; keys of columns that no longer exist are ignored by the caller,
 * which filters its own catalog.
 */
export function useColumnVisibility(storageKey: string, defaultKeys: string[]): ColumnVisibility {
  const [visibleKeys, setVisibleKeys] = useState<string[]>(defaultKeys);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((k) => typeof k === 'string')) {
        setVisibleKeys(parsed);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const store = useCallback(
    (keys: string[]) => {
      setVisibleKeys(keys);
      localStorage.setItem(storageKey, JSON.stringify(keys));
    },
    [storageKey]
  );

  const toggle = useCallback(
    (key: string) =>
      store(
        visibleKeys.includes(key)
          ? visibleKeys.filter((k) => k !== key)
          : [...visibleKeys, key]
      ),
    [store, visibleKeys]
  );

  const reset = useCallback(() => {
    setVisibleKeys(defaultKeys);
    localStorage.removeItem(storageKey);
    // `defaultKeys` is a literal constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const isDefault =
    visibleKeys.length === defaultKeys.length && defaultKeys.every((k) => visibleKeys.includes(k));

  return { visibleKeys, toggle, reset, isDefault };
}

function ColumnsIcon() {
  return (
    <svg
      className="mr-1.5 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v14H4z M10 5v14 M16 5v14" />
    </svg>
  );
}

function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`
        w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0
        ${checked
          ? 'bg-blue-600 border-blue-600'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
        }
      `}
    >
      {checked && (
        <svg
          className="w-2.5 h-2.5 text-white"
          fill="none"
          viewBox="0 0 10 10"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5" />
        </svg>
      )}
    </span>
  );
}

interface ColumnPickerProps {
  /** Every column the table can show, in the order they appear in it. */
  columns: PickableColumn[];
  visibleKeys: string[];
  onToggle: (key: string) => void;
  /** Omit to hide the "Restablecer" entry. */
  onReset?: () => void;
  isDefault?: boolean;
}

/** Dropdown that picks which optional columns a table shows. */
export function ColumnPicker({
  columns,
  visibleKeys,
  onToggle,
  onReset,
  isDefault = true,
}: ColumnPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <ColumnsIcon />
        Columnas
      </Button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Columnas visibles"
          className="absolute right-0 mt-2 z-30 w-60 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1.5"
        >
          <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Mostrar columnas
          </p>
          <div className="max-h-72 overflow-y-auto">
            {columns.map((col) => {
              const checked = !!col.locked || visibleKeys.includes(col.key);
              return (
                <button
                  key={col.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  disabled={col.locked}
                  onClick={() => onToggle(col.key)}
                  className={`
                    w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left text-sm
                    text-gray-700 dark:text-gray-200
                    ${col.locked
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <CheckMark checked={checked} />
                  {col.label}
                </button>
              );
            })}
          </div>
          {onReset && (
            <>
              <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
              <button
                type="button"
                role="menuitem"
                onClick={onReset}
                disabled={isDefault}
                className="w-full px-2 py-1.5 rounded text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                Restablecer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
