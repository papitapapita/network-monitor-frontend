'use client';

import React, { Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useDevices } from '@/hooks/useDevices';
import { useDeviceLookups } from '@/hooks/useCatalogs';
import { useNow } from '@/hooks/useWirelessThroughput';
import { apiService } from '@/services/api.service';
import { DeviceFilters } from '@/components/devices/DeviceFilters';
import {
  buildDeviceColumns,
  DEFAULT_DEVICE_COLUMNS,
  DEVICE_COLUMN_OPTIONS,
  LOOKUP_DEVICE_COLUMNS,
} from '@/components/devices/deviceColumns';
import {
  ColumnPicker,
  DataTable,
  ErrorBanner,
  IconButton,
  LoadingSpinner,
  PageHeader,
  PlusIcon,
  TrashIcon,
  useColumnVisibility,
} from '@/components/ui';
import { RESTORE_GRACE_DAYS } from '@/constants/device.constants';
import { useAgents } from '@/hooks/useAgents';
import { AGENT_STATUS_LABELS, SERVER_POLLER_LABEL, agentPollFailure } from '@/constants/agent.constants';
import { SERVER_AGENT_VALUE, agentIdFromPicker } from '@/components/agents/AgentPicker';
import type { BulkAction } from '@/components/ui';
import type { DeviceListItemDTO } from '@/types/device.types';
import { usePermissions } from '@/hooks/usePermissions';
import { useInstallation } from '@/hooks/useInstallation';

const COLUMNS_STORAGE_KEY = 'nms:devices-columns';

const deviceCount = (n: number) => `${n} ${n === 1 ? 'dispositivo' : 'dispositivos'}`;

function DevicesPageContent() {
  const router = useRouter();
  const permissions = usePermissions();
  // MON-023: a server off the monitored network refuses every manual poll.
  const { serverOnSite } = useInstallation();
  const {
    devices,
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
    agentFilter,
    search,
    sortField,
    sortDirection,
    hasFilters,
    setStatusFilter,
    setCategoryFilter,
    setConnectivityFilter,
    setLocationFilter,
    setAgentFilter,
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

  // Outage durations tick once a minute; the list itself refreshes on demand.
  const now = useNow(60_000);

  const lookups = useDeviceLookups(LOOKUP_DEVICE_COLUMNS.some((k) => visibleKeys.includes(k)));

  const columns = useMemo(
    () => buildDeviceColumns({ now, lookups, visibleKeys }),
    [now, lookups, visibleKeys]
  );

  // Where a device is polled from only means something once an agent exists.
  const { data: agents = [] } = useAgents();
  const moveAction: BulkAction<DeviceListItemDTO> | null =
    agents.length === 0
      ? null
      : {
          key: 'assign-agent',
          label: 'Mover a agente',
          confirmTitle: 'Cambiar quién los sondea',
          confirmMessage: (n) =>
            `${deviceCount(n)} pasará${n === 1 ? '' : 'n'} a sondearse desde el destino que elijas. Asegúrate de que alcance sus direcciones IP.`,
          confirmText: 'Mover',
          doneParticiple: 'movid',
          prompt: {
            label: 'Sondeado por',
            placeholder: 'Elige el destino...',
            requiredMessage: 'Elige un agente o el servidor',
            // A revoked agent cannot take devices (DEV-165).
            options: [
              { value: SERVER_AGENT_VALUE, label: SERVER_POLLER_LABEL },
              ...agents
                .filter((a) => a.status !== 'REVOKED')
                .map((a) => ({
                  value: a.id,
                  label: a.status === 'ACTIVE' ? a.name : `${a.name} (${AGENT_STATUS_LABELS[a.status].toLowerCase()})`,
                })),
            ],
          },
          // One request for the selection; the backend moves each device on
          // its own and lists the ones it refused.
          run: async (ids, target) => {
            const result = await apiService.assignDevicesToAgent({
              agentId: agentIdFromPicker(target!),
              deviceIds: ids,
            });
            if (!result.success || !result.data) return { success: false, error: result.error };
            return {
              success: true,
              data: { succeeded: result.data.assigned, skipped: [], failed: result.data.failed },
            };
          },
        };

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
            <IconButton
              icon={<TrashIcon />}
              label="Papelera"
              variant="outline"
              size="md"
              onClick={() => router.push('/devices/trash')}
            />
            {permissions.canWrite && (
              <IconButton
                icon={<PlusIcon />}
                label="Agregar Dispositivo"
                variant="primary"
                size="md"
                onClick={() => router.push('/devices/create')}
              />
            )}
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
            onClick={() => setLocationFilter('')}
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
        agentFilter={agentFilter}
        agentOptions={
          agents.length > 0
            ? [
                { value: 'none', label: SERVER_POLLER_LABEL },
                ...agents.map((a) => ({
                  value: a.id,
                  label: a.status === 'REVOKED' ? `${a.name} (revocado)` : a.name,
                })),
              ]
            : undefined
        }
        onAgentChange={setAgentFilter}
        hasFilters={hasFilters}
        onStatusChange={setStatusFilter}
        onCategoryChange={setCategoryFilter}
        onConnectivityChange={setConnectivityFilter}
        onSearchChange={setSearch}
        onClear={clearFilters}
      />

      {error && <ErrorBanner message={error} onRetry={() => fetchDevices()} />}

      <DataTable
        columns={columns}
        rows={devices}
        getRowId={(d) => d.id}
        getRowLabel={(d) => d.name}
        onRowClick={(d) => router.push(`/devices/${d.id}`)}
        isLoading={isLoading && devices.length === 0}
        loadingMessage="Cargando dispositivos..."
        emptyMessage={
          hasFilters
            ? 'Ningún dispositivo coincide con los filtros'
            : 'Sin dispositivos. Agrega el primero para comenzar.'
        }
        sort={{ field: sortField, direction: sortDirection, onSort: handleSort }}
        selectionResetKey={`${currentPage}|${statusFilter}|${categoryFilter}|${connectivityFilter}|${agentFilter}|${search}`}
        // Every bulk action writes; without the right to, the checkboxes go too.
        bulkDelete={permissions.canWrite ? {
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
                !device.monitoringEnabled ? 'monitoreo deshabilitado'
                // MON-023: an off-site server pings only through an agent.
                : !device.agentId && !serverOnSite ? 'sin agente, y el servidor no está en la red monitoreada'
                : null,
              // MON-022: a device behind an agent is polled by asking that agent.
              runOne: async (id: string) => {
                const result = await apiService.triggerPoll(id);
                return result.success ? result : { ...result, error: agentPollFailure(result.status, result.error) ?? result.error };
              },
            } satisfies BulkAction<DeviceListItemDTO>,
            ...(moveAction ? [moveAction] : []),
          ],
        } : undefined}
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
