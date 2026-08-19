'use client';

import React, { Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useDevices } from '@/hooks/useDevices';
import { useDeviceLookups } from '@/hooks/useCatalogs';
import { apiService } from '@/services/api.service';
import { DeviceFilters } from '@/components/devices/DeviceFilters';
import {
  buildDeviceColumns,
  DEFAULT_DEVICE_COLUMNS,
  DEVICE_COLUMN_OPTIONS,
  LOOKUP_DEVICE_COLUMNS,
} from '@/components/devices/deviceColumns';
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
import { RESTORE_GRACE_DAYS } from '@/constants/device.constants';

const COLUMNS_STORAGE_KEY = 'nms:devices-columns';

const deviceCount = (n: number) => `${n} ${n === 1 ? 'dispositivo' : 'dispositivos'}`;

function TrashIcon() {
  return (
    <svg
      className="mr-1.5 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

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
    locationFilter,
    search,
    sortField,
    sortDirection,
    hasFilters,
    setStatusFilter,
    setCategoryFilter,
    setConnectivityFilter,
    setLocationFilter,
    setSearch,
    setCurrentPage,
    handleSort,
    clearFilters,
    fetchDevices,
    limit,
    setLimit,
    PAGE_SIZE_OPTIONS,
  } = useDevices();

  const { data: filteredLocation } = useQuery({
    queryKey: ['location', locationFilter],
    queryFn: async () => {
      const result = await apiService.getLocation(locationFilter);
      return result.success ? result.data : null;
    },
    enabled: !!locationFilter,
  });

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
            <Button variant="outline" onClick={() => router.push('/devices/trash')}>
              <TrashIcon />
              Papelera
            </Button>
            <Button onClick={() => router.push('/devices/create')}>Agregar Dispositivo</Button>
          </>
        }
      />

      {locationFilter && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-700 dark:text-gray-300">
          <span>
            Mostrando dispositivos de{' '}
            <span className="font-medium">{filteredLocation ? filteredLocation.name : 'esta ubicación'}</span>
          </span>
          <button
            type="button"
            onClick={() => { setLocationFilter(''); setCurrentPage(1); }}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Quitar filtro
          </button>
        </div>
      )}

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
          undoOne: (id) => apiService.restoreDevice(id),
          onFinished: () => { fetchDevices(); },
          entity: { singular: 'dispositivo', plural: 'dispositivos', gender: 'm' },
          confirmNote: `Saldrán de todos los listados y dejarán de monitorearse, pero podrás restaurarlos durante ${RESTORE_GRACE_DAYS} días desde la papelera.`,
          bulkActions: [
            {
              key: 'poll',
              label: 'Sondear',
              confirmTitle: 'Sondear dispositivos',
              confirmMessage: (n) =>
                `¿Sondear ${deviceCount(n)} ahora? Cada uno recibe un ping inmediato y el resultado queda en su historial; la tabla se actualiza al terminar.`,
              confirmText: 'Sondear',
              doneParticiple: 'sondead',
              progressVerb: 'Sondeando',
              // The backend refuses a device nobody is watching (409): the reading
              // would sit there with nothing scheduled to correct it. Say so up
              // front instead of collecting one error per row.
              skipRow: (device) =>
                device.monitoringEnabled ? null : 'monitoreo deshabilitado',
              runOne: (id) => apiService.triggerPoll(id),
            },
          ],
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
