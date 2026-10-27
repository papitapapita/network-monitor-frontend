'use client';

import type React from 'react';
import { FilterBar, FilterChip } from '@/components/ui';
import { DEVICE_CATEGORY_FILTER_OPTIONS, DEVICE_STATUS_FILTER_OPTIONS } from '@/constants/device.constants';

interface DeviceFiltersProps {
  statusFilter: string;
  categoryFilter: string;
  connectivityFilter: string;
  search: string;
  /** Omitted on an install with no agents, where every device is the server's. */
  agentFilter?: string;
  agentOptions?: { value: string; label: string }[];
  onAgentChange?: (value: string) => void;
  hasFilters: boolean;
  onStatusChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onConnectivityChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onClear: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** The page's toolbar buttons, after "Actualizar". */
  actions?: React.ReactNode;
}

export function DeviceFilters({
  statusFilter,
  categoryFilter,
  connectivityFilter,
  search,
  agentFilter = '',
  agentOptions,
  onAgentChange,
  hasFilters,
  onStatusChange,
  onCategoryChange,
  onConnectivityChange,
  onSearchChange,
  onClear,
  onRefresh,
  isRefreshing,
  actions,
}: DeviceFiltersProps) {
  return (
    <FilterBar
      hasFilters={hasFilters}
      onClear={onClear}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      actions={actions}
      activeFilterCount={[statusFilter, categoryFilter, connectivityFilter, agentFilter].filter(Boolean).length}
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: 'Nombre, IP, MAC, serie...',
        maxLength: 150,
      }}
    >
      <FilterChip
        label="Estado"
        value={statusFilter}
        onChange={onStatusChange}
        options={DEVICE_STATUS_FILTER_OPTIONS}
      />
      <FilterChip
        label="Categoría"
        value={categoryFilter}
        onChange={onCategoryChange}
        options={DEVICE_CATEGORY_FILTER_OPTIONS}
      />
      <FilterChip
        label="Conectividad"
        value={connectivityFilter}
        onChange={onConnectivityChange}
        options={[
          { value: '', label: 'Todos' },
          { value: 'UP', label: 'En línea' },
          { value: 'DOWN', label: 'Desconectado' },
          { value: 'UNKNOWN', label: 'Desconocido' },
        ]}
      />
      {agentOptions && onAgentChange && (
        <FilterChip
          label="Sondeado por"
          value={agentFilter}
          onChange={onAgentChange}
          options={[{ value: '', label: 'Todos' }, ...agentOptions]}
        />
      )}
    </FilterBar>
  );
}
