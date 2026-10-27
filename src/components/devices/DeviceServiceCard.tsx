'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { DeviceResponseDTO } from '@/types/device.types';
import { Badge, Button, Card, Combobox, IconButton, Input, LoadingSpinner, PlusIcon, Select, isCancelEscape } from '@/components/ui';
import { useInstallation } from '@/hooks/useInstallation';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/contexts/toast.context';
import { fetchAllCustomers } from '@/hooks/useCatalogs';
import { PAYMENT_DAY_OPTIONS } from '@/constants/billing-settings.constants';
import type { PaymentDay } from '@/types/customer.types';
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
          <NewServiceForm device={device} />
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

const emptyForm = { customerId: '', servicePlanId: '', startDate: '', paymentDay: '30' };

/**
 * Contracts a service on this device for a customer picked here, so an installer
 * standing at the unit doesn't have to go find the customer first. Same request
 * as the customer page's form, with the device already chosen.
 */
function NewServiceForm({ device }: { device: DeviceResponseDTO }) {
  const { canWrite } = usePermissions();
  const { showSuccess, showError, showFormErrors } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Shares the `['customers']` cache with the other customer pickers.
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchAllCustomers,
    enabled: isOpen,
  });
  const { data: plans = [] } = useQuery({
    queryKey: ['servicePlans', 'active'],
    queryFn: async () => {
      const r = await apiService.listServicePlans({ limit: 100 });
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los planes');
      return r.data.servicePlans.filter((p) => p.isActive);
    },
    enabled: isOpen,
  });

  const close = () => {
    setIsOpen(false);
    setForm(emptyForm);
    setErrors({});
  };

  const setField = (field: keyof typeof emptyForm, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.customerId) next.customerId = 'Selecciona un cliente';
    if (!form.servicePlanId) next.servicePlanId = 'Selecciona un plan';
    setErrors(next);
    if (showFormErrors(next)) return;

    setIsSaving(true);
    const r = await apiService.createContractedService({
      customerId: form.customerId,
      servicePlanId: form.servicePlanId,
      deviceId: device.id,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
      paymentDay: Number(form.paymentDay) as PaymentDay,
    });
    setIsSaving(false);
    if (r.success) {
      showSuccess('Servicio contratado creado.');
      close();
      queryClient.invalidateQueries({ queryKey: ['contractedServices'] });
    } else {
      showError(r.error || 'Error al crear el servicio');
    }
  };

  if (!isOpen) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">Este dispositivo no está asignado a ningún servicio.</p>
        {canWrite && <IconButton icon={<PlusIcon />} label="Agregar servicio" variant="primary" onClick={() => setIsOpen(true)} />}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={(e) => { if (isCancelEscape(e)) close(); }} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Combobox
          label="Cliente"
          value={form.customerId}
          onChange={(id) => setField('customerId', id)}
          options={customers.map((c) => ({
            value: c.id,
            label: c.fullName,
            sublabel: [c.phone, c.cedula].filter(Boolean).join(' · '),
          }))}
          placeholder={customersLoading ? 'Cargando clientes...' : 'Buscar por nombre, teléfono o cédula'}
          error={errors.customerId}
          required
          fullWidth
        />
        <Select
          label="Plan"
          value={form.servicePlanId}
          onChange={(e) => setField('servicePlanId', e.target.value)}
          options={[{ value: '', label: 'Seleccionar plan' }, ...plans.map((p) => ({ value: p.id, label: `${p.name} (${p.downloadMbps}↓/${p.uploadMbps}↑ Mbps)` }))]}
          error={errors.servicePlanId}
          required
          fullWidth
        />
        <Input
          label="Fecha de inicio (opcional)"
          type="date"
          value={form.startDate}
          onChange={(e) => setField('startDate', e.target.value)}
          fullWidth
        />
        <Select
          label="Día de pago"
          value={form.paymentDay}
          onChange={(e) => setField('paymentDay', e.target.value)}
          options={PAYMENT_DAY_OPTIONS}
          info="El día del mes en que vence la factura de este servicio."
          fullWidth
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" isLoading={isSaving}>Guardar</Button>
        <Button type="button" variant="outline" size="sm" onClick={close}>Cancelar</Button>
      </div>
    </form>
  );
}
