'use client';

import { DeviceResponseDTO } from '@/types/device.types';
import { PollingStatus } from '@/types/polling.types';
import {
  Badge,
  getDeviceStatusBadgeVariant,
  getPollingStatusBadgeVariant,
} from '@/components/ui';
import type { DataTableColumn, PickableColumn } from '@/components/ui';
import { deviceCategoryLabel } from '@/constants/device.constants';
import type { DeviceLookups } from '@/hooks/useCatalogs';

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

const OWNER_LABELS: Record<string, string> = {
  COMPANY: 'Empresa',
  CLIENT: 'Cliente',
};

/** Connectivity sorts by severity rather than by the label's initial. */
const CONNECTIVITY_ORDER: Record<string, number> = { ONLINE: 0, OFFLINE: 1, UNKNOWN: 2 };

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

function Text({ value }: { value: string | null | undefined }) {
  return value ? (
    <span className="text-gray-900 dark:text-gray-100">{value}</span>
  ) : (
    <span className="text-gray-400 dark:text-gray-500">—</span>
  );
}

function Mono({ value }: { value: string | null }) {
  return value ? (
    <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{value}</span>
  ) : (
    <span className="text-gray-400 dark:text-gray-500">—</span>
  );
}

function DateText({ iso }: { iso: string | null }) {
  return <Text value={iso ? new Date(iso).toLocaleDateString('es') : null} />;
}

/** An IP sorts by its numeric value, not as text ("10.0.0.9" before "10.0.0.10"). */
function ipToNumber(ip: string | null): number | null {
  if (!ip) return null;
  const octets = ip.split('.');
  if (octets.length !== 4) return null;
  return octets.reduce((acc, octet) => acc * 256 + (parseInt(octet, 10) || 0), 0);
}

/** A DataTable column plus what the column picker needs to list it. */
type DeviceColumn = DataTableColumn<DeviceResponseDTO> & {
  /** Name shown in the picker. */
  label: string;
  /** Cannot be hidden. */
  locked?: boolean;
};

interface DeviceColumnOptions {
  pollingStatuses: Record<string, PollingStatus>;
  lookups: DeviceLookups;
  /** Keys the user picked — the serial line under the name drops out when its own column is up. */
  visibleKeys: string[];
}

/**
 * Every column the devices table can show, in display order. `sortValue` makes
 * each one sortable by a header click; the page orders the rows with `sortRows`.
 */
