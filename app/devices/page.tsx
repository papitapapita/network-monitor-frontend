'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDevices } from '@/hooks/useDevices';
import { DeviceFilters } from '@/components/devices/DeviceFilters';
import { DeviceTableRow } from '@/components/devices/DeviceTableRow';
import { apiService } from '@/services/api.service';
import {
  Table,
  TableEmptyState,
  Pagination,
  Button,
  LoadingSpinner,
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
  }, [currentPage, statusFilter, categoryFilter, connectivityFilter, search]);

  const handleSelectDevice = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allOnPageSelected =
    sortedDevices.length > 0 && sortedDevices.every((d) => selectedIds.has(d.id));
  const someOnPageSelected = !allOnPageSelected && sortedDevices.some((d) => selectedIds.has(d.id));

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      sortedDevices.forEach((d) => (checked ? next.add(d.id) : next.delete(d.id)));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    setBulkDeleteError(null);
    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => apiService.deleteDevice(id)));
    const failCount = results.filter((r) => !r.success).length;
    if (failCount > 0) {
      setBulkDeleteError(`${failCount} dispositivo(s) no se pudieron eliminar`);
    } else {
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
    }
    setBulkDeleting(false);
    fetchDevices();
  };

  const deviceCountLabel =
    totalDevices > 0
      ? `${totalDevices} ${totalDevices === 1 ? 'dispositivo' : 'dispositivos'} en total`
      : 'Administra tus dispositivos de red';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dispositivos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{deviceCountLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDevices()}
              isLoading={isFetching}
              disabled={isFetching}
            >
              {!isLoading && (
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
              Actualizar
            </Button>
            <Button onClick={() => router.push('/devices/create')}>Agregar Dispositivo</Button>
          </div>
          {lastRefreshed && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Actualizado: {lastRefreshed.toLocaleTimeString('es')}
            </span>
          )}
        </div>
      </div>

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

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchDevices()} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? 'dispositivo seleccionado' : 'dispositivos seleccionados'}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setSelectedIds(new Set()); setConfirmBulkDelete(false); }}>
              Deseleccionar
            </Button>
            {!confirmBulkDelete ? (
              <Button size="sm" variant="danger" onClick={() => setConfirmBulkDelete(true)}>
                Eliminar seleccionados
              </Button>
            ) : (
              <>
                <Button size="sm" variant="danger" onClick={handleBulkDelete} isLoading={bulkDeleting}>
                  Confirmar eliminación
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting}>
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {bulkDeleteError && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-400">
          {bulkDeleteError}
        </div>
      )}

      {isLoading && sortedDevices.length === 0 ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Cargando dispositivos..." />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <Table.Header>
              <th className="px-3 py-2 sm:px-6 sm:py-3 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={(el) => { if (el) el.indeterminate = someOnPageSelected; }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 cursor-pointer"
                />
              </th>
              <Table.Head sortable onSort={() => handleSort('name')} sortDirection={sortField === 'name' ? sortDirection : null}>Nombre</Table.Head>
              <Table.Head sortable onSort={() => handleSort('ip')} sortDirection={sortField === 'ip' ? sortDirection : null}>Dirección IP</Table.Head>
              <Table.Head sortable onSort={() => handleSort('connectivity')} sortDirection={sortField === 'connectivity' ? sortDirection : null} className="hidden md:table-cell">Conectividad</Table.Head>
              <Table.Head sortable onSort={() => handleSort('status')} sortDirection={sortField === 'status' ? sortDirection : null}>Estado</Table.Head>
              <Table.Head sortable onSort={() => handleSort('category')} sortDirection={sortField === 'category' ? sortDirection : null} className="hidden lg:table-cell">Categoría</Table.Head>
              <Table.Head sortable onSort={() => handleSort('owner')} sortDirection={sortField === 'owner' ? sortDirection : null} className="hidden lg:table-cell">Propietario</Table.Head>
              <Table.Head className="hidden sm:table-cell">Acciones</Table.Head>
            </Table.Header>
            <Table.Body>
              {sortedDevices.length === 0 ? (
                <TableEmptyState
                  message={
                    hasFilters
                      ? 'Ningún dispositivo coincide con los filtros'
                      : 'Sin dispositivos. Agrega el primero para comenzar.'
                  }
                />
              ) : (
                sortedDevices.map((device) => (
                  <DeviceTableRow
                    key={device.id}
                    device={device}
                    pollingStatuses={pollingStatuses}
                    selected={selectedIds.has(device.id)}
                    onSelect={handleSelectDevice}
                  />
                ))
              )}
            </Table.Body>
          </Table>

          {sortedDevices.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalDevices}
              itemsPerPage={limit}
              onPageChange={setCurrentPage}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={setLimit}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function DevicesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><span>Cargando...</span></div>}>
      <DevicesPageContent />
    </Suspense>
  );
}
