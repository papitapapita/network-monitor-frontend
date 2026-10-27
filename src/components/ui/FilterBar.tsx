'use client';

import React, { useState } from 'react';
import { IconButton } from './IconButton';
import { Input } from './Input';
import { SearchIcon, FunnelIcon, RefreshIcon } from './icons';

interface FilterBarSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

interface FilterBarProps {
  /** Always-visible search field — icon-only, no redundant "Buscar" label. */
  search?: FilterBarSearch;
  /** `FilterChip`s and friends — tucked behind the funnel button, sliding open beneath the row. */
  children?: React.ReactNode;
  /** Shows "Limpiar" while `hasFilters`; it should reset the search too. */
  onClear?: () => void;
  hasFilters?: boolean;
  /** How many chips have a value — badged on the funnel, and opens the chips on mount when above zero. */
  activeFilterCount?: number;
  /** Adds the "Actualizar" button as the first action. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** The page's own buttons (columns, trash, add…) — right of the search, above it on narrow screens. */
  actions?: React.ReactNode;
}

/**
 * The toolbar above every list table: search, the filter toggle and "Limpiar"
 * on the left, the page's buttons on the right. Below `lg` the buttons take
 * their own row above the search instead.
 */
export function FilterBar({
  search,
  children,
  onClear,
  hasFilters = false,
  activeFilterCount = 0,
  onRefresh,
  isRefreshing = false,
  actions,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(activeFilterCount > 0);
  const hasActions = !!onRefresh || !!actions;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <div className="min-w-0 flex-1 lg:w-80 lg:flex-none">
            <Input
              icon={<SearchIcon />}
              aria-label="Buscar"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              onClear={() => search.onChange('')}
              placeholder={search.placeholder}
              maxLength={search.maxLength}
              className="h-10"
              fullWidth
            />
          </div>
        )}
        {children && (
          <div className="relative shrink-0">
            <IconButton
              icon={<FunnelIcon />}
              label={expanded ? 'Ocultar filtros' : 'Filtros'}
              size="md"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className={expanded ? '!border-brand-300 !bg-brand-50 !text-brand-700 dark:!border-brand-700 dark:!bg-brand-900/30 dark:!text-brand-200' : ''}
            />
            {activeFilterCount > 0 && (
              <span className="pointer-events-none absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-semibold text-white ring-2 ring-white dark:ring-gray-900">
                {activeFilterCount}
              </span>
            )}
          </div>
        )}
        {onClear && hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="h-10 shrink-0 px-2 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
          >
            Limpiar
          </button>
        )}
        {/* Narrow screens: the actions take their own row above the search, left-aligned. */}
        {hasActions && (
          <div className="order-first flex w-full flex-wrap items-center gap-2 lg:order-none lg:ml-auto lg:w-auto">
            {onRefresh && (
              <IconButton
                icon={isRefreshing ? null : <RefreshIcon />}
                label="Actualizar"
                size="md"
                onClick={onRefresh}
                isLoading={isRefreshing}
                disabled={isRefreshing}
              />
            )}
            {actions}
          </div>
        )}
      </div>

      {/* Animating grid rows 0fr → 1fr slides the chips open at their natural
          height; `inert` keeps the collapsed ones out of the tab order. */}
      {children && (
        <div
          inert={!expanded}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
            expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="-mx-0.5 overflow-hidden">
            <div
              className={`flex flex-wrap items-center gap-2 p-0.5 pt-3 transition-transform duration-200 ease-out ${
                expanded ? 'translate-y-0' : '-translate-y-2'
              }`}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
