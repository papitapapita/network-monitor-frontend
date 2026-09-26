'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CollectionAccountDTO } from '@/types/collection-account.types';
import { fetchAllCustomers } from '@/hooks/useCatalogs';
import {
  COLLECTION_ACCOUNT_STATUS_LABELS,
  COLLECTION_ACCOUNT_STATUS_VARIANTS,
  COLLECTION_ACCOUNT_STATUS_OPTIONS,
  collectionAccountLabel,
} from '@/constants/collection-account.constants';
import { formatCurrency } from '@/constants/quotation.constants';
import { useUrlState, useUrlTableSort } from '@/hooks/useUrlState';
import {
  Badge,
  ColumnPicker,
  DataTable,
  ErrorBanner,
  FilterBar,
  IconButton,
  PageHeader,
  PlusIcon,
  Select,
  sortRows,
  useColumnVisibility,
} from '@/components/ui';
import type { DataTableColumn, PickableColumn } from '@/components/ui';

const LIMIT = 20;
const COLUMNS_STORAGE_KEY = 'nms:collection-accounts-columns';

async function fetchAllCollectionAccounts(): Promise<CollectionAccountDTO[]> {
  const all: CollectionAccountDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listCollectionAccounts({ limit: 100, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar las cuentas de cobro');
    all.push(...r.data.collectionAccounts);
    hasMore = r.data.hasMore;
    offset += 100;
  }
  return all;
}

type CollectionAccountColumn = DataTableColumn<CollectionAccountDTO> & { label: string; locked?: boolean };

function collectionAccountColumnCatalog(): CollectionAccountColumn[] {
  return [
    {
      key: 'number',
      label: 'Número',
      locked: true,
      header: 'Número',
      sortValue: (ca) => ca.code ?? -1,
      cell: (ca) => (
        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{collectionAccountLabel(ca)}</span>
      ),
    },
    {
      key: 'customer',
      label: 'Cliente',
      locked: true,
      header: 'Cliente',
      sortValue: (ca) => ca.customerName,
      cellClassName: 'max-w-xs',
      cell: (ca) => <span className="font-medium text-gray-900 dark:text-gray-100">{ca.customerName}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      header: 'Estado',
      sortValue: (ca) => COLLECTION_ACCOUNT_STATUS_LABELS[ca.status],
      cell: (ca) => (
        <Badge variant={COLLECTION_ACCOUNT_STATUS_VARIANTS[ca.status]}>
          {COLLECTION_ACCOUNT_STATUS_LABELS[ca.status]}
        </Badge>
      ),
    },
    {
      key: 'issueDate',
      label: 'Emisión',
      header: 'Emisión',
      sortValue: (ca) => ca.issueDate,
      className: 'hidden sm:table-cell',
      cell: (ca) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(ca.issueDate).toLocaleDateString('es')}
        </span>
      ),
    },
    {
      key: 'dueDate',
      label: 'Vence',
      header: 'Vence',
      sortValue: (ca) => ca.dueDate ?? '',
      className: 'hidden md:table-cell',
      cell: (ca) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {ca.dueDate ? new Date(ca.dueDate).toLocaleDateString('es') : '—'}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      header: 'Total',
      sortValue: (ca) => ca.total,
      cell: (ca) => <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(ca.total)}</span>,
    },
  ];
}

const COLLECTION_ACCOUNT_COLUMN_OPTIONS: PickableColumn[] = collectionAccountColumnCatalog().map(
  ({ key, label, locked }) => ({ key, label, locked })
);
const DEFAULT_COLLECTION_ACCOUNT_COLUMNS = collectionAccountColumnCatalog().map((c) => c.key);

export default function CollectionAccountsPage() {
  const router = useRouter();

  const { get, getNumber, set } = useUrlState();
  const currentPage = getNumber('page', 1);
  const search = get('search', '');
  const statusFilter = get('status', '');
  const sort = useUrlTableSort({ get, set });

  const { data: accounts = [], isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['collectionAccounts'],
    queryFn: fetchAllCollectionAccounts,
  });
  // Kept warm for the create form's customer picker — same cache key it reads.
  useQuery({ queryKey: ['customers'], queryFn: fetchAllCustomers });

  const { visibleKeys, toggle, reset, isDefault } = useColumnVisibility(
    COLUMNS_STORAGE_KEY,
    DEFAULT_COLLECTION_ACCOUNT_COLUMNS
  );
  const columns = useMemo(
    () => collectionAccountColumnCatalog().filter((c) => c.locked || visibleKeys.includes(c.key)),
    [visibleKeys]
  );

  const filtered = useMemo(() => {
    const rows = accounts.filter((ca) => {
      if (statusFilter && ca.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchesNumber = collectionAccountLabel(ca).toLowerCase().includes(s);
        const matchesDocument = !!ca.customerDocument?.toLowerCase().includes(s);
        if (!ca.customerName.toLowerCase().includes(s) && !matchesNumber && !matchesDocument) return false;
      }
      return true;
    });
    return sortRows(rows, collectionAccountColumnCatalog(), sort.field, sort.direction);
  }, [accounts, statusFilter, search, sort.field, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  const hasFilters = !!(search || statusFilter);
  const clearFilters = () => set({ search: null, status: null, page: null });

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Cuentas de Cobro"
        subtitle={
          accounts.length > 0
            ? `${accounts.length} ${accounts.length === 1 ? 'cuenta de cobro' : 'cuentas de cobro'}`
            : 'Cobra trabajos puntuales fuera del servicio de internet'
        }
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          <>
            <ColumnPicker
              columns={COLLECTION_ACCOUNT_COLUMN_OPTIONS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onReset={reset}
              isDefault={isDefault}
            />
            <IconButton
              icon={<PlusIcon />}
              label="Nueva Cuenta de Cobro"
              variant="primary"
              size="md"
              onClick={() => router.push('/collection-accounts/create')}
            />
          </>
        }
      />

      <FilterBar
        columns={2}
        hasFilters={hasFilters}
        onClear={clearFilters}
        search={{
          value: search,
          onChange: (value) => set({ search: value || null, page: null }),
          placeholder: 'Cliente, cédula o número...',
          maxLength: 150,
        }}
      >
        <Select
          label="Estado"
          value={statusFilter}
          onChange={(e) => set({ status: e.target.value || null, page: null })}
          options={COLLECTION_ACCOUNT_STATUS_OPTIONS}
          fullWidth
        />
      </FilterBar>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(ca) => ca.id}
        onRowClick={(ca) => router.push(`/collection-accounts/${ca.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando cuentas de cobro..."
        emptyMessage={
          hasFilters
            ? 'Ninguna cuenta de cobro coincide con los filtros'
            : 'Sin cuentas de cobro. Crea la primera para comenzar.'
        }
        sort={sort}
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
