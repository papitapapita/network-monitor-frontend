'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Badge, BackLink, Button, Card, LoadingSpinner, getDeviceStatusBadgeVariant } from '@/components/ui';
import { useGoBack } from '@/hooks/useGoBack';
import { useInstallation } from '@/hooks/useInstallation';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_VARIANTS, formatPlanPrice } from '@/constants/contracted-service.constants';
import { DEVICE_STATUS_LABELS, deviceCategoryLabel } from '@/constants/device.constants';
import { formatPaymentDay } from '@/constants/billing-settings.constants';

const linkClass = 'text-brand-600 dark:text-brand-400 hover:underline';

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`mt-1 text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : ''}`}>{children}</dd>
    </div>
  );
}

/**
 * One contracted service: who it is for, on which plan, through which unit.
 * Read-only — plan, device and status changes stay on the customer page,
 * next to the customer's other services.
 */
export default function ContractedServiceDetailPage() {
  const { id } = useParams() as { id: string };
  const goBack = useGoBack('/customers');
  const { modules } = useInstallation();

  const { data: service, isLoading, error, refetch } = useQuery({
    queryKey: ['contractedServices', 'detail', id],
    queryFn: async () => {
      const r = await apiService.getContractedService(id);
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar el servicio');
      return r.data;
    },
  });

  // Asked only for a suspension: it is a live router call, and a failure
  // means "unknown", never "not throttled".
  const suspended = service?.status === 'SUSPENDED';
  const enforcement = useQuery({
    queryKey: ['contractedServices', 'enforcement', id],
    queryFn: async () => {
      const r = await apiService.getContractedServiceEnforcement(id);
      if (!r.success || !r.data) throw new Error(r.error || 'Estado desconocido');
      return r.data;
    },
    enabled: suspended && modules.enforcement,
    retry: false,
  });

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error || !service) return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{error?.message || 'Servicio no encontrado'}</p>
        <div className="mt-4 flex gap-3"><Button variant="outline" onClick={() => goBack()}>Volver</Button><Button onClick={() => refetch()}>Reintentar</Button></div>
      </div>
    </div>
  );

  const { customer, servicePlan, device } = service;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <BackLink onClick={() => goBack()} className="mb-2" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere">{servicePlan.name}</h1>
            <Badge variant={CONTRACT_STATUS_VARIANTS[service.status]}>{CONTRACT_STATUS_LABELS[service.status]}</Badge>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Servicio contratado de <Link href={`/customers/${customer.id}`} className={linkClass}>{customer.fullName}</Link>
            {' '}· desde {new Date(service.startDate).toLocaleDateString('es')}
          </p>
        </div>
        <Link href={`/customers/${customer.id}`} className={`text-sm font-medium ${linkClass}`}>
          Gestionar en la ficha del cliente
        </Link>
      </div>

      {suspended && modules.enforcement && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          {enforcement.isLoading ? (
            <Badge variant="neutral">Verificando limitación…</Badge>
          ) : enforcement.data?.enforced ? (
            <Badge variant="success">
              Limitación aplicada{enforcement.data.targetIp ? ` — ${enforcement.data.targetIp}` : ''}
            </Badge>
          ) : enforcement.data ? (
            <Badge variant="warning">Limitación aún no aplicada</Badge>
          ) : (
            <Badge variant="neutral">Limitación: estado desconocido</Badge>
          )}
          <button
            type="button"
            onClick={() => enforcement.refetch()}
            disabled={enforcement.isFetching}
            className="text-brand-600 dark:text-brand-400 underline disabled:opacity-50"
          >
            {enforcement.isFetching ? 'Verificando…' : 'Verificar'}
          </button>
        </div>
      )}

      <Card>
        <Card.Header><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cliente</h2></Card.Header>
        <Card.Body>
          <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Nombre"><Link href={`/customers/${customer.id}`} className={linkClass}>{customer.fullName}</Link></Field>
            <Field label="Teléfono">{customer.phone}</Field>
            <Field label="Correo">{customer.email || '—'}</Field>
            <Field label="Cédula">{customer.cedula || '—'}</Field>
          </dl>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Plan</h2></Card.Header>
        <Card.Body>
          <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Nombre">
              <Link href={`/service-plans/${servicePlan.id}`} className={linkClass}>{servicePlan.name}</Link>
              {!servicePlan.isActive && <Badge variant="neutral" className="ml-2">Inactivo</Badge>}
            </Field>
            <Field label="Velocidad" mono>{servicePlan.downloadMbps}↓ / {servicePlan.uploadMbps}↑ Mbps</Field>
            <Field label="Precio mensual">{formatPlanPrice(servicePlan.monthlyPrice)}</Field>
            <Field label="Día de pago">{formatPaymentDay(service.paymentDay)}</Field>
          </dl>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dispositivo</h2></Card.Header>
        <Card.Body>
          {!device ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {service.status === 'CANCELLED'
                ? 'El dispositivo se liberó al cancelar el servicio.'
                : 'Sin dispositivo asignado.'}
              {service.status === 'PENDING' && ' Asigna uno desde la ficha del cliente para poder activar el servicio.'}
            </p>
          ) : (
            <>
              <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <Field label="Nombre">
                  {device.deletedAt ? device.name : <Link href={`/devices/${device.id}`} className={linkClass}>{device.name}</Link>}
                </Field>
                <Field label="Estado">
                  <Badge variant={getDeviceStatusBadgeVariant(device.status)}>{DEVICE_STATUS_LABELS[device.status] ?? device.status}</Badge>
                </Field>
                <Field label="Dirección IP" mono>{device.ipAddress || '—'}</Field>
                <Field label="Dirección MAC" mono>{device.macAddress || '—'}</Field>
                <Field label="Categoría">{deviceCategoryLabel(device.category)}</Field>
              </dl>
              {device.deletedAt && (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  El dispositivo está en la <Link href="/devices/trash" className={linkClass}>papelera</Link> desde
                  el {new Date(device.deletedAt).toLocaleDateString('es')}.
                </p>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
