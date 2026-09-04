'use client';

import React, { useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { ServicePlanDTO } from '@/types/customer.types';
import { useUrlState, useUrlTableSort } from '@/hooks/useUrlState';
import {
  Badge,
  ColumnPicker,
  DataTable,
  ErrorBanner,
  FilterBar,
  IconButton,
  LoadingSpinner,
  PageHeader,
  PlusIcon,
  Select,
  sortRows,
  useColumnVisibility,
} from '@/components/ui';
import type { DataTableColumn, PickableColumn } from '@/components/ui';

const LIMIT = 20;
const COLUMNS_STORAGE_KEY = 'nms:service-plans-columns';

async function fetchAllPlans(): Promise<ServicePlanDTO[]> {
  const all: ServicePlanDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listServicePlans({ limit: 100, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar planes');
    all.push(...r.data.servicePlans);
    hasMore = r.data.hasMore;
    offset += 100;
  }
  return all;
}

function fmtPrice(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

type ServicePlanColumn = DataTableColumn<ServicePlanDTO> & { label: string; locked?: boolean };

const SERVICE_PLAN_COLUMN_CATALOG: ServicePlanColumn[] = [
  {
    key: 'name',
    label: 'Nombre',
    locked: true,
    header: 'Nombre',
    sortValue: (p) => p.name,
    cellClassName: 'max-w-xs',
    cell: (p) => (
      <>
        <span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
        {p.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs">
            {p.description}
          </div>
        )}
      </>
    ),
  },
  {
    key: 'speed',
    label: 'Velocidad',
    header: 'Velocidad',
    sortValue: (p) => p.downloadMbps,
    cell: (p) => (
      <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
        {p.downloadMbps}↓ / {p.uploadMbps}↑ Mbps
      </span>
    ),
  },
  {
    key: 'monthlyPrice',
    label: 'Precio/mes',
    header: 'Precio/mes',
    sortValue: (p) => p.monthlyPrice,
    cell: (p) => <span className="text-gray-900 dark:text-gray-100">{fmtPrice(p.monthlyPrice)}</span>,
  },
  {
    key: 'isActive',
    label: 'Estado',
    header: 'Estado',
    sortValue: (p) => (p.isActive ? 'Activo' : 'Inactivo'),
    cell: (p) => (
      <Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Activo' : 'Inactivo'}</Badge>
    ),
  },
];

const SERVICE_PLAN_COLUMN_OPTIONS: PickableColumn[] = SERVICE_PLAN_COLUMN_CATALOG.map(
  ({ key, label, locked }) => ({ key, label, locked })
);
const DEFAULT_SERVICE_PLAN_COLUMNS = SERVICE_PLAN_COLUMN_CATALOG.map((c) => c.key);

function ServicePlansContent() {
  const router = useRouter();
  const { get, getNumber, set } = useUrlState();
  const currentPage = getNumber('page', 1);
  const search = get('search', '');
  const statusFilter = get('status', '');
  const sort = useUrlTableSort({ get, set });
  const { visibleKeys, toggle, reset, isDefault } = useColumnVisibility(
    COLUMNS_STORAGE_KEY,
    DEFAULT_SERVICE_PLAN_COLUMNS
  );
  const columns = useMemo(
    () => SERVICE_PLAN_COLUMN_CATALOG.filter((c) => c.locked || visibleKeys.includes(c.key)),
    [visibleKeys]
  );

  const {
    data: all = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['servicePlans'],
    queryFn: fetchAllPlans,
  });

  const hasFilters = !!(search || statusFilter);
  const clearFilters = () => set({ search: null, status: null, page: null });

  const filtered = useMemo(() => {
    let rows = search
      ? all.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : all;
    if (statusFilter) {
      rows = rows.filter((p) => (statusFilter === 'active' ? p.isActive : !p.isActive));
    }
    return sortRows(rows, SERVICE_PLAN_COLUMN_CATALOG, sort.field, sort.direction);
  }, [all, search, statusFilter, sort.field, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Planes de Servicio"
        subtitle={
          all.length > 0
            ? `${all.length} ${all.length === 1 ? 'plan' : 'planes'} en total`
            : 'Administra los planes de internet'
        }
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          <>
            <ColumnPicker
              columns={SERVICE_PLAN_COLUMN_OPTIONS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onReset={reset}
              isDefault={isDefault}
            />
            <IconButton
              icon={<PlusIcon />}
              label="Agregar Plan"
              variant="primary"
              size="md"
              onClick={() => router.push('/service-plans/create')}
            />
          </>
        }
      />

      <FilterBar
        columns={2}
        hasFilters={hasFilters}
        onClear={clearFilters}
        secondaryFiltersActive={!!statusFilter}
        search={{
          value: search,
          onChange: (value) => set({ search: value || null, page: null }),
          placeholder: 'Nombre del plan...',
          maxLength: 150,
        }}
      >
        <Select
          label="Estado"
          value={statusFilter}
          onChange={(e) => set({ status: e.target.value || null, page: null })}
          options={[
            { value: '', label: 'Todos los Estados' },
            { value: 'active', label: 'Activo' },
            { value: 'inactive', label: 'Inactivo' },
          ]}
          fullWidth
        />
      </FilterBar>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(p) => p.id}
        getRowLabel={(p) => p.name}
        onRowClick={(p) => router.push(`/service-plans/${p.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando planes..."
        emptyMessage={
          hasFilters
            ? 'Ningún plan coincide con los filtros'
            : 'Sin planes. Agrega el primero para comenzar.'
        }
        sort={sort}
        selectionResetKey={`${currentPage}|${search}|${statusFilter}`}
        bulkDelete={{
          deleteOne: (id) => apiService.deleteServicePlan(id),
          onFinished: () => { refetch(); },
          entity: { singular: 'plan', plural: 'planes', gender: 'm' },
        }}
        pagination={{
          currentPage,
          totalPages,
          totalItems: filtered.length,
          itemsPerPage: LIMIT,
          onPageChange: (page) => set({ page: page === 1 ? null : page }),
        }}
      />
    </div>
  );
}

export default function ServicePlansPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <ServicePlansContent />
    </Suspense>
  );
}
