'use client';

import type { ConnectivityStatus, DeviceListItemDTO } from '@/types/device.types';
import { Badge, getDeviceStatusBadgeVariant } from '@/components/ui';
import type { BadgeVariant, DataTableColumn, PickableColumn } from '@/components/ui';
import { fmtAge } from '@/constants/wireless.constants';
import {
  DEVICE_OWNER_LABELS,
  DEVICE_STATUS_LABELS as STATUS_LABELS,
  deviceCategoryLabel,
} from '@/constants/device.constants';
import type { DeviceLookups } from '@/hooks/useCatalogs';

const CONNECTIVITY_LABELS: Record<ConnectivityStatus, string> = {
  UP: 'En línea',
  DOWN: 'Desconectado',
  UNKNOWN: 'Desconocido',
};

const CONNECTIVITY_VARIANTS: Record<ConnectivityStatus, BadgeVariant> = {
  UP: 'success',
  DOWN: 'danger',
  UNKNOWN: 'neutral',
};

/**
 * The list carries each device's state, so the badge needs no request of its
 * own. A DOWN device also says for how long — the question an operator
 * scanning the list is actually asking.
 */
function ConnectivityBadge({ device, now }: { device: DeviceListItemDTO; now: number }) {
  const connectivity = device.connectivity;
  if (!connectivity) {
    return <span className="text-gray-400 dark:text-gray-500 text-sm">No monitoreado</span>;
  }
  const downFor =
    connectivity.downSince !== null
      ? fmtAge(Math.max(0, (now - Date.parse(connectivity.downSince)) / 1000))
      : null;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant={CONNECTIVITY_VARIANTS[connectivity.status]}>
        {CONNECTIVITY_LABELS[connectivity.status] ?? connectivity.status}
      </Badge>
      {downFor && (
        <span
          className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
          title={new Date(connectivity.downSince!).toLocaleString('es')}
        >
          desde {downFor}
        </span>
      )}
    </div>
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

/** A DataTable column plus what the column picker needs to list it. */
type DeviceColumn = DataTableColumn<DeviceListItemDTO> & {
  /** Name shown in the picker. */
  label: string;
  /** Cannot be hidden. */
  locked?: boolean;
};

interface DeviceColumnOptions {
  /** The clock "caído desde hace…" counts against, ticked by the page. */
  now: number;
  lookups: DeviceLookups;
  /** Keys the user picked — the serial line under the name drops out when its own column is up. */
  visibleKeys: string[];
}

/**
 * Every column the devices table can show, in display order. `sortable` marks
 * a column sortable by a header click, restricted to the fields GET
 * /api/devices can order by (sortBy: createdAt | updatedAt | name | status |
 * deletedAt | ipAddress | downSince) — the server sorts before pagination, so
 * the page just requests the field and renders whatever page comes back.
 * `useDevices`' `toSortBy` maps 'ip' to `ipAddress` and 'connectivity' to
 * `downSince`.
 */
function deviceColumnCatalog({
  now,
  lookups,
  visibleKeys,
}: DeviceColumnOptions): DeviceColumn[] {
  return [
    {
      key: 'name',
      label: 'Nombre',
      locked: true,
      header: 'Nombre',
      sortable: true,
      cellClassName: 'max-w-xs',
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
      sortable: true,
      cell: (device) =>
        device.ipAddress ? (
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
        ),
    },
    {
      key: 'connectivity',
      label: 'Conectividad',
      header: 'Conectividad',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: (device) => <ConnectivityBadge device={device} now={now} />,
    },
    {
      key: 'status',
      label: 'Estado',
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
      label: 'Categoría',
      header: 'Categoría',
      className: 'hidden lg:table-cell',
      cell: (device) => (
        <Text value={device.category ? deviceCategoryLabel(device.category) : null} />
      ),
    },
    {
      key: 'owner',
      label: 'Propietario',
      header: 'Propietario',
      className: 'hidden lg:table-cell',
      cell: (device) => <Text value={device.ownerType ? DEVICE_OWNER_LABELS[device.ownerType] : null} />,
    },
    {
      key: 'model',
      label: 'Modelo',
      header: 'Modelo',
      cell: (device) => <Text value={lookups.modelNames[device.deviceModelId]} />,
    },
    {
      key: 'location',
      label: 'Ubicación',
      header: 'Ubicación',
      cell: (device) => (
        <Text value={device.locationId ? lookups.locationNames[device.locationId] : null} />
      ),
    },
    {
      key: 'agent',
      label: 'Sondeado por',
      header: 'Sondeado por',
      className: 'hidden lg:table-cell',
      cell: (device) =>
        device.agentId ? (
          <Text value={lookups.agentNames[device.agentId] ?? 'Agente'} />
        ) : (
          <span className="text-gray-500 dark:text-gray-400 text-sm">Servidor</span>
        ),
    },
    {
      key: 'serial',
      label: 'Número de serie',
      header: 'Número de serie',
      cell: (device) => <Mono value={device.serialNumber} />,
    },
    {
      key: 'mac',
      label: 'Dirección MAC',
      header: 'Dirección MAC',
      cell: (device) => <Mono value={device.macAddress} />,
    },
    {
      key: 'monitoring',
      label: 'Monitoreo',
      header: 'Monitoreo',
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
      cellClassName: 'max-w-xs',
      cell: (device) => <Text value={device.description} />,
    },
    {
      key: 'installedDate',
      label: 'Fecha de instalación',
      header: 'Instalación',
      cell: (device) => <DateText iso={device.installedDate} />,
    },
    {
      key: 'createdAt',
      label: 'Fecha de registro',
      header: 'Registrado',
      sortable: true,
      cell: (device) => <DateText iso={device.createdAt} />,
    },
    {
      key: 'updatedAt',
      label: 'Última modificación',
      header: 'Modificado',
      sortable: true,
      cell: (device) => <DateText iso={device.updatedAt} />,
    },
  ];
}

/** What the column picker lists, derived from the catalog so the two cannot drift. */
export const DEVICE_COLUMN_OPTIONS: PickableColumn[] = deviceColumnCatalog({
  now: 0,
  lookups: { modelNames: {}, locationNames: {}, agentNames: {} },
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
export const LOOKUP_DEVICE_COLUMNS = ['model', 'location', 'agent'];

/** The catalog narrowed to the columns the user kept. */
export function buildDeviceColumns(
  options: DeviceColumnOptions
): DataTableColumn<DeviceListItemDTO>[] {
  return deviceColumnCatalog(options).filter(
    (col) => col.locked || options.visibleKeys.includes(col.key)
  );
}
