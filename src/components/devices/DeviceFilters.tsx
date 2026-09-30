'use client';

import { Select, FilterBar } from '@/components/ui';
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
}: DeviceFiltersProps) {
  return (
    <FilterBar
      columns={4}
      hasFilters={hasFilters}
      onClear={onClear}
      secondaryFiltersActive={!!(statusFilter || categoryFilter || connectivityFilter || agentFilter)}
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: 'Nombre, IP, MAC, serie...',
        maxLength: 150,
      }}
    >
      <Select
        label="Estado"
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        options={DEVICE_STATUS_FILTER_OPTIONS}
        fullWidth
      />
      <Select
        label="Categoría"
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
        options={DEVICE_CATEGORY_FILTER_OPTIONS}
        fullWidth
      />
      <Select
        label="Conectividad"
        value={connectivityFilter}
        onChange={(e) => onConnectivityChange(e.target.value)}
        options={[
          { value: '', label: 'Todos' },
          { value: 'UP', label: 'En línea' },
          { value: 'DOWN', label: 'Desconectado' },
          { value: 'UNKNOWN', label: 'Desconocido' },
        ]}
        fullWidth
      />
      {agentOptions && onAgentChange && (
        <Select
          label="Sondeado por"
          value={agentFilter}
          onChange={(e) => onAgentChange(e.target.value)}
          options={[{ value: '', label: 'Todos' }, ...agentOptions]}
          fullWidth
        />
      )}
    </FilterBar>
  );
}
