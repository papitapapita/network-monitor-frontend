'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import {
  AlertDTO,
  AlertSeverity,
  AlertStatus,
  isDeviceUnreachable,
  isWirelessAlert,
} from '@/types/alert.types';
import {
  Badge,
  Button,
  ConfirmModal,
  DataTable,
  ErrorBanner,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui';
import type { BadgeVariant, DataTableColumn } from '@/components/ui';

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

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Alerts recorded before `description` existed come back with an empty string. */
function describe(alert: AlertDTO): string {
  return alert.description || alert.type;
}

type SortColumn = 'severity' | 'status' | 'source' | 'description' | 'device' | 'startedAt' | 'durationSecs';
type SortDirection = 'asc' | 'desc';

/**
 * The page sorts the rows itself — device names live outside the DTO and
 * `durationSecs` is nullable — so the columns only declare that they sort.
 */
function buildAlertColumns(deviceNames: Record<string, string>): DataTableColumn<AlertDTO>[] {
  return [
    {
      key: 'severity',
      header: 'Severidad',
      sortable: true,
      cell: (a) => <Badge variant={getSeverityVariant(a.severity)}>{SEVERITY_LABELS[a.severity]}</Badge>,
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      cell: (a) => <Badge variant={getStatusVariant(a.status)}>{STATUS_LABELS[a.status]}</Badge>,
    },
    {
      key: 'source',
      header: 'Origen',
      sortable: true,
      className: 'hidden lg:table-cell',
      cell: (a) => <span className="text-sm text-gray-700 dark:text-gray-300">{a.source}</span>,
    },
    {
      key: 'description',
      header: 'Descripción',
      sortable: true,
      cell: (a) => (
        <span
          className="block max-w-xs truncate text-sm text-gray-700 dark:text-gray-300"
          title={describe(a)}
        >
          {describe(a)}
        </span>
      ),
    },
    {
      key: 'device',
      header: 'Dispositivo',
      sortable: true,
      cell: (a) => (
        <Link
          href={`/devices/${a.deviceId}`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {deviceNames[a.deviceId] ?? a.deviceId}
        </Link>
      ),
    },
    {
      key: 'startedAt',
      header: 'Inicio',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: (a) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{formatDate(a.startedAt)}</span>
      ),
    },
    {
      key: 'durationSecs',
      header: 'Duración',
      sortable: true,
      className: 'hidden sm:table-cell',
      cell: (a) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{formatDuration(a.durationSecs)}</span>
      ),
    },
  ];
}

