'use client';

import { DeviceResponseDTO } from '@/types/device.types';
import { PollingStatus } from '@/types/polling.types';
import {
  Badge,
  getDeviceStatusBadgeVariant,
  getPollingStatusBadgeVariant,
} from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  COMMISSIONING: 'Comisionamiento',
  INVENTORY: 'Inventario',
  DAMAGED: 'Dañado',
};

const CONNECTIVITY_LABELS: Record<string, string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Desconectado',
  UNKNOWN: 'Desconocido',
};

function ConnectivityBadge({
  device,
  pollingStatuses,
}: {
  device: DeviceResponseDTO;
  pollingStatuses: Record<string, PollingStatus>;
}) {
  if (!device.monitoringEnabled) {
    return <span className="text-gray-400 dark:text-gray-500 text-sm">No monitoreado</span>;
  }
  const status = pollingStatuses[device.id];
  if (!status) {
    return <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>;
  }
  return (
    <Badge variant={getPollingStatusBadgeVariant(status)}>
      {CONNECTIVITY_LABELS[status] ?? status}
    </Badge>
  );
}

/**
 * Columns for the devices table. `useDevices` does the sorting itself (IP is
 * ordered numerically, connectivity by severity), so the columns only declare
 * that they are sortable.
 */
export function buildDeviceColumns(
  pollingStatuses: Record<string, PollingStatus>
): DataTableColumn<DeviceResponseDTO>[] {
  return [
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      cell: (device) => (
        <>
          <div className="font-medium text-gray-900 dark:text-gray-100">{device.name}</div>
          {device.serialNumber && (
            <div className="text-xs text-gray-500 dark:text-gray-400">{device.serialNumber}</div>
          )}
        </>
      ),
    },
    {
      key: 'ip',
      header: 'Dirección IP',
      sortable: true,
      cell: (device) => (
        <>
          {device.ipAddress ? (
            <a
              href={`http://${device.ipAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {device.ipAddress}
            </a>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          )}
          {/* Connectivity is shown inline where its own column is hidden. */}
          {device.monitoringEnabled && (
            <div className="mt-1 md:hidden">
              <ConnectivityBadge device={device} pollingStatuses={pollingStatuses} />
            </div>
          )}
        </>
      ),
    },
    {
      key: 'connectivity',
      header: 'Conectividad',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: (device) => <ConnectivityBadge device={device} pollingStatuses={pollingStatuses} />,
    },
    {
      key: 'status',
      header: 'Estado',
      sortable: true,
      cell: (device) => (
        <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
          {STATUS_LABELS[device.status] ?? device.status}
        </Badge>
      ),
    },
    {
      key: 'category',
      header: 'Categoría',
      sortable: true,
      className: 'hidden lg:table-cell',
      cell: (device) =>
        device.category ? (
          <span className="text-gray-900 dark:text-gray-100">
            {device.category.replace(/_/g, ' ')}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">—</span>
        ),
    },
    {
      key: 'owner',
      header: 'Propietario',
      sortable: true,
      className: 'hidden lg:table-cell',
      cell: (device) => (
        <span className="text-gray-900 dark:text-gray-100">
          {device.ownerType === 'COMPANY' ? 'Empresa' : device.ownerType === 'CLIENT' ? 'Cliente' : '—'}
        </span>
      ),
    },
  ];
}