function deviceColumnCatalog({
  pollingStatuses,
  lookups,
  visibleKeys,
}: DeviceColumnOptions): DeviceColumn[] {
  return [
    {
      key: 'name',
      label: 'Nombre',
      locked: true,
      header: 'Nombre',
      sortValue: (device) => device.name.toLowerCase(),
      cell: (device) => (
        <>
          <div className="font-medium text-gray-900 dark:text-gray-100">{device.name}</div>
          {device.serialNumber && !visibleKeys.includes('serial') && (
            <div className="text-xs text-gray-500 dark:text-gray-400">{device.serialNumber}</div>
          )}
        </>
      ),
    },
    {
      key: 'ip',
      label: 'Dirección IP',
      header: 'Dirección IP',
      sortValue: (device) => ipToNumber(device.ipAddress),
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
          {device.monitoringEnabled && visibleKeys.includes('connectivity') && (
            <div className="mt-1 md:hidden">
              <ConnectivityBadge device={device} pollingStatuses={pollingStatuses} />
            </div>
          )}
        </>
      ),
    },
    {
      key: 'connectivity',
      label: 'Conectividad',
      header: 'Conectividad',
      className: 'hidden md:table-cell',
      sortValue: (device) =>
        device.monitoringEnabled ? (CONNECTIVITY_ORDER[pollingStatuses[device.id]] ?? 2) : null,
      cell: (device) => <ConnectivityBadge device={device} pollingStatuses={pollingStatuses} />,
    },
    {
      key: 'status',
      label: 'Estado',
      header: 'Estado',
      sortValue: (device) => STATUS_LABELS[device.status] ?? device.status,
      cell: (device) => (
        <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
          {STATUS_LABELS[device.status] ?? device.status}
        </Badge>
      ),
    },
    {
      key: 'category',
      label: 'Categoría',
      header: 'Categoría',
      className: 'hidden lg:table-cell',
      sortValue: (device) => (device.category ? deviceCategoryLabel(device.category) : null),
      cell: (device) => (
        <Text value={device.category ? deviceCategoryLabel(device.category) : null} />
      ),
    },
    {
      key: 'owner',
      label: 'Propietario',
      header: 'Propietario',
      className: 'hidden lg:table-cell',
      sortValue: (device) => (device.ownerType ? OWNER_LABELS[device.ownerType] : null),
      cell: (device) => <Text value={device.ownerType ? OWNER_LABELS[device.ownerType] : null} />,
    },
    {
      key: 'model',
      label: 'Modelo',
      header: 'Modelo',
      sortValue: (device) => lookups.modelNames[device.deviceModelId] ?? null,
      cell: (device) => <Text value={lookups.modelNames[device.deviceModelId]} />,
    },
    {
      key: 'location',
      label: 'Ubicación',
      header: 'Ubicación',
      sortValue: (device) =>
        device.locationId ? lookups.locationNames[device.locationId] ?? null : null,
      cell: (device) => (
        <Text value={device.locationId ? lookups.locationNames[device.locationId] : null} />
      ),
    },
    {
      key: 'serial',
      label: 'Número de serie',
      header: 'Número de serie',
      sortValue: (device) => device.serialNumber?.toLowerCase() ?? null,
      cell: (device) => <Mono value={device.serialNumber} />,
    },
    {
      key: 'mac',
      label: 'Dirección MAC',
      header: 'Dirección MAC',
      sortValue: (device) => device.macAddress?.toLowerCase() ?? null,
      cell: (device) => <Mono value={device.macAddress} />,
    },
    {
      key: 'monitoring',
      label: 'Monitoreo',
      header: 'Monitoreo',
      // Monitored first when ascending.
      sortValue: (device) => (device.monitoringEnabled ? 0 : 1),
      cell: (device) => (
        <Badge variant={device.monitoringEnabled ? 'success' : 'neutral'}>
          {device.monitoringEnabled ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'description',
      label: 'Descripción',
      header: 'Descripción',
      cellClassName: 'max-w-xs truncate',
      sortValue: (device) => device.description?.toLowerCase() ?? null,
      cell: (device) => <Text value={device.description} />,
    },
    {
      key: 'installedDate',
      label: 'Fecha de instalación',
      header: 'Instalación',
      sortValue: (device) => device.installedDate,
      cell: (device) => <DateText iso={device.installedDate} />,
    },
    {
      key: 'createdAt',
      label: 'Fecha de registro',
      header: 'Registrado',
      sortValue: (device) => device.createdAt,
      cell: (device) => <DateText iso={device.createdAt} />,
    },
    {
      key: 'updatedAt',
      label: 'Última modificación',
      header: 'Modificado',
      sortValue: (device) => device.updatedAt,
      cell: (device) => <DateText iso={device.updatedAt} />,
    },
  ];
}

/** What the column picker lists, derived from the catalog so the two cannot drift. */
export const DEVICE_COLUMN_OPTIONS: PickableColumn[] = deviceColumnCatalog({
  pollingStatuses: {},
  lookups: { modelNames: {}, locationNames: {} },
  visibleKeys: [],
}).map(({ key, label, locked }) => ({ key, label, locked }));

/** The columns shown before the user picks any. */
export const DEFAULT_DEVICE_COLUMNS = [
  'name',
  'ip',
  'connectivity',
  'status',
  'category',
  'owner',
];

/** Only the model and location columns need ids resolved to names. */
export const LOOKUP_DEVICE_COLUMNS = ['model', 'location'];

/** The catalog narrowed to the columns the user kept. */
export function buildDeviceColumns(
  options: DeviceColumnOptions
): DataTableColumn<DeviceResponseDTO>[] {
  return deviceColumnCatalog(options).filter(
    (col) => col.locked || options.visibleKeys.includes(col.key)
  );
}
