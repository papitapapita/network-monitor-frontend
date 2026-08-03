'use client';

import React, { Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDevices } from '@/hooks/useDevices';
import { useDeviceLookups } from '@/hooks/useCatalogs';
import { DeviceFilters } from '@/components/devices/DeviceFilters';
import {
  buildDeviceColumns,
  DEFAULT_DEVICE_COLUMNS,
  DEVICE_COLUMN_OPTIONS,
  LOOKUP_DEVICE_COLUMNS,
} from '@/components/devices/deviceColumns';
import { apiService } from '@/services/api.service';
import {
  Button,
  ColumnPicker,
  DataTable,
  ErrorBanner,
  LoadingSpinner,
  PageHeader,
  sortRows,
  useColumnVisibility,
} from '@/components/ui';

const COLUMNS_STORAGE_KEY = 'nms:devices-columns';

function DevicesPageContent() {
  const router = useRouter();
  const {
    devices,
    pollingStatuses,
    isLoading,
    isFetching,
    error,
    currentPage,
    totalPages,
    totalDevices,
    lastRefreshed,
    statusFilter,
    categoryFilter,
    connectivityFilter,
    search,
    sortField,
    sortDirection,
    hasFilters,
    setStatusFilter,
    setCategoryFilter,
    setConnectivityFilter,
    setSearch,
    setCurrentPage,
    handleSort,
    clearFilters,
    fetchDevices,
    limit,
    setLimit,
    PAGE_SIZE_OPTIONS,
  } = useDevices();

  const { visibleKeys, toggle, reset, isDefault } = useColumnVisibility(
    COLUMNS_STORAGE_KEY,
    DEFAULT_DEVICE_COLUMNS
  );

  const lookups = useDeviceLookups(LOOKUP_DEVICE_COLUMNS.some((k) => visibleKeys.includes(k)));

  const columns = useMemo(
    () => buildDeviceColumns({ pollingStatuses, lookups, visibleKeys }),
    [pollingStatuses, lookups, visibleKeys]
  );

  const sortedDevices = useMemo(
    () => sortRows(devices, columns, sortField, sortDirection),
    [devices, columns, sortField, sortDirection]
  );

  const deviceCountLabel =
    totalDevices > 0
      ? `${totalDevices} ${totalDevices === 1 ? 'dispositivo' : 'dispositivos'} en total`
      : 'Administra tus dispositivos de red';

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Dispositivos"
        subtitle={deviceCountLabel}
        onRefresh={() => fetchDevices()}
        isRefreshing={isFetching}
        lastRefreshed={lastRefreshed}
        actions={
          <>
            <ColumnPicker
              columns={DEVICE_COLUMN_OPTIONS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onReset={reset}
              isDefault={isDefault}
            />
            <Button onClick={() => router.push('/devices/create')}>Agregar Dispositivo</Button>
          </>
        }
      />

      <DeviceFilters
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        connectivityFilter={connectivityFilter}
        search={search}
        hasFilters={hasFilters}
        onStatusChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
        onCategoryChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}
        onConnectivityChange={(v) => { setConnectivityFilter(v); setCurrentPage(1); }}
        onSearchChange={(v) => { setSearch(v); setCurrentPage(1); }}
        onClear={clearFilters}
      />

      {error && <ErrorBanner message={error} onRetry={() => fetchDevices()} />}

      <DataTable
        columns={columns}
        rows={sortedDevices}
        getRowId={(d) => d.id}
        getRowLabel={(d) => d.name}
        onRowClick={(d) => router.push(`/devices/${d.id}`)}
        isLoading={isLoading && sortedDevices.length === 0}
        loadingMessage="Cargando dispositivos..."
        emptyMessage={
          hasFilters
            ? 'Ningún dispositivo coincide con los filtros'
            : 'Sin dispositivos. Agrega el primero para comenzar.'
        }
        sort={{ field: sortField, direction: sortDirection, onSort: handleSort }}
        selectionResetKey={`${currentPage}|${statusFilter}|${categoryFilter}|${connectivityFilter}|${search}`}
        bulkDelete={{
          deleteOne: (id) => apiService.deleteDevice(id),
          onFinished: () => { fetchDevices(); },
          entity: { singular: 'dispositivo', plural: 'dispositivos', gender: 'm' },
        }}
        pagination={{
          currentPage,
          totalPages,
          totalItems: totalDevices,
          itemsPerPage: limit,
          onPageChange: setCurrentPage,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onPageSizeChange: setLimit,
        }}
      />
    </div>
  );
}

export default function DevicesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <DevicesPageContent />
    </Suspense>
  );
}
