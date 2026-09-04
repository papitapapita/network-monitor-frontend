'use client';

import React, { useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { TechnicianDTO } from '@/types/technician.types';
import { fetchAllTechnicians } from '@/hooks/useCatalogs';
import { useAuth } from '@/contexts/auth.context';
import { useUrlState, useUrlTableSort } from '@/hooks/useUrlState';
import {
  TECHNICIAN_ACTIVE_FILTER_OPTIONS,
  technicianActiveLabel,
  technicianActiveVariant,
} from '@/constants/technician.constants';
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
const COLUMNS_STORAGE_KEY = 'nms:technicians-columns';

type TechnicianColumn = DataTableColumn<TechnicianDTO> & { label: string; locked?: boolean };

const TECHNICIAN_COLUMN_CATALOG: TechnicianColumn[] = [
  {
    key: 'fullName',
    label: 'Nombre',
    locked: true,
    header: 'Nombre',
    sortValue: (t) => t.fullName,
    cellClassName: 'max-w-xs',
    cell: (t) => <span className="font-medium text-gray-900 dark:text-gray-100">{t.fullName}</span>,
  },
  {
    key: 'phone',
    label: 'Teléfono',
    header: 'Teléfono',
    sortValue: (t) => t.phone,
    cell: (t) => <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{t.phone}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    header: 'Email',
    sortValue: (t) => t.email,
    className: 'hidden md:table-cell',
    cell: (t) => <span className="text-gray-600 dark:text-gray-400 text-sm">{t.email ?? '—'}</span>,
  },
  {
    key: 'isActive',
    label: 'Estado',
    header: 'Estado',
    sortValue: (t) => technicianActiveLabel(t.isActive),
    cell: (t) => (
      <Badge variant={technicianActiveVariant(t.isActive)}>{technicianActiveLabel(t.isActive)}</Badge>
    ),
  },
  {
    key: 'createdAt',
    label: 'Registrado',
    header: 'Registrado',
    sortValue: (t) => t.createdAt,
    className: 'hidden lg:table-cell',
    cell: (t) => (
      <span className="text-gray-600 dark:text-gray-400 text-sm">
        {new Date(t.createdAt).toLocaleDateString('es')}
      </span>
    ),
  },
];

const TECHNICIAN_COLUMN_OPTIONS: PickableColumn[] = TECHNICIAN_COLUMN_CATALOG.map(
  ({ key, label, locked }) => ({ key, label, locked })
);
const DEFAULT_TECHNICIAN_COLUMNS = TECHNICIAN_COLUMN_CATALOG.map((c) => c.key);

function TechniciansPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR';
  const isAdmin = user?.role === 'ADMIN';

  const { get, getNumber, set } = useUrlState();
  const currentPage = getNumber('page', 1);
  const search = get('search', '');
  const activeFilter = get('active', '');
  const sort = useUrlTableSort({ get, set });
  const { visibleKeys, toggle, reset, isDefault } = useColumnVisibility(
    COLUMNS_STORAGE_KEY,
    DEFAULT_TECHNICIAN_COLUMNS
  );
  const columns = useMemo(
    () => TECHNICIAN_COLUMN_CATALOG.filter((c) => c.locked || visibleKeys.includes(c.key)),
    [visibleKeys]
  );

  // The rota is a few dozen people at most, and the assignment pickers want the
  // whole list anyway — so one cached query serves this page, the ticket form
  // and the assign modal alike.
  const { data: all = [], isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['technicians'],
    queryFn: fetchAllTechnicians,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = all;
    // `activeOnly` is a server parameter, but filtering here keeps the shared
    // ['technicians'] cache intact for every other consumer.
    if (activeFilter === 'true') rows = rows.filter((t) => t.isActive);
    if (search) {
      rows = rows.filter(
        (t) =>
          t.fullName.toLowerCase().includes(q) ||
          t.phone.includes(search) ||
          (t.email ?? '').toLowerCase().includes(q)
      );
    }
    return sortRows(rows, TECHNICIAN_COLUMN_CATALOG, sort.field, sort.direction);
  }, [all, search, activeFilter, sort.field, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Técnicos"
        subtitle={
          all.length > 0
            ? `${all.length} ${all.length === 1 ? 'técnico' : 'técnicos'} en total`
            : 'Los trabajadores de campo a los que se despachan los tickets'
        }
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          <>
            <ColumnPicker
              columns={TECHNICIAN_COLUMN_OPTIONS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onReset={reset}
              isDefault={isDefault}
            />
            {canWrite && (
              <IconButton
                icon={<PlusIcon />}
                label="Agregar Técnico"
                variant="primary"
                size="md"
                onClick={() => router.push('/technicians/create')}
              />
            )}
          </>
        }
      />

      <FilterBar
        columns={2}
        hasFilters={!!(search || activeFilter)}
        onClear={() => set({ search: null, active: null, page: null })}
        secondaryFiltersActive={!!activeFilter}
        search={{
          value: search,
          onChange: (value) => set({ search: value || null, page: null }),
          placeholder: 'Nombre, teléfono o email...',
          maxLength: 150,
        }}
      >
        <Select
          label="Estado"
          value={activeFilter}
          onChange={(e) => set({ active: e.target.value || null, page: null })}
          options={TECHNICIAN_ACTIVE_FILTER_OPTIONS}
          fullWidth
        />
      </FilterBar>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(t) => t.id}
        getRowLabel={(t) => t.fullName}
        onRowClick={(t) => router.push(`/technicians/${t.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando técnicos..."
        emptyMessage={
          search || activeFilter
            ? 'Ningún técnico coincide con los filtros'
            : 'Sin técnicos. Agrega el primero para poder despachar tickets.'
        }
        sort={sort}
        selectionResetKey={`${currentPage}|${search}|${activeFilter}`}
        bulkDelete={
          isAdmin
            ? {
                deleteOne: (id) => apiService.deleteTechnician(id),
                onFinished: () => {
                  refetch();
                },
                entity: { singular: 'técnico', plural: 'técnicos', gender: 'm' },
                // No `canDelete` predicate: whether a technician has ever held a
                // ticket is not knowable from this list. The backend refuses
                // those, and the per-row failure carries the translated reason.
              }
            : undefined
        }
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

export default function TechniciansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      }
    >
      <TechniciansPageContent />
    </Suspense>
  );
}
