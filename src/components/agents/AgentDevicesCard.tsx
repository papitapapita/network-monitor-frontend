'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { AgentDTO } from '@/types/agent.types';
import { Badge, Card, LoadingSpinner, getDeviceStatusBadgeVariant } from '@/components/ui';
import { DEVICE_STATUS_LABELS } from '@/constants/device.constants';

/** Enough to recognize the site at a glance; the rest is one click away in the filtered list. */
const PREVIEW_LIMIT = 10;

/**
 * The devices behind this agent (DEV-172). A preview, not a second device
 * list: the full, filterable one is the device page with the agent filter on.
 */
export function AgentDevicesCard({ agent }: { agent: AgentDTO }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['devices', 'byAgent', agent.id],
    queryFn: async () => {
      const r = await apiService.listDevices({ agentId: agent.id, limit: PREVIEW_LIMIT, sortBy: 'name', sortOrder: 'ASC' });
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los dispositivos');
      return r.data;
    },
  });

  const listHref = `/devices?agentId=${agent.id}`;

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Dispositivos <span className="text-gray-500 dark:text-gray-400 font-normal">({agent.deviceCount})</span>
          </h2>
          {agent.deviceCount > 0 && (
            <Link href={listHref} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
              Ver en la lista de dispositivos
            </Link>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{(error as Error).message}</p>
        ) : !data || data.devices.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ningún dispositivo está detrás de este agente todavía.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.devices.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/devices/${d.id}`} className="min-w-0 font-medium text-blue-600 dark:text-blue-400 hover:underline wrap-anywhere">
                    {d.name}
                  </Link>
                  <span className="flex items-center gap-3">
                    {d.ipAddress && <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{d.ipAddress}</span>}
                    <Badge variant={getDeviceStatusBadgeVariant(d.status)}>{DEVICE_STATUS_LABELS[d.status] ?? d.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
            {data.total > data.devices.length && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Y {data.total - data.devices.length} más.{' '}
                <Link href={listHref} className="text-blue-600 dark:text-blue-400 hover:underline">
                  Ver todos
                </Link>
              </p>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
