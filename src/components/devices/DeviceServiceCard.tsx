'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { DeviceResponseDTO } from '@/types/device.types';
import { Badge, Card, LoadingSpinner } from '@/components/ui';
import { useInstallation } from '@/hooks/useInstallation';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_VARIANTS } from '@/constants/contracted-service.constants';

/** The categories that are meant to back a customer's service. */
const SUBSCRIBER_CATEGORIES = new Set(['CPE', 'WIRELESS_CPE']);

const linkClass = 'text-brand-600 dark:text-brand-400 hover:underline';

/**
 * Which customer this unit serves. The only link is the contracted service, and
 * a device backs at most one live service — cancelling releases it — so
 * `?deviceId=` answers 0 or 1 items, never a cancelled one.
 */
export function DeviceServiceCard({ device }: { device: DeviceResponseDTO }) {
  const { modules } = useInstallation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['contractedServices', 'byDevice', device.id],
    queryFn: async () => {
      const r = await apiService.listContractedServices({ deviceId: device.id });
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar el servicio contratado');
      return r.data.contractedServices[0] ?? null;
    },
    enabled: modules.customers,
  });

  if (!modules.customers) return null;
  // Infrastructure without a service is the normal case; only say "none" where
  // a service is what the operator would expect to find.
  const expectsService = SUBSCRIBER_CATEGORIES.has(device.category ?? '') || device.ownerType === 'CLIENT';
  if (!isLoading && !isError && !data && !expectsService) return null;

  return (
    <Card>
      <Card.Header>
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Servicio Contratado</h2>
            {data && <Badge variant={CONTRACT_STATUS_VARIANTS[data.status]}>{CONTRACT_STATUS_LABELS[data.status]}</Badge>}
          </div>
          {data && (
            <Link href={`/contracted-services/${data.id}`} className={`text-sm font-medium ${linkClass}`}>
              Ver servicio
            </Link>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {isLoading ? (
          <div className="flex justify-center py-4"><LoadingSpinner /></div>
        ) : isError ? (
          <p className="text-sm text-red-700 dark:text-red-400">No se pudo cargar el servicio contratado.</p>
        ) : !data ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Este dispositivo no está asignado a ningún servicio. Se asigna desde la ficha del cliente.
          </p>
        ) : (
          <>
            <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Cliente</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  <Link href={`/customers/${data.customer.id}`} className={linkClass}>{data.customer.fullName}</Link>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Teléfono</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{data.customer.phone}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Plan</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  <Link href={`/service-plans/${data.servicePlan.id}`} className={linkClass}>{data.servicePlan.name}</Link>
                  <span className="ml-2 font-mono text-gray-500 dark:text-gray-400">
                    {data.servicePlan.downloadMbps}↓ / {data.servicePlan.uploadMbps}↑ Mbps
                  </span>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Inicio</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{new Date(data.startDate).toLocaleDateString('es')}</dd>
              </div>
            </dl>
            {data.status === 'SUSPENDED' && (
              <p className="mt-4 text-sm text-yellow-800 dark:text-yellow-400">
                Servicio suspendido: la conexión de este dispositivo se limita en el router.
              </p>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