export default function AlertsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

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
  const [sourceFilter, setSourceFilter] = useState('');
  const [deviceIdFilter, setDeviceIdFilter] = useState('');
  // Sources present in the fetched page — the backend exposes no source filter,
  // so the options list can only reflect what we already have.
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [detailAlert, setDetailAlert] = useState<AlertDTO | null>(null);
  const [isRefreshingDetail, setIsRefreshingDetail] = useState(false);

  const [alertToDelete, setAlertToDelete] = useState<AlertDTO | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

    const fetched = result.data.alerts;
    setSourceOptions([...new Set(fetched.map((a: AlertDTO) => a.source))].sort());

    let rows = fetched;
    if (severityFilter) rows = rows.filter((a: AlertDTO) => a.severity === (severityFilter as AlertSeverity));
    if (statusFilter) rows = rows.filter((a: AlertDTO) => a.status === (statusFilter as AlertStatus));
    if (sourceFilter) rows = rows.filter((a: AlertDTO) => a.source === sourceFilter);

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
  }, [currentPage, severityFilter, statusFilter, sourceFilter, deviceIdFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const clearFilters = () => {
    setSeverityFilter('');
    setStatusFilter('');
    setSourceFilter('');
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

  const refreshDetail = async () => {
    if (!detailAlert) return;
    setIsRefreshingDetail(true);
    const result = await apiService.getAlert(detailAlert.id);
    if (result.success && result.data) {
      setDetailAlert(result.data);
      setAlerts((prev) => prev.map((a) => (a.id === result.data!.id ? result.data! : a)));
    }
    setIsRefreshingDetail(false);
  };

  const handleDelete = async () => {
    if (!alertToDelete) return;
    setIsDeleting(true);
    const result = await apiService.deleteAlert(alertToDelete.id);
    setIsDeleting(false);

    if (!result.success) {
      setError(result.error || 'Error al eliminar la alerta');
      setAlertToDelete(null);
      return;
    }

    setAlertToDelete(null);
    setDetailAlert(null);
    fetchAlerts();
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
        case 'source':
          cmp = a.source.localeCompare(b.source);
          break;
        case 'description':
          cmp = describe(a).localeCompare(describe(b));
          break;
        case 'device':
          cmp = (deviceNames[a.deviceId] ?? a.deviceId).localeCompare(deviceNames[b.deviceId] ?? b.deviceId);
          break;
        case 'startedAt':
          cmp = (a.startedAt ?? '').localeCompare(b.startedAt ?? '');
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

  const columns = React.useMemo(() => buildAlertColumns(deviceNames), [deviceNames]);

  const hasFilters = severityFilter || statusFilter || sourceFilter || deviceIdFilter;

  const totalLabel = totalAlerts > 0
    ? `${totalAlerts} ${totalAlerts === 1 ? 'alerta' : 'alertas'} en total`
    : 'Sin alertas registradas';

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Alertas"
        subtitle={totalLabel}
        onRefresh={fetchAlerts}
        isRefreshing={isLoading}
        lastRefreshed={lastRefreshed}
      />

      <FilterBar columns={5} hasFilters={!!hasFilters} onClear={clearFilters}>
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
        <Select
          label="Origen"
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
          options={[
            { value: '', label: 'Todos los Orígenes' },
            ...sourceOptions.map((s) => ({ value: s, label: s })),
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
      </FilterBar>

      {error && <ErrorBanner message={error} onRetry={fetchAlerts} />}

      <DataTable
        columns={columns}
        rows={sortedAlerts}
        getRowId={(a) => a.id}
        getRowLabel={(a) => describe(a)}
        rowActions={(alert) => (
          <Button size="sm" variant="outline" onClick={() => setDetailAlert(alert)}>
            Ver
          </Button>
        )}
        isLoading={isLoading}
        loadingMessage="Cargando alertas..."
        emptyMessage={
          hasFilters ? 'Ninguna alerta coincide con los filtros' : 'No hay alertas registradas.'
        }
        sort={{ field: sortColumn, direction: sortDirection, onSort: (f) => handleSort(f as SortColumn) }}
        selectionResetKey={`${currentPage}|${severityFilter}|${statusFilter}|${sourceFilter}|${deviceIdFilter}`}
        // Alerts are opened and resolved by the system; only admins may purge
        // resolved ones, and the backend rejects deleting an alert still open.
        bulkDelete={
          isAdmin
            ? {
                deleteOne: (id) => apiService.deleteAlert(id),
                onFinished: fetchAlerts,
                entity: { singular: 'alerta', plural: 'alertas', gender: 'f' },
                canDelete: (a) => a.status === 'RESOLVED',
                blockedHint: 'Solo se pueden eliminar alertas resueltas',
              }
            : undefined
        }
        pagination={{
          currentPage,
          totalPages,
          totalItems: totalAlerts,
          itemsPerPage: LIMIT,
          onPageChange: setCurrentPage,
        }}
      />

      {/* Alert detail */}
      <Modal
        isOpen={detailAlert !== null}
        onClose={() => setDetailAlert(null)}
        title="Detalle de alerta"
        size="lg"
      >
        {detailAlert && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getSeverityVariant(detailAlert.severity)}>
                {SEVERITY_LABELS[detailAlert.severity]}
              </Badge>
              <Badge variant={getStatusVariant(detailAlert.status)}>
                {STATUS_LABELS[detailAlert.status]}
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">{detailAlert.source}</span>
            </div>

            <p className="text-sm text-gray-900 dark:text-gray-100">{describe(detailAlert)}</p>

            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Tipo</dt>
                <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
                  {detailAlert.type}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Dispositivo</dt>
                <dd className="mt-1">
                  <Link
                    href={`/devices/${detailAlert.deviceId}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {deviceNames[detailAlert.deviceId] ?? detailAlert.deviceId}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Duración</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {formatDuration(detailAlert.durationSecs)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Inicio</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(detailAlert.startedAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Resolución</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(detailAlert.resolvedAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Notificada</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(detailAlert.notifiedAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Recuperación notificada</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {formatDate(detailAlert.recoveryNotifiedAt)}
                </dd>
              </div>
            </dl>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Detalles</h4>
              {/* Older alerts were recorded before `details` was populated. */}
              {Object.keys(detailAlert.details).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Sin detalles adicionales.</p>
              ) : isDeviceUnreachable(detailAlert) ? (
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Fallos consecutivos</dt>
                    <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                      {formatDetailValue(detailAlert.details.consecutiveFailures)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Dirección IP</dt>
                    <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                      {formatDetailValue(detailAlert.details.ipAddress)}
                    </dd>
                  </div>
                </dl>
              ) : isWirelessAlert(detailAlert) ? (
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Métrica</dt>
                    <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                      {formatDetailValue(detailAlert.details.metric)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Severidad</dt>
                    <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                      {formatDetailValue(detailAlert.details.severity)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Umbral</dt>
                    <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                      {formatDetailValue(detailAlert.details.threshold)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Valor actual</dt>
                    <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                      {formatDetailValue(detailAlert.details.currentValue)}
                    </dd>
                  </div>
                </dl>
              ) : Object.keys(detailAlert.details).length > 0 ? (
                // Unknown producer — `details` is a free-form bag, so fall back to key/value.
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  {Object.entries(detailAlert.details).map(([key, value]) => (
                    <div key={key}>
                      <dt className="font-medium text-gray-500 dark:text-gray-400 break-all">{key}</dt>
                      <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100 break-all">
                        {formatDetailValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Sin detalles adicionales.</p>
              )}
            </div>

            <Modal.Footer className="-mx-6 -mb-4">
              <Button
                variant="outline"
                onClick={refreshDetail}
                isLoading={isRefreshingDetail}
                disabled={isRefreshingDetail}
              >
                Actualizar
              </Button>
              {isAdmin && (
                <Button
                  variant="danger"
                  disabled={detailAlert.status === 'OPEN'}
                  title={
                    detailAlert.status === 'OPEN'
                      ? 'Solo se pueden eliminar alertas resueltas'
                      : 'Eliminar alerta'
                  }
                  onClick={() => {
                    // Close the detail modal first — stacking two modals fights over
                    // the body scroll lock.
                    setAlertToDelete(detailAlert);
                    setDetailAlert(null);
                  }}
                >
                  Eliminar
                </Button>
              )}
            </Modal.Footer>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={alertToDelete !== null}
        onClose={() => setAlertToDelete(null)}
        onConfirm={handleDelete}
        title="Eliminar alerta"
        message={
          alertToDelete
            ? `¿Eliminar la alerta "${describe(alertToDelete)}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
