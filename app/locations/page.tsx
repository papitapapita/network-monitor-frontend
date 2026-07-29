'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { LocationResponseDTO } from '@/types/location.types';
import {
  LOCATION_TYPE_LABELS,
  LOCATION_TYPE_BADGE_VARIANTS,
  LOCATION_TYPE_OPTIONS,
} from '@/constants/location.constants';
import {
  Badge,
  Button,
  DataTable,
  ErrorBanner,
  FilterBar,
  Input,
  PageHeader,
  Select,
  sortRows,
  useTableSort,
} from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';

const PAGE_LIMIT = 20;

const LOCATION_TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Todos los Tipos' },
  ...LOCATION_TYPE_OPTIONS.slice(1),
];

const columns: DataTableColumn<LocationResponseDTO>[] = [
  {
    key: 'name',
    header: 'Nombre',
    sortValue: (l) => l.name,
    cell: (l) => (
      <>
        <span className="font-medium">{l.name}</span>
        {l.address && (
          <div className="text-xs text-gray-400 dark:text-gray-500 lg:hidden truncate max-w-[12rem]">
            {l.address}
          </div>
        )}
      </>
    ),
  },
  {
    key: 'type',
    header: 'Tipo',
    sortValue: (l) => LOCATION_TYPE_LABELS[l.type],
    cell: (l) => (
      <Badge variant={LOCATION_TYPE_BADGE_VARIANTS[l.type]}>{LOCATION_TYPE_LABELS[l.type]}</Badge>
    ),
  },
  {
    key: 'municipality',
    header: 'Municipio',
    sortValue: (l) => l.municipality,
    className: 'hidden sm:table-cell',
    cellClassName: 'text-gray-600 dark:text-gray-300',
    cell: (l) => l.municipality ?? '—',
  },
  {
    key: 'neighborhood',
    header: 'Barrio',
    sortValue: (l) => l.neighborhood,
    className: 'hidden md:table-cell',
    cellClassName: 'text-gray-600 dark:text-gray-300',
    cell: (l) => l.neighborhood ?? '—',
  },
  {
    key: 'address',
    header: 'Dirección',
    sortValue: (l) => l.address,
    className: 'hidden lg:table-cell',
    cellClassName: 'text-gray-600 dark:text-gray-300 max-w-xs',
    cell: (l) => <span className="block truncate">{l.address ?? '—'}</span>,
  },
];

/** The list endpoint has no search param, so the page filters client-side. */
async function fetchAllLocations(): Promise<LocationResponseDTO[]> {
  const all: LocationResponseDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listLocations({ limit: 100, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar las ubicaciones');
    all.push(...r.data.locations);
    hasMore = r.data.hasMore;
    offset += 100;
  }
  return all;
}

export default function LocationsPage() {
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const sort = useTableSort({ onChange: () => setCurrentPage(1) });

  const {
    data: allLocations = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['locations'],
    queryFn: fetchAllLocations,
  });

  const hasFilters = !!(search || typeFilter);
  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    let rows = typeFilter ? allLocations.filter((l) => l.type === typeFilter) : allLocations;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((l) =>
        [l.name, l.municipality, l.neighborhood, l.address].some((v) =>
          (v ?? '').toLowerCase().includes(q)
        )
      );
    }
    return sortRows(rows, columns, sort.field, sort.direction);
  }, [allLocations, search, typeFilter, sort.field, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const paginated = filtered.slice((currentPage - 1) * PAGE_LIMIT, currentPage * PAGE_LIMIT);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Ubicaciones"
        subtitle={
          allLocations.length > 0
            ? `${allLocations.length} ${allLocations.length === 1 ? 'ubicación' : 'ubicaciones'} en total`
            : 'Gestiona las ubicaciones de la red'
        }
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={<Button onClick={() => router.push('/locations/create')}>Agregar Ubicación</Button>}
      />

      <FilterBar columns={3} hasFilters={hasFilters} onClear={clearFilters}>
        <Input
          label="Buscar"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Nombre, municipio, barrio o dirección..."
          fullWidth
        />
        <Select
          label="Tipo"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
          options={LOCATION_TYPE_FILTER_OPTIONS}
          fullWidth
        />
      </FilterBar>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(l) => l.id}
        getRowLabel={(l) => l.name}
        onRowClick={(l) => router.push(`/locations/${l.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando ubicaciones..."
        emptyMessage={
          hasFilters
            ? 'Ninguna ubicación coincide con los filtros'
            : 'Sin ubicaciones. Agrega la primera para comenzar.'
        }
        sort={sort}
        selectionResetKey={`${currentPage}|${search}|${typeFilter}`}
        bulkDelete={{
          deleteOne: (id) => apiService.deleteLocation(id),
          onFinished: () => { refetch(); },
          entity: { singular: 'ubicación', plural: 'ubicaciones', gender: 'f' },
        }}
        pagination={{
          currentPage,
          totalPages,
          totalItems: filtered.length,
          itemsPerPage: PAGE_LIMIT,
          onPageChange: setCurrentPage,
        }}
      />
    </div>
  );
}
