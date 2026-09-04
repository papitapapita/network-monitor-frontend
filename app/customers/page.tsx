'use client';

import React, { useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CustomerDTO } from '@/types/customer.types';
import { fetchAllCustomers } from '@/hooks/useCatalogs';
import { useUrlState, useUrlTableSort } from '@/hooks/useUrlState';
import {
  ColumnPicker,
  DataTable,
  ErrorBanner,
  FilterBar,
  IconButton,
  LoadingSpinner,
  PageHeader,
  PlusIcon,
  sortRows,
  useColumnVisibility,
} from '@/components/ui';
import type { DataTableColumn, PickableColumn } from '@/components/ui';

const LIMIT = 20;
const COLUMNS_STORAGE_KEY = 'nms:customers-columns';

type CustomerColumn = DataTableColumn<CustomerDTO> & { label: string; locked?: boolean };

const CUSTOMER_COLUMN_CATALOG: CustomerColumn[] = [
  {
    key: 'fullName',
    label: 'Nombre',
    locked: true,
    header: 'Nombre',
    sortValue: (c) => c.fullName,
    cellClassName: 'max-w-xs',
    cell: (c) => <span className="font-medium text-gray-900 dark:text-gray-100">{c.fullName}</span>,
  },
  {
    key: 'phone',
    label: 'Teléfono',
    header: 'Teléfono',
    sortValue: (c) => c.phone,
    cell: (c) => <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{c.phone}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    header: 'Email',
    sortValue: (c) => c.email,
    className: 'hidden md:table-cell',
    cell: (c) => <span className="text-gray-600 dark:text-gray-400 text-sm">{c.email ?? '—'}</span>,
  },
  {
    key: 'cedula',
    label: 'Cédula',
    header: 'Cédula',
    sortValue: (c) => c.cedula,
    className: 'hidden sm:table-cell',
    cell: (c) => <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{c.cedula ?? '—'}</span>,
  },
];

const CUSTOMER_COLUMN_OPTIONS: PickableColumn[] = CUSTOMER_COLUMN_CATALOG.map(
  ({ key, label, locked }) => ({ key, label, locked })
);
const DEFAULT_CUSTOMER_COLUMNS = CUSTOMER_COLUMN_CATALOG.map((c) => c.key);

function CustomersPageContent() {
  const router = useRouter();
  const { get, getNumber, set } = useUrlState();
  const currentPage = getNumber('page', 1);
  const search = get('search', '');
  const sort = useUrlTableSort({ get, set });
  const { visibleKeys, toggle, reset, isDefault } = useColumnVisibility(
    COLUMNS_STORAGE_KEY,
    DEFAULT_CUSTOMER_COLUMNS
  );
  const columns = useMemo(
    () => CUSTOMER_COLUMN_CATALOG.filter((c) => c.locked || visibleKeys.includes(c.key)),
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
    return sortRows(rows, CUSTOMER_COLUMN_CATALOG, sort.field, sort.direction);
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
        actions={
          <>
            <ColumnPicker
              columns={CUSTOMER_COLUMN_OPTIONS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onReset={reset}
              isDefault={isDefault}
            />
            <IconButton
              icon={<PlusIcon />}
              label="Agregar Cliente"
              variant="primary"
              size="md"
              onClick={() => router.push('/customers/create')}
            />
          </>
        }
      />

      <FilterBar
        hasFilters={!!search}
        onClear={() => set({ search: null, page: null })}
        search={{
          value: search,
          onChange: (value) => set({ search: value || null, page: null }),
          placeholder: 'Nombre, teléfono, email o cédula...',
          maxLength: 150,
        }}
      />

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
          onPageChange: (page) => set({ page: page === 1 ? null : page }),
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
