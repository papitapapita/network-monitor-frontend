'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { QuotationDTO } from '@/types/quotation.types';
import { fetchAllCustomers } from '@/hooks/useCatalogs';
import {
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_VARIANTS,
  QUOTATION_STATUS_OPTIONS,
  formatCurrency,
} from '@/constants/quotation.constants';
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
const COLUMNS_STORAGE_KEY = 'nms:quotations-columns';

async function fetchAllQuotations(): Promise<QuotationDTO[]> {
  const all: QuotationDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listQuotations({ limit: 100, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar las cotizaciones');
    all.push(...r.data.quotations);
    hasMore = r.data.hasMore;
    offset += 100;
  }
  return all;
}

type QuotationColumn = DataTableColumn<QuotationDTO> & { label: string; locked?: boolean };

function quotationColumnCatalog(): QuotationColumn[] {
  return [
    {
      key: 'code',
      label: 'Código',
      locked: true,
      header: 'Código',
      sortValue: (q) => q.code ?? -1,
      cell: (q) => (
        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
          {q.code !== null ? `#${q.code}` : '—'}
        </span>
      ),
    },
    {
      key: 'customer',
      label: 'Cliente',
      locked: true,
      header: 'Cliente',
      sortValue: (q) => q.customerName,
      cellClassName: 'max-w-xs',
      cell: (q) => <span className="font-medium text-gray-900 dark:text-gray-100">{q.customerName}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      header: 'Estado',
      sortValue: (q) => QUOTATION_STATUS_LABELS[q.status],
      cell: (q) => (
        <Badge variant={QUOTATION_STATUS_VARIANTS[q.status]}>{QUOTATION_STATUS_LABELS[q.status]}</Badge>
      ),
    },
    {
      key: 'validUntil',
      label: 'Válida Hasta',
      header: 'Válida Hasta',
      sortValue: (q) => q.validUntil,
      className: 'hidden sm:table-cell',
      cell: (q) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(q.validUntil).toLocaleDateString('es')}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      header: 'Total',
      sortValue: (q) => q.total,
      cell: (q) => <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(q.total)}</span>,
    },
  ];
}

const QUOTATION_COLUMN_OPTIONS: PickableColumn[] = quotationColumnCatalog().map(
  ({ key, label, locked }) => ({ key, label, locked })
);
const DEFAULT_QUOTATION_COLUMNS = quotationColumnCatalog().map((c) => c.key);

export default function QuotationsPage() {
  const router = useRouter();

  const { get, getNumber, set } = useUrlState();
  const currentPage = getNumber('page', 1);
  const search = get('search', '');
  const statusFilter = get('status', '');
  const sort = useUrlTableSort({ get, set });

  const { data: quotations = [], isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['quotations'],
    queryFn: fetchAllQuotations,
  });
  // Kept warm for the create form's customer picker — same cache key it reads.
  useQuery({ queryKey: ['customers'], queryFn: fetchAllCustomers });

  const { visibleKeys, toggle, reset, isDefault } = useColumnVisibility(
    COLUMNS_STORAGE_KEY,
    DEFAULT_QUOTATION_COLUMNS
  );
  const columns = useMemo(
    () => quotationColumnCatalog().filter((c) => c.locked || visibleKeys.includes(c.key)),
    [visibleKeys]
  );

  const filtered = useMemo(() => {
    const rows = quotations.filter((q) => {
      if (statusFilter && q.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchesCode = q.code !== null && String(q.code).includes(s);
        if (!q.customerName.toLowerCase().includes(s) && !matchesCode) return false;
      }
      return true;
    });
    return sortRows(rows, quotationColumnCatalog(), sort.field, sort.direction);
  }, [quotations, statusFilter, search, sort.field, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  const hasFilters = !!(search || statusFilter);
  const clearFilters = () => set({ search: null, status: null, page: null });

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Cotizaciones"
        subtitle={
          quotations.length > 0
            ? `${quotations.length} ${quotations.length === 1 ? 'cotización' : 'cotizaciones'}`
            : 'Prepara y da seguimiento a propuestas comerciales'
        }
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          <>
            <ColumnPicker
              columns={QUOTATION_COLUMN_OPTIONS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onReset={reset}
              isDefault={isDefault}
            />
            <IconButton
              icon={<PlusIcon />}
              label="Nueva Cotización"
              variant="primary"
              size="md"
              onClick={() => router.push('/quotations/create')}
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
          placeholder: 'Cliente o código...',
          maxLength: 150,
        }}
      >
        <Select
          label="Estado"
          value={statusFilter}
          onChange={(e) => set({ status: e.target.value || null, page: null })}
          options={QUOTATION_STATUS_OPTIONS}
          fullWidth
        />
      </FilterBar>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(q) => q.id}
        onRowClick={(q) => router.push(`/quotations/${q.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando cotizaciones..."
        emptyMessage={
          hasFilters
            ? 'Ninguna cotización coincide con los filtros'
            : 'Sin cotizaciones. Crea la primera para comenzar.'
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
