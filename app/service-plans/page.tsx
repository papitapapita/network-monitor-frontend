'use client';

import React, { useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { ServicePlanDTO } from '@/types/customer.types';
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

const columns: DataTableColumn<ServicePlanDTO>[] = [
  {
    key: 'name',
    header: 'Nombre',
    sortValue: (p) => p.name,
    cell: (p) => (
      <>
        <span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span>
        {p.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">
            {p.description}
          </div>
        )}
      </>
    ),
  },
  {
    key: 'speed',
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
    header: 'Precio/mes',
    sortValue: (p) => p.monthlyPrice,
    cell: (p) => <span className="text-gray-900 dark:text-gray-100">{fmtPrice(p.monthlyPrice)}</span>,
  },
  {
    key: 'isActive',
    header: 'Estado',
    sortValue: (p) => (p.isActive ? 'Activo' : 'Inactivo'),
    cell: (p) => (
      <Badge variant={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Activo' : 'Inactivo'}</Badge>
    ),
  },
];

function ServicePlansContent() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const sort = useTableSort({ onChange: () => setCurrentPage(1) });

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
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    let rows = search
      ? all.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : all;
    if (statusFilter) {
      rows = rows.filter((p) => (statusFilter === 'active' ? p.isActive : !p.isActive));
    }
    return sortRows(rows, columns, sort.field, sort.direction);
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
        actions={<Button onClick={() => router.push('/service-plans/create')}>Agregar Plan</Button>}
      />

      <FilterBar columns={3} hasFilters={hasFilters} onClear={clearFilters}>
        <Input
          label="Buscar"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Nombre del plan..."
          fullWidth
        />
        <Select
          label="Estado"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
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
          onPageChange: setCurrentPage,
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
