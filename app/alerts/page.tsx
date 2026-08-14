'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import { AlertDTO, AlertSeverity, AlertStatus } from '@/types/alert.types';
import { ApiResponse, BulkActionSummary } from '@/types/common.types';
import {
  Badge,
  Button,
  DataTable,
  ErrorBanner,
  FilterBar,
  Input,
  PageHeader,
  Select,
} from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
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

/** Alerts recorded before `description` existed come back with an empty string. */
function describe(alert: AlertDTO): string {
  return alert.description || alert.type;
}

type SortColumn = 'severity' | 'status' | 'source' | 'description' | 'device';
type SortDirection = 'asc' | 'desc';

/**
 * The page sorts the rows itself — device names live outside the DTO — so the
 * columns only declare that they sort.
 *
 * Kept to what's filterable (severity, status, source, device) plus the
 * description, which is the minimum needed to recognize an alert at a
 * glance. Everything else (type, duration, timestamps, producer-specific
 * details) lives on the alert's own detail page.
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
  ];
}

const alertCount = (n: number) => `${n} ${n === 1 ? 'alerta' : 'alertas'}`;

/**
 * Both bulk endpoints answer 200 with their own success bucket beside the
 * shared `skipped`/`failed` pair; these map that bucket onto the ids the table
 * reports on. A refusal of the call itself carries no report at all, so it
 * passes through as a plain error.
 */
async function clearSelectedAlerts(ids: string[]): Promise<ApiResponse<BulkActionSummary>> {
  const result = await apiService.bulkClearAlerts({ ids });
  if (!result.success || !result.data) return { success: false, error: result.error };
  const { cleared, skipped, failed } = result.data;
  return { success: true, data: { succeeded: cleared.map((a) => a.id), skipped, failed } };
}

async function deleteSelectedAlerts(ids: string[]): Promise<ApiResponse<BulkActionSummary>> {
  const result = await apiService.bulkDeleteAlerts(ids);
  if (!result.success || !result.data) return { success: false, error: result.error };
  const { deleted, skipped, failed } = result.data;
  return { success: true, data: { succeeded: deleted, skipped, failed } };
}

/**
 * Clearing is a real resolve, not an acknowledgement: the producer's next cycle
 * reopens the alert if the fault is still there. Say so before the operator
 * clears a screenful and expects them to stay gone.
 */
const CLEAR_REOPEN_NOTE =
  'Resolver una alerta a mano equivale a que el sistema la resuelva: si el siguiente ciclo sigue encontrando la falla, volverá a abrirse.';

export default function AlertsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canWrite = isAdmin || user?.role === 'OPERATOR';

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

  // Clearing a whole device at once — the outage-storm case the ids form makes
  // tedious, since it needs the operator to select what a filter already names.
  const [showClearDeviceModal, setShowClearDeviceModal] = useState(false);
  const [isClearingDevice, setIsClearingDevice] = useState(false);
  const [clearDeviceNotice, setClearDeviceNotice] = useState<string | null>(null);

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

  const handleClearDeviceAlerts = async () => {
    setIsClearingDevice(true);
    setClearDeviceNotice(null);
    const result = await apiService.bulkClearAlerts({ deviceId: deviceIdFilter });
    setIsClearingDevice(false);
    setShowClearDeviceModal(false);

    if (!result.success || !result.data) {
      setError(result.error || 'Error al resolver las alertas del dispositivo');
      return;
    }
    const { cleared, failed } = result.data;
    setClearDeviceNotice(
      failed.length > 0
        ? `Se resolvieron ${alertCount(cleared.length)}; ${failed.length} con error (${failed[0].error}).`
        : `Se resolvieron ${alertCount(cleared.length)}.`
    );
    await fetchAlerts();
  };

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

      {/* Clears every alert still open on the filtered device, without making
          the operator select rows a filter has already picked out. */}
      {canWrite && deviceIdFilter && (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowClearDeviceModal(true)}>
            Resolver todas las alertas abiertas de este dispositivo
          </Button>
        </div>
      )}

      <ConfirmModal
        isOpen={showClearDeviceModal}
        onClose={() => setShowClearDeviceModal(false)}
        onConfirm={handleClearDeviceAlerts}
        title="Resolver alertas del dispositivo"
        message={`¿Resolver todas las alertas abiertas de ${
          deviceNames[deviceIdFilter] ?? 'este dispositivo'
        }? ${CLEAR_REOPEN_NOTE}`}
        confirmText="Resolver"
        cancelText="Cancelar"
        isLoading={isClearingDevice}
      />

      {clearDeviceNotice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20"
        >
          <p className="text-sm text-green-800 dark:text-green-400">{clearDeviceNotice}</p>
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={fetchAlerts} />}

      <DataTable
        columns={columns}
        rows={sortedAlerts}
        getRowId={(a) => a.id}
        getRowLabel={(a) => describe(a)}
        onRowClick={(a) => router.push(`/alerts/${a.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando alertas..."
        emptyMessage={
          hasFilters ? 'Ninguna alerta coincide con los filtros' : 'No hay alertas registradas.'
        }
        sort={{ field: sortColumn, direction: sortDirection, onSort: (f) => handleSort(f as SortColumn) }}
        selectionResetKey={`${currentPage}|${severityFilter}|${statusFilter}|${sourceFilter}|${deviceIdFilter}`}
        /*
         * Two actions with opposite eligibility — clearing wants the open ones,
         * deleting only takes the resolved — so nothing gates the checkboxes:
         * both endpoints report per-id what they declined, and pre-filtering the
         * selection for one would block the other. Operators may clear;
         * deleting alert history stays with admins.
         */
        bulkDelete={
          canWrite
            ? {
                deleteMany: isAdmin ? deleteSelectedAlerts : undefined,
                onFinished: fetchAlerts,
                entity: { singular: 'alerta', plural: 'alertas', gender: 'f' },
                confirmNote:
                  'Solo se eliminan las alertas resueltas; las que sigan abiertas se informan sin cambios. Esta acción no se puede deshacer.',
                bulkActions: [
                  {
                    key: 'clear',
                    label: 'Resolver',
                    confirmTitle: 'Resolver alertas',
                    confirmMessage: (n) =>
                      `¿Resolver ${alertCount(n)}? ${CLEAR_REOPEN_NOTE}`,
                    confirmText: 'Resolver',
                    doneParticiple: 'resuelt',
                    run: clearSelectedAlerts,
                  },
                ],
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
    </div>
  );
}
