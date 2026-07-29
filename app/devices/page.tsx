'use client';

import React, { Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDevices } from '@/hooks/useDevices';
import { DeviceFilters } from '@/components/devices/DeviceFilters';
import { buildDeviceColumns } from '@/components/devices/deviceColumns';
import { apiService } from '@/services/api.service';
import {
  Button,
  DataTable,
  ErrorBanner,
  LoadingSpinner,
  PageHeader,
} from '@/components/ui';

function DevicesPageContent() {
  const router = useRouter();
  const {
    sortedDevices,
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

  const columns = useMemo(() => buildDeviceColumns(pollingStatuses), [pollingStatuses]);

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
        actions={<Button onClick={() => router.push('/devices/create')}>Agregar Dispositivo</Button>}
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
