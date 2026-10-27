'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/services/api.service';
import { usePermissions } from '@/hooks/usePermissions';
import { AlertDTO, AlertListItemDTO, AlertSeverity, AlertStatus } from '@/types/alert.types';
import { AlertTicketAction } from '@/components/alerts/AlertTicketAction';
import { ApiResponse, BulkActionSummary } from '@/types/common.types';
import { useUrlState } from '@/hooks/useUrlState';
import {
  Badge,
  Button,
  ColumnPicker,
  DataTable,
  ErrorBanner,
  FilterBar,
  FilterChip,
  FilterDateRangeChip,
  FilterTextChip,
  LoadingSpinner,
  PageHeader,
  useColumnVisibility,
} from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import type { BadgeVariant, DataTableColumn, PickableColumn } from '@/components/ui';

const LIMIT = 50;
const COLUMNS_STORAGE_KEY = 'nms:alerts-columns';

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type SortColumn = 'severity' | 'status' | 'source' | 'description' | 'device' | 'startedAt';
type SortDirection = 'asc' | 'desc';

type AlertColumn = DataTableColumn<AlertListItemDTO> & { label: string; locked?: boolean };

/**
 * The page sorts the rows itself — device names live outside the DTO — so the
 * columns only declare that they sort.
 *
 * Kept to what's filterable (severity, status, source, device) plus the
 * description, which is the minimum needed to recognize an alert at a
 * glance, and when it started. Everything else (type, duration, the other
 * timestamps, producer-specific
 * details) lives on the alert's own detail page.
 */
/**
 * How an outage folds on the page (NOT-243): the alerts of devices down
 * behind a failed AP or switch hang under that device's alert, the root,
 * instead of each taking a row of its own.
 */
interface CascadeView {
  /** Per root on this page: its affected alerts that are on this page too. */
  childrenOnPage: Map<string, AlertListItemDTO[]>;
  /** Alert ids on this page, to tell a child whose root is here from one whose root is elsewhere. */
  onPage: Set<string>;
  expanded: Set<string>;
  toggle: (rootId: string) => void;
}

const NO_CASCADE: CascadeView = { childrenOnPage: new Map(), onPage: new Set(), expanded: new Set(), toggle: () => {} };

function CascadeNote({ a, cascade }: { a: AlertListItemDTO; cascade: CascadeView }) {
  if (a.causedByAlertId) {
    return cascade.onPage.has(a.causedByAlertId) ? (
      <span className="block text-xs text-gray-500 dark:text-gray-400">Cayó con el equipo de arriba</span>
    ) : (
      <Link
        href={`/alerts/${a.causedByAlertId}`}
        onClick={(e) => e.stopPropagation()}
        className="block text-xs text-brand-600 dark:text-brand-400 hover:underline"
      >
        Parte de una caída mayor →
      </Link>
    );
  }
  if (a.affectedCount === 0) return null;
  const label = `${a.affectedCount} equipo${a.affectedCount === 1 ? '' : 's'} afectado${a.affectedCount === 1 ? '' : 's'} detrás`;
  // Its affected alerts may sit on other pages; the alert's own page lists them all.
  if (!cascade.childrenOnPage.has(a.id)) {
    return (
      <Link
        href={`/alerts/${a.id}`}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 inline-block text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
      >
        {label} →
      </Link>
    );
  }
  const open = cascade.expanded.has(a.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        cascade.toggle(a.id);
      }}
      aria-expanded={open}
      className="mt-1 inline-flex items-start gap-1 text-left text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
    >
      <span aria-hidden>{open ? '▾' : '▸'}</span>
      {label}
    </button>
  );
}

function alertColumnCatalog(
  deviceNames: Record<string, string>,
  onTicketChanged: () => void = () => {},
  cascade: CascadeView = NO_CASCADE
): AlertColumn[] {
  return [
    {
      key: 'severity',
      label: 'Severidad',
      locked: true,
      header: 'Severidad',
      sortable: true,
      cell: (a) => <Badge variant={getSeverityVariant(a.severity)}>{SEVERITY_LABELS[a.severity]}</Badge>,
    },
    {
      key: 'status',
      label: 'Estado',
      header: 'Estado',
      sortable: true,
      cell: (a) => <Badge variant={getStatusVariant(a.status)}>{STATUS_LABELS[a.status]}</Badge>,
    },
    {
      key: 'source',
      label: 'Origen',
      header: 'Origen',
      sortable: true,
      className: 'hidden lg:table-cell',
      cell: (a) => <span className="text-sm text-gray-700 dark:text-gray-300">{a.source}</span>,
    },
    {
      key: 'description',
      label: 'Descripción',
      header: 'Descripción',
      sortable: true,
      cell: (a) => (
        <div className={`max-w-xs ${a.causedByAlertId && cascade.onPage.has(a.causedByAlertId) ? 'pl-4 border-l-2 border-gray-200 dark:border-gray-700' : ''}`}>
          <span className="block text-sm text-gray-700 dark:text-gray-300">{describe(a)}</span>
          <CascadeNote a={a} cascade={cascade} />
        </div>
      ),
    },
    {
      key: 'device',
      label: 'Dispositivo',
      header: 'Dispositivo',
      sortable: true,
      cellClassName: 'max-w-xs',
      cell: (a) => (
        <Link
          href={`/devices/${a.deviceId}`}
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {deviceNames[a.deviceId] ?? a.deviceId}
        </Link>
      ),
    },
    {
      // The alert's own live ticket, or "Crear ticket" while the install only
      // suggests them (NOT-206). Not sortable: it is an action as much as a value.
      key: 'ticket',
      label: 'Ticket',
      header: 'Ticket',
      cell: (a) => <AlertTicketAction alert={a} onChanged={onTicketChanged} />,
    },
    {
      key: 'startedAt',
      label: 'Inicio',
      header: 'Inicio',
      sortable: true,
      cell: (a) => (
        <span className="whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
          {formatDate(a.startedAt)}
        </span>
      ),
    },
  ];
}

