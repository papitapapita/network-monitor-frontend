'use client';

import React, { useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { VendorDTO } from '@/types/device.types';
import {
  Button,
  DataTable,
  ErrorBanner,
  FilterBar,
  Input,
  LoadingSpinner,
  PageHeader,
  sortRows,
  useTableSort,
} from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';

const LIMIT = 20;

async function fetchAllVendors(): Promise<VendorDTO[]> {
  const batches: VendorDTO[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await apiService.listVendors({ limit: 100, offset });
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Error al cargar fabricantes');
    }
    batches.push(...result.data.vendors);
    hasMore = result.data.hasMore;
    offset += 100;
  }

  return batches;
}

const columns: DataTableColumn<VendorDTO>[] = [
  {
    key: 'name',
    header: 'Nombre',
    sortValue: (v) => v.name,
    cell: (v) => <span className="font-medium text-gray-900 dark:text-gray-100">{v.name}</span>,
  },
  {
    key: 'slug',
    header: 'Slug',
    sortValue: (v) => v.slug,
    cell: (v) => <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{v.slug}</span>,
  },
  {
    key: 'description',
    header: 'Descripción',
    className: 'hidden md:table-cell',
    cell: (v) => (
      <span className="text-gray-600 dark:text-gray-400 text-sm">
        {v.description ?? <span className="italic text-gray-400 dark:text-gray-600">—</span>}
      </span>
    ),
  },
];

function VendorsPageContent() {
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const sort = useTableSort({ onChange: () => setCurrentPage(1) });

  const {
    data: allVendors = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['vendors'],
    queryFn: fetchAllVendors,
  });

  const filtered = useMemo(() => {
    const searched = search
      ? allVendors.filter(
          (v) =>
            v.name.toLowerCase().includes(search.toLowerCase()) ||
            v.slug.toLowerCase().includes(search.toLowerCase())
        )
      : allVendors;
    return sortRows(searched, columns, sort.field, sort.direction);
  }, [allVendors, search, sort.field, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  const countLabel = allVendors.length > 0
    ? `${allVendors.length} ${allVendors.length === 1 ? 'fabricante' : 'fabricantes'} en total`
    : 'Administra los fabricantes de dispositivos';

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Fabricantes"
        subtitle={countLabel}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={<Button onClick={() => router.push('/vendors/create')}>Agregar Fabricante</Button>}
      />

      <FilterBar
        columns={3}
        hasFilters={!!search}
        onClear={() => { setSearch(''); setCurrentPage(1); }}
      >
        <Input
          label="Buscar"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Nombre o slug..."
          fullWidth
        />
      </FilterBar>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(v) => v.id}
        getRowLabel={(v) => v.name}
        onRowClick={(v) => router.push(`/vendors/${v.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando fabricantes..."
        emptyMessage={
          search
            ? 'Ningún fabricante coincide con la búsqueda'
            : 'Sin fabricantes. Agrega el primero para comenzar.'
        }
        sort={sort}
        selectionResetKey={`${currentPage}|${search}`}
        bulkDelete={{
          deleteOne: (id) => apiService.deleteVendor(id),
          onFinished: () => { refetch(); },
          entity: { singular: 'fabricante', plural: 'fabricantes', gender: 'm' },
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

export default function VendorsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <VendorsPageContent />
    </Suspense>
  );
}
