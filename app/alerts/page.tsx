'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api.service';
import { AlertDTO, AlertSeverity, AlertStatus } from '@/types/alert.types';
import {
  Table,
  TableEmptyState,
  Pagination,
  Button,
  Badge,
  LoadingSpinner,
  Select,
  Input,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';

const LIMIT = 50;

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  WARNING: 'Advertencia',
  CRITICAL: 'Crítico',
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
};

function getSeverityVariant(severity: AlertSeverity): BadgeVariant {
  return severity === 'CRITICAL' ? 'danger' : 'warning';
}

function getStatusVariant(status: AlertStatus): BadgeVariant {
  return status === 'OPEN' ? 'danger' : 'success';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(secs: number | null): string {
  if (secs === null) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

type SortColumn = 'severity' | 'status' | 'device' | 'startedAt' | 'resolvedAt' | 'durationSecs';
type SortDirection = 'asc' | 'desc';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deviceIdFilter, setDeviceIdFilter] = useState('');

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await apiService.listAlerts({
      limit: LIMIT,
      offset: (currentPage - 1) * LIMIT,
      deviceId: deviceIdFilter || undefined,
    });

    if (!result.success || !result.data) {
      setError(result.error || 'Error al cargar alertas');
      setIsLoading(false);
      return;
    }

    let rows = result.data.alerts;
    if (severityFilter) rows = rows.filter((a: AlertDTO) => a.severity === (severityFilter as AlertSeverity));
    if (statusFilter) rows = rows.filter((a: AlertDTO) => a.status === (statusFilter as AlertStatus));

    setAlerts(rows);
    setTotalAlerts(result.data.total);
    setTotalPages(Math.max(1, Math.ceil(result.data.total / LIMIT)));

    const uniqueIds = [...new Set(rows.map((a: AlertDTO) => a.deviceId))];
    const nameEntries = await Promise.all(
      uniqueIds.map(async (id) => {
        const res = await apiService.getDevice(id);
        return [id, res.success && res.data ? res.data.name : id] as [string, string];
      })
    );
    setDeviceNames(Object.fromEntries(nameEntries));
    setLastRefreshed(new Date());

    setIsLoading(false);
  }, [currentPage, severityFilter, statusFilter, deviceIdFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const clearFilters = () => {
    setSeverityFilter('');
    setStatusFilter('');
    setDeviceIdFilter('');
    setCurrentPage(1);
  };

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const sortedAlerts = React.useMemo(() => {
    if (!sortColumn) return alerts;
    return [...alerts].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'severity':
          cmp = a.severity.localeCompare(b.severity);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'device':
          cmp = (deviceNames[a.deviceId] ?? a.deviceId).localeCompare(deviceNames[b.deviceId] ?? b.deviceId);
          break;
        case 'startedAt':
          cmp = (a.startedAt ?? '').localeCompare(b.startedAt ?? '');
          break;
        case 'resolvedAt':
          if (!a.resolvedAt && !b.resolvedAt) cmp = 0;
          else if (!a.resolvedAt) cmp = 1;
          else if (!b.resolvedAt) cmp = -1;
          else cmp = a.resolvedAt.localeCompare(b.resolvedAt);
          break;
        case 'durationSecs':
          if (a.durationSecs === null && b.durationSecs === null) cmp = 0;
          else if (a.durationSecs === null) cmp = 1;
          else if (b.durationSecs === null) cmp = -1;
          else cmp = a.durationSecs - b.durationSecs;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [alerts, sortColumn, sortDirection, deviceNames]);

  const hasFilters = severityFilter || statusFilter || deviceIdFilter;

  const totalLabel = totalAlerts > 0
    ? `${totalAlerts} ${totalAlerts === 1 ? 'alerta' : 'alertas'} en total`
    : 'Sin alertas registradas';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Alertas</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{totalLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            isLoading={isLoading}
            disabled={isLoading}
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
          {lastRefreshed && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Actualizado: {lastRefreshed.toLocaleTimeString('es')}
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Severidad"
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'Todas las Severidades' },
              { value: 'WARNING', label: 'Advertencia' },
              { value: 'CRITICAL', label: 'Crítico' },
            ]}
            fullWidth
          />
          <Select
            label="Estado"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'Todos los Estados' },
              { value: 'OPEN', label: 'Abierta' },
              { value: 'RESOLVED', label: 'Resuelta' },
            ]}
            fullWidth
          />
          <Input
            label="ID de dispositivo"
            value={deviceIdFilter}
            onChange={(e) => { setDeviceIdFilter(e.target.value); setCurrentPage(1); }}
            placeholder="UUID del dispositivo"
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
          <Button variant="outline" size="sm" onClick={fetchAlerts} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Cargando alertas..." />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head sortable onSort={() => handleSort('severity')} sortDirection={sortColumn === 'severity' ? sortDirection : null}>Severidad</Table.Head>
              <Table.Head sortable onSort={() => handleSort('status')} sortDirection={sortColumn === 'status' ? sortDirection : null}>Estado</Table.Head>
              <Table.Head sortable onSort={() => handleSort('device')} sortDirection={sortColumn === 'device' ? sortDirection : null}>Dispositivo</Table.Head>
              <Table.Head sortable onSort={() => handleSort('startedAt')} sortDirection={sortColumn === 'startedAt' ? sortDirection : null}>Inicio</Table.Head>
              <Table.Head sortable onSort={() => handleSort('resolvedAt')} sortDirection={sortColumn === 'resolvedAt' ? sortDirection : null}>Resolución</Table.Head>
              <Table.Head sortable onSort={() => handleSort('durationSecs')} sortDirection={sortColumn === 'durationSecs' ? sortDirection : null}>Duración</Table.Head>
            </Table.Header>
            <Table.Body>
              {sortedAlerts.length === 0 ? (
                <TableEmptyState
                  message={
                    hasFilters
                      ? 'Ninguna alerta coincide con los filtros'
                      : 'No hay alertas registradas.'
                  }
                />
              ) : (
                sortedAlerts.map((alert) => (
                  <Table.Row key={alert.id}>
                    <Table.Cell>
                      <Badge variant={getSeverityVariant(alert.severity)}>
                        {SEVERITY_LABELS[alert.severity]}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={getStatusVariant(alert.status)}>
                        {STATUS_LABELS[alert.status]}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Link
                        href={`/devices/${alert.deviceId}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {deviceNames[alert.deviceId] ?? alert.deviceId}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(alert.startedAt)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(alert.resolvedAt)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {formatDuration(alert.durationSecs)}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>

          {alerts.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalAlerts}
              itemsPerPage={LIMIT}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
