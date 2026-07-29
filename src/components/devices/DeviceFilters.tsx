'use client';

import { Select, Input, FilterBar } from '@/components/ui';
import { DEVICE_CATEGORY_FILTER_OPTIONS, DEVICE_STATUS_FILTER_OPTIONS } from '@/constants/device.constants';

interface DeviceFiltersProps {
  statusFilter: string;
  categoryFilter: string;
  connectivityFilter: string;
  search: string;
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
  hasFilters,
  onStatusChange,
  onCategoryChange,
  onConnectivityChange,
  onSearchChange,
  onClear,
}: DeviceFiltersProps) {
  return (
    <FilterBar columns={5} hasFilters={hasFilters} onClear={onClear}>
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
          { value: 'ONLINE', label: 'En línea' },
          { value: 'OFFLINE', label: 'Desconectado' },
          { value: 'UNKNOWN', label: 'Desconocido' },
        ]}
        fullWidth
      />
      <Input
        label="Buscar"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Nombre, IP, MAC, serie..."
        fullWidth
      />
    </FilterBar>
  );
}
