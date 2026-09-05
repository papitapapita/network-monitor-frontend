'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface ComboboxOption {
  value: string;
  label: string;
  /** Shown beneath the label in a lighter color, e.g. a vendor name under a model. */
  sublabel?: string;
}

interface ComboboxProps {
  label?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  createLabel?: string;
  onCreateNew?: (query: string) => void;
}

export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder = 'Escribir para buscar...',
  error,
  required,
  fullWidth,
  disabled,
  createLabel,
  onCreateNew,
}: ComboboxProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const filtered = query
    ? options.filter((o) => {
        // Every whitespace-separated token has to appear somewhere in label+sublabel,
        // so "mik rb4" matches "RB450G" under "MikroTik" regardless of word order.
        const haystack = `${o.label} ${o.sublabel ?? ''}`.toLowerCase();
        const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
        return tokens.every((t) => haystack.includes(t));
      })
    : options;

  const totalItems = filtered.length + (onCreateNew ? 1 : 0);

  const updatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
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

  // Close on outside click (must also check the portal ul)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(target as Element).closest?.('[data-combobox-dropdown]')
      ) {
        setIsOpen(false);
        setQuery('');
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Track position while open (scroll / resize in any ancestor)
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

  const handleFocus = () => {
    setQuery('');
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
    if (value) onChange('');
  };

  const handleSelect = (opt: ComboboxOption) => {
    onChange(opt.value);
    setIsOpen(false);
    setQuery('');
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        handleSelect(filtered[highlightedIndex]);
      } else if (highlightedIndex === filtered.length && onCreateNew) {
        onCreateNew(query);
        setIsOpen(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      setHighlightedIndex(-1);
    }
  };

  const inputDisplayValue = isOpen ? query : (selectedOption?.label ?? '');

  // Mirrors Input/Select so the label actually points at the field.
  const inputId = label?.toLowerCase().replace(/\s+/g, '-');
  const listboxId = inputId ? `${inputId}-listbox` : undefined;

  const dropdown =
    isOpen && !disabled && dropdownRect
      ? ReactDOM.createPortal(
          <ul
            data-combobox-dropdown
            id={listboxId}
            role="listbox"
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
            {filtered.length === 0 && !onCreateNew && (
              <li className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">Sin resultados</li>
            )}
            {filtered.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                onMouseDown={() => handleSelect(opt)}
                className={`px-2 py-1.5 rounded text-sm cursor-pointer break-words ${
                  i === highlightedIndex
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : ''
                } ${
                  opt.value === value
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                {opt.label}
                {opt.sublabel && (
                  <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                    {opt.sublabel}
                  </span>
                )}
              </li>
            ))}
            {onCreateNew && (
              <>
                {filtered.length > 0 && <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />}
                <li
                  onMouseDown={() => {
                    onCreateNew(query);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className={`px-2 py-1.5 rounded text-sm cursor-pointer text-blue-600 dark:text-blue-400 ${
                    highlightedIndex === filtered.length ? 'bg-gray-100 dark:bg-gray-700' : ''
                  }`}
                >
                  {createLabel ?? '+ Crear nuevo'}
                </li>
              </>
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        type="text"
        value={inputDisplayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={`
          block w-full px-3 py-2 rounded-md shadow-sm transition-colors
          bg-white dark:bg-gray-800
          text-gray-900 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-gray-400 dark:disabled:hover:border-gray-600
          ${
            error
              ? 'border border-red-400 hover:border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border border-gray-400 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400'
          }
        `}
      />
      {dropdown}
      {!isOpen && selectedOption?.sublabel && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 wrap-anywhere">{selectedOption.sublabel}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