const ALERT_COLUMN_OPTIONS: PickableColumn[] = alertColumnCatalog({}).map(
  ({ key, label, locked }) => ({ key, label, locked })
);
const DEFAULT_ALERT_COLUMNS = alertColumnCatalog({}).map((c) => c.key);

function buildAlertColumns(
  deviceNames: Record<string, string>,
  visibleKeys: string[],
  onTicketChanged: () => void,
  cascade: CascadeView
): DataTableColumn<AlertListItemDTO>[] {
  return alertColumnCatalog(deviceNames, onTicketChanged, cascade).filter((c) => c.locked || visibleKeys.includes(c.key));
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

function AlertsPageContent() {
  const router = useRouter();
  const permissions = usePermissions();
  const isAdmin = permissions.isAdmin;
  const canWrite = permissions.canWrite;

  const [alerts, setAlerts] = useState<AlertListItemDTO[]>([]);
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const { get, getNumber, set } = useUrlState();
  const currentPage = getNumber('page', 1);
  const severityFilter = get('severity', '');
  const statusFilter = get('status', '');
  const sourceFilter = get('source', '');
  const deviceIdFilter = get('deviceId', '');
  // 'YYYY-MM-DD' straight from <input type="date">, compared as local days.
  const fromFilter = get('from', '');
  const toFilter = get('to', '');
  // Sources present in the fetched page — the backend exposes no source filter,
  // so the options list can only reflect what we already have.
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);

  const sortColumn = (get('sort', '') || null) as SortColumn | null;
  const sortDirection = get('dir', 'asc') as SortDirection;

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
      severity: (severityFilter as AlertSeverity) || undefined,
      status: (statusFilter as AlertStatus) || undefined,
    });

    if (!result.success || !result.data) {
      setError(result.error || 'Error al cargar alertas');
      setIsLoading(false);
      return;
    }

    const fetched = result.data.alerts;
    setSourceOptions([...new Set(fetched.map((a: AlertDTO) => a.source))].sort());

    // Severity and status are filtered server-side; source and dates only
    // narrow the page already fetched.
    let rows = fetched;
    if (sourceFilter) rows = rows.filter((a: AlertDTO) => a.source === sourceFilter);
    if (fromFilter) {
      // A bare 'YYYY-MM-DD' parses as UTC midnight; the time suffix keeps it local.
      const from = Date.parse(`${fromFilter}T00:00`);
      rows = rows.filter((a: AlertDTO) => Date.parse(a.startedAt) >= from);
    }
    if (toFilter) {
      const to = Date.parse(`${toFilter}T23:59:59.999`);
      rows = rows.filter((a: AlertDTO) => Date.parse(a.startedAt) <= to);
    }

    setAlerts(rows);
    setTotalAlerts(result.data.total);
    setTotalPages(Math.max(1, Math.ceil(result.data.total / LIMIT)));

    // Each row names its device (by its current name), so no lookups are needed.
    setDeviceNames(Object.fromEntries(rows.map((a) => [a.deviceId, a.deviceName])));
    setLastRefreshed(new Date());

    setIsLoading(false);
  }, [currentPage, severityFilter, statusFilter, sourceFilter, deviceIdFilter, fromFilter, toFilter]);

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

  const clearFilters = () =>
    set({ severity: null, status: null, source: null, deviceId: null, from: null, to: null, page: null });

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      set({ dir: sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      // Dates open newest-first, matching the order the backend already returns.
      set({ sort: col, dir: col === 'startedAt' ? 'desc' : 'asc' });
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
        case 'startedAt':
          cmp = Date.parse(a.startedAt) - Date.parse(b.startedAt);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [alerts, sortColumn, sortDirection, deviceNames]);

  const { visibleKeys, toggle, reset, isDefault } = useColumnVisibility(
    COLUMNS_STORAGE_KEY,
    DEFAULT_ALERT_COLUMNS
  );
  // An outage folds under its root: an affected alert whose root is on this
  // page leaves the top level and comes back, right under it, when expanded.
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());
  const toggleRoot = useCallback(
    (id: string) =>
      setExpandedRoots((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    []
  );
  const cascade: CascadeView = React.useMemo(() => {
    const onPage = new Set(sortedAlerts.map((a) => a.id));
    const childrenOnPage = new Map<string, AlertListItemDTO[]>();
    for (const a of sortedAlerts) {
      if (!a.causedByAlertId || !onPage.has(a.causedByAlertId)) continue;
      childrenOnPage.set(a.causedByAlertId, [...(childrenOnPage.get(a.causedByAlertId) ?? []), a]);
    }
    return { onPage, childrenOnPage, expanded: expandedRoots, toggle: toggleRoot };
  }, [sortedAlerts, expandedRoots, toggleRoot]);
  const displayedAlerts = React.useMemo(
    () =>
      sortedAlerts.flatMap((a) => {
        if (a.causedByAlertId && cascade.onPage.has(a.causedByAlertId)) return [];
        return cascade.expanded.has(a.id) ? [a, ...(cascade.childrenOnPage.get(a.id) ?? [])] : [a];
      }),
    [sortedAlerts, cascade]
  );

  const columns = React.useMemo(
    () => buildAlertColumns(deviceNames, visibleKeys, fetchAlerts, cascade),
    [deviceNames, visibleKeys, fetchAlerts, cascade]
  );

  const hasFilters =
    severityFilter || statusFilter || sourceFilter || deviceIdFilter || fromFilter || toFilter;

  const totalLabel = totalAlerts > 0
    ? `${totalAlerts} ${totalAlerts === 1 ? 'alerta' : 'alertas'} en total`
    : 'Sin alertas registradas';

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Alertas"
        subtitle={totalLabel}
        lastRefreshed={lastRefreshed}
      />

      <FilterBar
        hasFilters={!!hasFilters}
        onClear={clearFilters}
        activeFilterCount={[severityFilter, statusFilter, sourceFilter, deviceIdFilter, fromFilter || toFilter].filter(Boolean).length}
        onRefresh={fetchAlerts}
        isRefreshing={isLoading}
        actions={
          <ColumnPicker
            columns={ALERT_COLUMN_OPTIONS}
            visibleKeys={visibleKeys}
            onToggle={toggle}
            onReset={reset}
            isDefault={isDefault}
          />
        }
      >
        <FilterChip
          label="Severidad"
          value={severityFilter}
          onChange={(v) => set({ severity: v || null, page: null })}
          options={[
            { value: '', label: 'Todas las Severidades' },
            { value: 'WARNING', label: 'Advertencia' },
            { value: 'CRITICAL', label: 'Crítico' },
          ]}
        />
        <FilterChip
          label="Estado"
          value={statusFilter}
          onChange={(v) => set({ status: v || null, page: null })}
          options={[
            { value: '', label: 'Todos los Estados' },
            { value: 'OPEN', label: 'Abierta' },
            { value: 'RESOLVED', label: 'Resuelta' },
          ]}
        />
        <FilterChip
          label="Origen"
          value={sourceFilter}
          onChange={(v) => set({ source: v || null, page: null })}
          options={[
            { value: '', label: 'Todos los Orígenes' },
            ...sourceOptions.map((s) => ({ value: s, label: s })),
          ]}
        />
        <FilterTextChip
          label="ID de dispositivo"
          value={deviceIdFilter}
          onChange={(v) => set({ deviceId: v || null, page: null })}
          placeholder="UUID del dispositivo"
        />
        <FilterDateRangeChip
          label="Fecha"
          from={fromFilter}
          to={toFilter}
          onFromChange={(v) => set({ from: v || null, page: null })}
          onToChange={(v) => set({ to: v || null, page: null })}
          onClear={() => set({ from: null, to: null, page: null })}
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
        rows={displayedAlerts}
        getRowId={(a) => a.id}
        getRowLabel={(a) => describe(a)}
        onRowClick={(a) => router.push(`/alerts/${a.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando alertas..."
        emptyMessage={
          hasFilters ? 'Ninguna alerta coincide con los filtros' : 'No hay alertas registradas.'
        }
        sort={{ field: sortColumn, direction: sortDirection, onSort: (f) => handleSort(f as SortColumn) }}
        selectionResetKey={`${currentPage}|${severityFilter}|${statusFilter}|${sourceFilter}|${deviceIdFilter}|${fromFilter}|${toFilter}`}
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
          onPageChange: (page) => set({ page: page === 1 ? null : page }),
        }}
      />
    </div>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <AlertsPageContent />
    </Suspense>
  );
}
