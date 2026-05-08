'use client';

import { Select, Input, Button } from '@/components/ui';

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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Select
          label="Estado"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          options={[
            { value: '', label: 'Todos los Estados' },
            { value: 'INVENTORY', label: 'Inventario' },
            { value: 'ACTIVE', label: 'Activo' },
            { value: 'MAINTENANCE', label: 'Mantenimiento' },
            { value: 'DAMAGED', label: 'Dañado' },
            { value: 'DECOMMISSIONED', label: 'Descomisionado' },
          ]}
          fullWidth
        />
        <Select
          label="Categoría"
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          options={[
            { value: '', label: 'Todas las Categorías' },
            { value: 'CORE', label: 'Núcleo' },
            { value: 'DISTRIBUTION', label: 'Distribución' },
            { value: 'POE', label: 'PoE' },
            { value: 'ACCESS_POINT', label: 'Punto de Acceso' },
            { value: 'CLIENT_CPE', label: 'CPE Cliente' },
          ]}
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
        <div className="flex items-end">
          <Button variant="outline" fullWidth onClick={onClear} disabled={!hasFilters}>
            Limpiar Filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
