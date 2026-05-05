'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  DeviceResponseDTO,
  ListDevicesQuery,
  DeviceStatus,
  DeviceCategory,
  PollingStatus,
} from '@/types/device.types';
import {
  Table,
  TableEmptyState,
  Pagination,
  Button,
  Badge,
  LoadingSpinner,
  Select,
  Input,
  getDeviceStatusBadgeVariant,
  getPollingStatusBadgeVariant,
} from '@/components/ui';

const LIMIT = 20;

const STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: 'Activo',
  INVENTORY: 'Inventario',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED: 'Dañado',
  DECOMMISSIONED: 'Descomisionado',
};

const CONNECTIVITY_LABELS: Record<string, string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Desconectado',
  UNKNOWN: 'Desconocido',
};

function DevicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [devices, setDevices] = useState<DeviceResponseDTO[]>([]);
  const [pollingStatuses, setPollingStatuses] = useState<Record<string, PollingStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [connectivityFilter, setConnectivityFilter] = useState(
    () => searchParams.get('connectivity') ?? ''
  );
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (connectivityFilter) {
      const allResult = await apiService.listDevices({ limit: 300 });
      if (!allResult.success || !allResult.data) {
        setError(allResult.error || 'Error al cargar dispositivos');
        setIsLoading(false);
        return;
      }

      const allDevices = allResult.data.devices;
      const monitoredDevices = allDevices.filter((d) => d.monitoringEnabled);
      const statusResults = await Promise.all(
        monitoredDevices.map((d) => apiService.getPollingStatus(d.id))
      );

      const statusMap: Record<string, PollingStatus> = {};
      monitoredDevices.forEach((d, i) => {
        statusMap[d.id] =
          statusResults[i].success && statusResults[i].data
            ? statusResults[i].data!.currentStatus
            : 'UNKNOWN';
      });

      let filtered = allDevices.filter((d) => statusMap[d.id] === connectivityFilter);
      if (statusFilter) filtered = filtered.filter((d) => d.status === (statusFilter as DeviceStatus));
      if (categoryFilter) filtered = filtered.filter((d) => d.category === (categoryFilter as DeviceCategory));
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.ipAddress?.toLowerCase().includes(q) ||
            d.macAddress?.toLowerCase().includes(q) ||
            d.serialNumber?.toLowerCase().includes(q)
        );
      }

      const total = filtered.length;
      const offset = (currentPage - 1) * LIMIT;
      setDevices(filtered.slice(offset, offset + LIMIT));
      setPollingStatuses(statusMap);
      setTotalDevices(total);
      setTotalPages(Math.max(1, Math.ceil(total / LIMIT)));
    } else {
      const query: ListDevicesQuery = {
        limit: LIMIT,
        offset: (currentPage - 1) * LIMIT,
      };
      if (statusFilter) query.status = statusFilter as DeviceStatus;
      if (categoryFilter) query.category = categoryFilter as DeviceCategory;
      if (search) query.search = search;

      const result = await apiService.listDevices(query);
      if (!result.success || !result.data) {
        setError(result.error || 'Error al cargar dispositivos');
        setIsLoading(false);
        return;
      }

      const pageDevices = result.data.devices;
      setDevices(pageDevices);
      setTotalDevices(result.data.total);
      setTotalPages(Math.max(1, Math.ceil(result.data.total / LIMIT)));

      const monDevices = pageDevices.filter((d) => d.monitoringEnabled);
      if (monDevices.length > 0) {
        const statusResults = await Promise.all(
          monDevices.map((d) => apiService.getPollingStatus(d.id))
        );
        const statusMap: Record<string, PollingStatus> = {};
        monDevices.forEach((d, i) => {
          if (statusResults[i].success && statusResults[i].data) {
            statusMap[d.id] = statusResults[i].data!.currentStatus;
          }
        });
        setPollingStatuses(statusMap);
      } else {
        setPollingStatuses({});
      }
    }

    setIsLoading(false);
  }, [currentPage, statusFilter, categoryFilter, connectivityFilter, search]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setConnectivityFilter('');
    setSearch('');
    setCurrentPage(1);
  };

  const hasFilters = statusFilter || categoryFilter || connectivityFilter || search;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedDevices = sortField
    ? [...devices].sort((a, b) => {
        let aVal: string;
        let bVal: string;
        if (sortField === 'name') {
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
        } else if (sortField === 'status') {
          aVal = a.status;
          bVal = b.status;
        } else if (sortField === 'category') {
          aVal = a.category ?? '';
          bVal = b.category ?? '';
        } else if (sortField === 'owner') {
          aVal = a.ownerType;
          bVal = b.ownerType;
        } else if (sortField === 'ip') {
          aVal = a.ipAddress ?? '';
          bVal = b.ipAddress ?? '';
        } else {
          return 0;
        }
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      })
    : devices;

  const deviceCountLabel = totalDevices > 0
    ? `${totalDevices} ${totalDevices === 1 ? 'dispositivo' : 'dispositivos'} en total`
    : 'Administra tus dispositivos de red';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dispositivos</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{deviceCountLabel}</p>
        </div>
        <Button onClick={() => router.push('/devices/create')}>Agregar Dispositivo</Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select
            label="Estado"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'Todos los Estados' },
              { value: 'INVENTORY', label: 'Inventario' },
              { value: 'ACTIVE', label: 'Activo' },
              { value: 'MAINTENANCE', label: 'Mantenimiento' },
              { value: 'DAMAGED', label: 'Dañado' },
              { value: 'DECOMMISSIONED', label: 'Descomisionado' },
            ]}
            fullWidth
          />
          <Select
            label="Categoría"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'Todas las Categorías' },
              { value: 'CORE', label: 'Núcleo' },
              { value: 'DISTRIBUTION', label: 'Distribución' },
              { value: 'POE', label: 'PoE' },
              { value: 'ACCESS_POINT', label: 'Punto de Acceso' },
              { value: 'CLIENT_CPE', label: 'CPE Cliente' },
            ]}
            fullWidth
          />
          <Select
            label="Conectividad"
            value={connectivityFilter}
            onChange={(e) => { setConnectivityFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'Todos' },
              { value: 'ONLINE', label: 'En línea' },
              { value: 'OFFLINE', label: 'Desconectado' },
              { value: 'UNKNOWN', label: 'Desconocido' },
            ]}
            fullWidth
          />
          <Input
            label="Buscar"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Nombre, IP, MAC, serie..."
            fullWidth
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              fullWidth
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDevices} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Cargando dispositivos..." />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head sortable onSort={() => handleSort('name')} sortDirection={sortField === 'name' ? sortDirection : null}>Nombre</Table.Head>
              <Table.Head sortable onSort={() => handleSort('status')} sortDirection={sortField === 'status' ? sortDirection : null}>Estado</Table.Head>
              <Table.Head>Conectividad</Table.Head>
              <Table.Head sortable onSort={() => handleSort('category')} sortDirection={sortField === 'category' ? sortDirection : null}>Categoría</Table.Head>
              <Table.Head sortable onSort={() => handleSort('owner')} sortDirection={sortField === 'owner' ? sortDirection : null}>Propietario</Table.Head>
              <Table.Head sortable onSort={() => handleSort('ip')} sortDirection={sortField === 'ip' ? sortDirection : null}>Dirección IP</Table.Head>
              <Table.Head>Acciones</Table.Head>
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
                  <Table.Row
                    key={device.id}
                    onClick={() => router.push(`/devices/${device.id}`)}
                  >
                    <Table.Cell>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{device.name}</div>
                      {device.serialNumber && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{device.serialNumber}</div>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
                        {STATUS_LABELS[device.status] ?? device.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {device.monitoringEnabled ? (
                        pollingStatuses[device.id] ? (
                          <Badge variant={getPollingStatusBadgeVariant(pollingStatuses[device.id])}>
                            {CONNECTIVITY_LABELS[pollingStatuses[device.id]] ?? pollingStatuses[device.id]}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>
                        )
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">No monitoreado</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {device.category ? (
                        <span className="text-gray-900 dark:text-gray-100">
                          {device.category.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-900 dark:text-gray-100">
                        {device.ownerType === 'COMPANY' ? 'Empresa' : 'Cliente'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-sm">
                        {device.ipAddress || <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/devices/${device.id}`);
                        }}
                      >
                        Ver
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>

          {devices.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalDevices}
              itemsPerPage={LIMIT}
              onPageChange={setCurrentPage}
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
