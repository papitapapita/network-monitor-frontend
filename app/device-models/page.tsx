'use client';

import React, { useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { fetchAllDeviceModels } from '@/hooks/useCatalogs';
import { DeviceModelResponseDTO, DeviceType } from '@/types/device.types';
import {
  Badge,
  Button,
  DataTable,
  ErrorBanner,
  FilterBar,
  Input,
  LoadingSpinner,
  PageHeader,
  Select,
  sortRows,
  useTableSort,
} from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';

const LIMIT = 20;

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  ANTENNA: 'Antena',
  OTHER: 'Otro',
  RADIO: 'Radio',
  ROUTER: 'Router',
  ROUTERBOARD: 'RouterBoard',
  SERVER: 'Servidor',
  SWITCH: 'Switch',
};

const DEVICE_TYPE_OPTIONS = [
  { value: '', label: 'Todos los Tipos' },
  ...Object.entries(DEVICE_TYPE_LABELS)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es')),
];

const columns: DataTableColumn<DeviceModelResponseDTO>[] = [
  {
    key: 'vendor',
    header: 'Fabricante',
    sortValue: (m) => m.vendorName,
    cell: (m) => <span className="font-medium text-gray-900 dark:text-gray-100">{m.vendorName}</span>,
  },
  {
    key: 'model',
    header: 'Modelo',
    sortValue: (m) => m.model,
    cell: (m) => <span className="text-gray-900 dark:text-gray-100">{m.model}</span>,
  },
  {
    key: 'type',
    header: 'Tipo',
    sortValue: (m) => DEVICE_TYPE_LABELS[m.deviceType] ?? m.deviceType,
    cell: (m) => <Badge variant="info">{DEVICE_TYPE_LABELS[m.deviceType] ?? m.deviceType}</Badge>,
  },
];

function DeviceModelsPageContent() {
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const sort = useTableSort({ onChange: () => setCurrentPage(1) });

  const {
    data: allModels = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['deviceModels'],
    queryFn: fetchAllDeviceModels,
  });

  const hasFilters = !!(search || typeFilter);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    let rows = typeFilter ? allModels.filter((m) => m.deviceType === typeFilter) : allModels;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (m) => m.model.toLowerCase().includes(q) || m.vendorName.toLowerCase().includes(q)
      );
    }
    return sortRows(rows, columns, sort.field, sort.direction);
  }, [allModels, search, typeFilter, sort.field, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  const countLabel = allModels.length > 0
    ? `${allModels.length} ${allModels.length === 1 ? 'modelo' : 'modelos'} en total`
    : 'Administra los modelos de dispositivos';

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Modelos de Dispositivo"
        subtitle={countLabel}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={<Button onClick={() => router.push('/device-models/create')}>Agregar Modelo</Button>}
      />

      <FilterBar columns={3} hasFilters={hasFilters} onClear={clearFilters}>
        <Input
          label="Buscar"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Fabricante o modelo..."
          fullWidth
        />
        <Select
          label="Tipo de Dispositivo"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
          options={DEVICE_TYPE_OPTIONS}
          fullWidth
        />
      </FilterBar>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(m) => m.id}
        getRowLabel={(m) => `${m.vendorName} ${m.model}`}
        onRowClick={(m) => router.push(`/device-models/${m.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando modelos..."
        emptyMessage={
          hasFilters
            ? 'Ningún modelo coincide con los filtros'
            : 'Sin modelos. Agrega el primero para comenzar.'
        }
        sort={sort}
        selectionResetKey={`${currentPage}|${search}|${typeFilter}`}
        bulkDelete={{
          deleteOne: (id) => apiService.deleteDeviceModel(id),
          // DEV-030: a delete refused purely because the model's remaining
          // devices are in the recycle bin gets a second confirmation instead of
          // a dead-end error — confirming retries with the purge flag.
          confirmAndRetry: (id) => apiService.deleteDeviceModel(id, true),
          onFinished: () => { refetch(); },
          entity: { singular: 'modelo', plural: 'modelos', gender: 'm' },
        }}
        pagination={{
          currentPage,
          totalPages,
          totalItems: filtered.length,
          itemsPerPage: LIMIT,
          onPageChange: setCurrentPage,
        }}
      />
    </div>
  );
}

export default function DeviceModelsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <DeviceModelsPageContent />
    </Suspense>
  );
}
