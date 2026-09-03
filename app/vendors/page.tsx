'use client';

import React, { useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { VendorDTO } from '@/types/device.types';
import { useUrlState, useUrlTableSort } from '@/hooks/useUrlState';
import {
  DataTable,
  ErrorBanner,
  FilterBar,
  IconButton,
  LoadingSpinner,
  PageHeader,
  PlusIcon,
  sortRows,
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
    cellClassName: 'max-w-xs',
    cell: (v) => <span className="font-medium text-gray-900 dark:text-gray-100">{v.name}</span>,
  },
  {
    key: 'slug',
    header: 'Slug',
    sortValue: (v) => v.slug,
    cellClassName: 'max-w-xs',
    cell: (v) => <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{v.slug}</span>,
  },
  {
    key: 'description',
    header: 'Descripción',
    className: 'hidden md:table-cell',
    cellClassName: 'max-w-xs',
    cell: (v) => (
      <span className="text-gray-600 dark:text-gray-400 text-sm">
        {v.description ?? <span className="italic text-gray-400 dark:text-gray-600">—</span>}
      </span>
    ),
  },
];

function VendorsPageContent() {
  const router = useRouter();

  const { get, getNumber, set } = useUrlState();
  const currentPage = getNumber('page', 1);
  const search = get('search', '');
  const sort = useUrlTableSort({ get, set });

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
        actions={
          <IconButton
            icon={<PlusIcon />}
            label="Agregar Fabricante"
            variant="primary"
            size="md"
            onClick={() => router.push('/vendors/create')}
          />
        }
      />

      <FilterBar
        hasFilters={!!search}
        onClear={() => set({ search: null, page: null })}
        search={{
          value: search,
          onChange: (value) => set({ search: value || null, page: null }),
          placeholder: 'Nombre o slug...',
          maxLength: 150,
        }}
      />

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
          onPageChange: (page) => set({ page: page === 1 ? null : page }),
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
