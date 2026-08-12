'use client';

import React, { useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CustomerDTO } from '@/types/customer.types';
import { fetchAllCustomers } from '@/hooks/useCatalogs';
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

const columns: DataTableColumn<CustomerDTO>[] = [
  {
    key: 'fullName',
    header: 'Nombre',
    sortValue: (c) => c.fullName,
    cell: (c) => <span className="font-medium text-gray-900 dark:text-gray-100">{c.fullName}</span>,
  },
  {
    key: 'phone',
    header: 'Teléfono',
    sortValue: (c) => c.phone,
    cell: (c) => <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{c.phone}</span>,
  },
  {
    key: 'email',
    header: 'Email',
    sortValue: (c) => c.email,
    className: 'hidden md:table-cell',
    cell: (c) => <span className="text-gray-600 dark:text-gray-400 text-sm">{c.email ?? '—'}</span>,
  },
  {
    key: 'cedula',
    header: 'Cédula',
    sortValue: (c) => c.cedula,
    className: 'hidden sm:table-cell',
    cell: (c) => <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{c.cedula ?? '—'}</span>,
  },
];

function CustomersPageContent() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const sort = useTableSort({ onChange: () => setCurrentPage(1) });

  const {
    data: all = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchAllCustomers,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const rows = search
      ? all.filter(
          (c) =>
            c.fullName.toLowerCase().includes(q) ||
            c.phone.includes(search) ||
            (c.email ?? '').toLowerCase().includes(q) ||
            (c.cedula ?? '').includes(search)
        )
      : all;
    return sortRows(rows, columns, sort.field, sort.direction);
  }, [all, search, sort.field, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Clientes"
        subtitle={
          all.length > 0
            ? `${all.length} ${all.length === 1 ? 'cliente' : 'clientes'} en total`
            : 'Administra los clientes del servicio'
        }
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={<Button onClick={() => router.push('/customers/create')}>Agregar Cliente</Button>}
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
          placeholder="Nombre, teléfono, email o cédula..."
          fullWidth
        />
      </FilterBar>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(c) => c.id}
        getRowLabel={(c) => c.fullName}
        onRowClick={(c) => router.push(`/customers/${c.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando clientes..."
        emptyMessage={
          search
            ? 'Ningún cliente coincide con la búsqueda'
            : 'Sin clientes. Agrega el primero para comenzar.'
        }
        sort={sort}
        selectionResetKey={`${currentPage}|${search}`}
        bulkDelete={{
          deleteOne: (id) => apiService.deleteCustomer(id),
          onFinished: () => { refetch(); },
          entity: { singular: 'cliente', plural: 'clientes', gender: 'm' },
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

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <CustomersPageContent />
    </Suspense>
  );
}
