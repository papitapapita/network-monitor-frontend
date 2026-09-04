'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDownIcon, CheckIcon } from './icons';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

/**
 * Custom-rendered dropdown styled like the app's other popovers (ColumnPicker,
 * Combobox) instead of a native <select> — the native option list can't be
 * restyled and lets a long label's popup overflow the viewport. The trigger
 * width bounds the portal's width, and labels wrap instead of clipping.
 */
export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      fullWidth = false,
      name,
      value,
      onChange,
      disabled,
      required,
      className = '',
      id,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const selectedOption = options.find((o) => o.value === value);

    const updatePosition = useCallback(() => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const maxDropdownHeight = 240;
        const gap = 4;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const spaceAbove = rect.top - gap;
        if (spaceBelow >= maxDropdownHeight || spaceBelow >= spaceAbove) {
          setDropdownRect({
            top: rect.bottom + gap,
            left: rect.left,
            width: rect.width,
            maxHeight: Math.min(maxDropdownHeight, spaceBelow),
          });
        } else {
          const height = Math.min(maxDropdownHeight, spaceAbove);
          setDropdownRect({
            top: rect.top - height - gap,
            left: rect.left,
            width: rect.width,
            maxHeight: height,
          });
        }
      }
    }, []);

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          containerRef.current && !containerRef.current.contains(target) &&
          !(target as Element).closest?.('[data-select-dropdown]')
        ) {
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
      if (!isOpen) return;
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }, [isOpen, updatePosition]);

    const emitChange = (newValue: string) => {
      onChange?.({ target: { name, value: newValue } } as unknown as React.ChangeEvent<HTMLSelectElement>);
    };

    const handleSelect = (opt: SelectOption) => {
      emitChange(opt.value);
      setIsOpen(false);
      setHighlightedIndex(-1);
      buttonRef.current?.focus();
    };

    const openAt = (index: number) => {
      setIsOpen(true);
      setHighlightedIndex(index);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const current = options.findIndex((o) => o.value === value);
          openAt(current >= 0 ? current : 0);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setHighlightedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (highlightedIndex >= 0) handleSelect(options[highlightedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
      } else if (e.key === 'Tab') {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const listboxId = selectId ? `${selectId}-listbox` : undefined;

    const dropdown =
      isOpen && !disabled && dropdownRect
        ? ReactDOM.createPortal(
            <ul
              data-select-dropdown
              id={listboxId}
              role="listbox"
              aria-label={label}
              style={{
                position: 'fixed',
                top: dropdownRect.top,
                left: dropdownRect.left,
                width: dropdownRect.width,
                maxHeight: dropdownRect.maxHeight,
                zIndex: 9999,
              }}
              className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1.5"
            >
              {options.map((opt, i) => {
                const selected = opt.value === value;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-sm break-words cursor-pointer ${
                      i === highlightedIndex
                        ? 'bg-gray-100 dark:bg-gray-700'
                        : ''
                    } ${
                      selected
                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span className="min-w-0 break-words">{opt.label}</span>
                    {selected && <CheckIcon className="h-3.5 w-3.5" />}
                  </li>
                );
              })}
            </ul>,
            document.body
          )
        : null;

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div ref={containerRef} className="relative">
          <button
            ref={(node) => {
              buttonRef.current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            type="button"
            id={selectId}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-required={required}
            disabled={disabled}
            onClick={() => (isOpen ? setIsOpen(false) : openAt(options.findIndex((o) => o.value === value)))}
            onKeyDown={handleKeyDown}
            className={`
              flex items-center justify-between gap-2 w-full px-3 py-2 rounded-md shadow-sm text-left transition-colors
              bg-white dark:bg-gray-800
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-gray-400 dark:disabled:hover:border-gray-600
              ${
                error
                  ? 'border border-red-400 hover:border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border border-gray-400 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400'
              }
              ${className}
            `}
          >
            <span className={`truncate ${selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
              {selectedOption?.label ?? placeholder ?? ''}
            </span>
            <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdown}
        </div>

        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
