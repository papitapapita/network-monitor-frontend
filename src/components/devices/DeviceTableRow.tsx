'use client';

import { useRouter } from 'next/navigation';
import { DeviceResponseDTO } from '@/types/device.types';
import { PollingStatus } from '@/types/polling.types';
import {
  Table,
  Badge,
  Button,
  getDeviceStatusBadgeVariant,
  getPollingStatusBadgeVariant,
} from '@/components/ui';

const STATUS_LABELS: Record<string, string> = {
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

interface DeviceTableRowProps {
  device: DeviceResponseDTO;
  pollingStatuses: Record<string, PollingStatus>;
}

export function DeviceTableRow({ device, pollingStatuses }: DeviceTableRowProps) {
  const router = useRouter();

  return (
    <Table.Row onClick={() => router.push(`/devices/${device.id}`)}>
      <Table.Cell>
        <div className="font-medium text-gray-900 dark:text-gray-100">{device.name}</div>
        {device.serialNumber && (
          <div className="text-xs text-gray-500 dark:text-gray-400">{device.serialNumber}</div>
        )}
      </Table.Cell>
      <Table.Cell>
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
        <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
          {STATUS_LABELS[device.status] ?? device.status}
        </Badge>
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
  );
}
