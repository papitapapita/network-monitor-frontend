'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  CustomerDTO, UpdateCustomerDTO,
  ServicePlanDTO, ContractedServiceDTO,
  ContractedServiceStatus, ContractedServiceTargetStatus,
  CreateContractedServiceDTO, UpdateContractedServiceDTO,
} from '@/types/customer.types';
import { DeviceResponseDTO } from '@/types/device.types';
import { ServiceEnforcementStatusDTO } from '@/types/enforcement.types';
import { Card, Button, Input, Select, LoadingSpinner, Badge, Modal } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import type { BadgeVariant } from '@/components/ui';

const CONTRACT_STATUS_LABELS: Record<ContractedServiceStatus, string> = {
  PENDING: 'Pendiente',
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
};
const CONTRACT_STATUS_VARIANTS: Record<ContractedServiceStatus, BadgeVariant> = {
  PENDING: 'draft',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'danger',
};

// The backend only accepts these as update targets; PENDING is a start state.
const CONTRACT_TARGET_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export default function CustomerDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id: customerId } = useParams() as { id: string };

  // ── Customer ───────────────────────────────────────────────
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', cedula: '' });

  const makeForm = (c: CustomerDTO) => ({ fullName: c.fullName, phone: c.phone, email: c.email ?? '', cedula: c.cedula ?? '' });

  const fetchCustomer = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const r = await apiService.getCustomer(customerId);
    if (r.success && r.data) { setCustomer(r.data); setForm(makeForm(r.data)); }
    else setLoadError(r.error || 'Error al cargar el cliente');
    setIsLoading(false);
  }, [customerId]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) setFormErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) errors.fullName = 'El nombre es requerido';
    if (!form.phone.trim()) errors.phone = 'El teléfono es requerido';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setSaveError(null);
    const dto: UpdateCustomerDTO = { fullName: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim() || null, cedula: form.cedula.trim() || null };
    const r = await apiService.updateCustomer(customerId, dto);
    if (r.success && r.data) {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setCustomer(r.data);
      setIsEditing(false);
    } else {
      setSaveError(r.error || 'Error al actualizar el cliente');
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const r = await apiService.deleteCustomer(customerId);
    setIsDeleting(false);
    if (r.success) {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.push('/customers');
    } else {
      setShowDeleteModal(false);
      setLoadError(r.error || 'Error al eliminar el cliente');
    }
  };

  // ── Contracted Services ────────────────────────────────────
  const [contracts, setContracts] = useState<ContractedServiceDTO[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [servicePlans, setServicePlans] = useState<ServicePlanDTO[]>([]);
  const [cpeDevices, setCpeDevices] = useState<DeviceResponseDTO[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ servicePlanId: '', deviceId: '', startDate: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<ContractedServiceTargetStatus>('ACTIVE');
  const [editPlanId, setEditPlanId] = useState('');
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingContract, setIsSavingContract] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);
  // Suspend/reactivate is kept out of the edit form: it throttles the customer's
  // link and sends them a WhatsApp, so it gets its own confirmation.
  const [statusAction, setStatusAction] = useState<{ contract: ContractedServiceDTO; action: 'SUSPEND' | 'REACTIVATE' } | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Whether each suspended service is really throttled on the router. A missing
  // entry means "unknown" (router unreachable / enforcement not configured) —
  // deliberately distinct from a known `enforced: false`.
  const [enforcement, setEnforcement] = useState<Record<string, { enforced: boolean; targetIp: string | null }>>({});
  const [enforcementCheckedAt, setEnforcementCheckedAt] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // One router round-trip covers every suspended service, so this is preferred
  // over per-row checks; the per-row endpoint is only used by "Verificar".
  const fetchEnforcement = useCallback(async (suspended: ContractedServiceDTO[]) => {
    const r = await apiService.listEnforcedSuspensions();
    if (!r.success || !r.data) {
      setEnforcement({});
      setEnforcementCheckedAt(null);
      return;
    }
    const targetIps = new Map(r.data.enforcements.map((e) => [e.contractedServiceId, e.targetIp]));
    const next: Record<string, { enforced: boolean; targetIp: string | null }> = {};
    for (const cs of suspended) {
      next[cs.id] = { enforced: targetIps.has(cs.id), targetIp: targetIps.get(cs.id) ?? null };
    }
    setEnforcement(next);
    setEnforcementCheckedAt(r.data.checkedAt);
  }, []);

  const fetchContracts = useCallback(async () => {
    setContractsLoading(true);
    const r = await apiService.listContractedServices({ customerId, limit: 100 });
    if (r.success && r.data) {
      setContracts(r.data.contractedServices);
      // Only hit the router when there is something to enforce.
      const suspended = r.data.contractedServices.filter((c) => c.status === 'SUSPENDED');
      if (suspended.length > 0) fetchEnforcement(suspended);
    }
    setContractsLoading(false);
  }, [customerId, fetchEnforcement]);

  useEffect(() => {
    fetchContracts();
    apiService.listServicePlans({ limit: 100 }).then((r) => { if (r.success && r.data) setServicePlans(r.data.servicePlans); });
    apiService.listDevices({ category: 'CPE', limit: 200 }).then((r) => { if (r.success && r.data) setCpeDevices(r.data.devices); });
    apiService.listDevices({ category: 'WIRELESS_CPE', limit: 200 }).then((r) => {
      if (r.success && r.data) setCpeDevices((p) => [...p, ...r.data!.devices]);
    });
  }, [fetchContracts]);

  const handleVerifyEnforcement = async (id: string) => {
    setVerifyingId(id);
    const r = await apiService.getContractedServiceEnforcement(id);
    setVerifyingId(null);
    if (r.success && r.data) {
      const data: ServiceEnforcementStatusDTO = r.data;
      setEnforcement((p) => ({ ...p, [id]: { enforced: data.enforced, targetIp: data.targetIp } }));
      setEnforcementCheckedAt(data.checkedAt);
    } else {
      // Drop the entry rather than showing a stale answer as current.
      setEnforcement((p) => { const n = { ...p }; delete n[id]; return n; });
      setStatusNotice(r.error || 'No se pudo consultar el router; el estado de la limitación es desconocido.');
    }
  };

  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!addForm.servicePlanId) errors.servicePlanId = 'Selecciona un plan';
    setAddFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsAdding(true);
    setAddError(null);
    const dto: CreateContractedServiceDTO = {
      customerId,
      servicePlanId: addForm.servicePlanId,
      deviceId: addForm.deviceId || null,
      startDate: addForm.startDate ? new Date(addForm.startDate).toISOString() : undefined,
    };
    const r = await apiService.createContractedService(dto);
    if (r.success) {
      setShowAddForm(false);
      setAddForm({ servicePlanId: '', deviceId: '', startDate: '' });
      fetchContracts();
    } else {
      setAddError(r.error || 'Error al crear el servicio');
    }
    setIsAdding(false);
  };

  const handleSaveContract = async (id: string) => {
    // Activating requires a device: the backend rejects ACTIVE without one.
    if (editStatus === 'ACTIVE' && !editDeviceId) {
      setEditError('Asigna un dispositivo CPE para poder activar el servicio.');
      return;
    }
    setIsSavingContract(true);
    setEditError(null);
    const dto: UpdateContractedServiceDTO = {
      status: editStatus,
      servicePlanId: editPlanId || undefined,
      deviceId: editDeviceId || null,
    };
    const r = await apiService.updateContractedService(id, dto);
    setIsSavingContract(false);
    if (r.success) {
      setEditingContractId(null);
      fetchContracts();
    } else {
      setEditError(r.error || 'No se pudo actualizar el servicio');
    }
  };

  const handleDeleteContract = async (id: string) => {
    setDeletingContractId(id);
    await apiService.deleteContractedService(id);
    setDeletingContractId(null);
    fetchContracts();
  };

  const handleStatusAction = async () => {
    if (!statusAction) return;
    const { contract, action } = statusAction;
    setIsChangingStatus(true);
    setStatusActionError(null);
    const r = await apiService.updateContractedService(contract.id, {
      status: action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE',
    });
    setIsChangingStatus(false);
    if (r.success) {
      setStatusAction(null);
      // Enforcement is eventually consistent — say so instead of leaving the
      // operator wondering why the customer is still online.
      setStatusNotice(
        action === 'SUSPEND'
          ? 'Servicio suspendido. La limitación en el router se aplica en segundo plano (hasta ~60 s). Usa "Verificar" en el servicio para confirmar que ya está aplicada.'
          : 'Servicio reactivado. La limitación se retira en segundo plano y puede tardar hasta ~60 s en surtir efecto.'
      );
      fetchContracts();
    } else {
      setStatusActionError(r.error || 'No se pudo cambiar el estado del servicio');
    }
  };

  const planName = (id: string) => servicePlans.find((p) => p.id === id)?.name ?? id;
  const deviceOf = (id: string | null) => (id ? cpeDevices.find((x) => x.id === id) ?? null : null);
  const deviceName = (id: string | null) => {
    if (!id) return '—';
    const d = deviceOf(id);
    return d ? `${d.name} (${d.ipAddress ?? 'sin IP'})` : id;
  };

  // The throttle targets the assigned device's IP; without one the status still
  // changes but nothing is enforced. Unknown devices (not in the CPE lists) are
  // left alone rather than warned about wrongly.
  const throttleUnavailable = (cs: ContractedServiceDTO) => {
    if (!cs.deviceId) return true;
    const d = deviceOf(cs.deviceId);
    return d !== null && !d.ipAddress;
  };

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" message="Cargando cliente..." /></div>;
  if (loadError && !customer) return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{loadError}</p>
        <div className="mt-4 flex gap-3"><Button variant="outline" onClick={() => router.back()}>Volver</Button><Button onClick={fetchCustomer}>Reintentar</Button></div>
      </div>
    </div>
  );
  if (!customer) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar cliente"
        message={`¿Eliminar a "${customer.fullName}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      <Modal
        isOpen={statusAction !== null}
        onClose={() => { setStatusAction(null); setStatusActionError(null); }}
        title={statusAction?.action === 'SUSPEND' ? 'Suspender servicio' : 'Reactivar servicio'}
        size="md"
      >
        {statusAction && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-700 dark:text-gray-300">
              Servicio: <strong>{planName(statusAction.contract.servicePlanId)}</strong> · Dispositivo:{' '}
              {deviceName(statusAction.contract.deviceId)}
            </p>

            {statusAction.action === 'SUSPEND' ? (
              <>
                <p className="text-gray-700 dark:text-gray-300">Al suspender, el sistema automáticamente:</p>
                <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
                  <li>Limita la conexión del cliente a <strong>1 kbps</strong> en el router principal.</li>
                  <li>Envía un <strong>mensaje de WhatsApp</strong> a {customer.phone}.</li>
                </ul>
                {throttleUnavailable(statusAction.contract) && (
                  <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
                    Este servicio no tiene un dispositivo con IP asignada: el estado cambiará a
                    Suspendido, pero <strong>no se aplicará la limitación</strong> de velocidad.
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-gray-700 dark:text-gray-300">
                  Al reactivar se retira la limitación de velocidad. No se envía ningún mensaje al cliente.
                </p>
                {!statusAction.contract.deviceId && (
                  <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
                    El servicio no tiene dispositivo asignado; asigna uno con &quot;Editar&quot; antes de reactivarlo.
                  </div>
                )}
              </>
            )}

            {statusActionError && (
              <p className="text-red-600 dark:text-red-400">{statusActionError}</p>
            )}
          </div>
        )}
        <Modal.Footer>
          <Button variant="outline" onClick={() => { setStatusAction(null); setStatusActionError(null); }} disabled={isChangingStatus}>
            Cancelar
          </Button>
          <Button
            variant={statusAction?.action === 'SUSPEND' ? 'danger' : 'primary'}
            onClick={handleStatusAction}
            isLoading={isChangingStatus}
            disabled={statusAction?.action === 'REACTIVATE' && !statusAction.contract.deviceId}
          >
            {statusAction?.action === 'SUSPEND' ? 'Suspender' : 'Reactivar'}
          </Button>
        </Modal.Footer>
      </Modal>

      {loadError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"><p className="text-red-800 dark:text-red-400">{loadError}</p></div>}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>← Atrás</Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere">{customer.fullName}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{customer.phone}</p>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>Eliminar</Button>
      </div>

      {/* Customer info */}
      <div>
        <div className="flex justify-end mb-2">
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Editar</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setForm(makeForm(customer)); setFormErrors({}); }} disabled={isSaving}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} isLoading={isSaving}>Guardar</Button>
            </div>
          )}
        </div>

        {saveError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3 text-sm text-red-800 dark:text-red-400">{saveError}</div>}

        <Card>
          <Card.Header><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información del Cliente</h2></Card.Header>
          <Card.Body>
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input label="Nombre Completo" name="fullName" value={form.fullName} onChange={handleChange} error={formErrors.fullName} required fullWidth />
                </div>
                <Input label="Teléfono" name="phone" value={form.phone} onChange={handleChange} error={formErrors.phone} required fullWidth />
                <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} fullWidth />
                <Input label="Cédula" name="cedula" value={form.cedula} onChange={handleChange} fullWidth />
              </div>
            ) : (
              <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Nombre', value: customer.fullName },
                  { label: 'Teléfono', value: customer.phone, mono: true },
                  { label: 'Email', value: customer.email ?? '—' },
                  { label: 'Cédula', value: customer.cedula ?? '—', mono: true },
                  { label: 'Registrado', value: new Date(customer.createdAt).toLocaleDateString('es') },
                  { label: 'ID', value: customer.id, mono: true, small: true },
                ].map(({ label, value, mono, small }) => (
                  <div key={label}>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className={`mt-1 text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : ''}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Contracted Services */}
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Servicios Contratados
              {contracts.length > 0 && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({contracts.length})</span>}
            </h2>
            {!showAddForm && (
              <Button size="sm" onClick={() => setShowAddForm(true)}>Agregar Servicio</Button>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {statusNotice && (
            <div className="mb-4 p-3 rounded-md text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 flex justify-between items-start gap-3">
              <span>{statusNotice}</span>
              <button
                type="button"
                onClick={() => setStatusNotice(null)}
                className="text-blue-800 dark:text-blue-300 font-medium shrink-0"
                aria-label="Cerrar aviso"
              >
                ×
              </button>
            </div>
          )}
          {showAddForm && (
            <form onSubmit={handleAddContract} className="mb-6 p-4 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Nuevo Servicio Contratado</p>
              {addError && <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  label="Plan"
                  value={addForm.servicePlanId}
                  onChange={(e) => { setAddForm((p) => ({ ...p, servicePlanId: e.target.value })); if (addFormErrors.servicePlanId) setAddFormErrors((p) => { const n = { ...p }; delete n.servicePlanId; return n; }); }}
                  options={[{ value: '', label: 'Seleccionar plan' }, ...servicePlans.filter((p) => p.isActive).map((p) => ({ value: p.id, label: `${p.name} (${p.downloadMbps}↓/${p.uploadMbps}↑ Mbps)` }))]}
                  error={addFormErrors.servicePlanId}
                  fullWidth
                />
                <Select
                  label="Dispositivo CPE (opcional)"
                  value={addForm.deviceId}
                  onChange={(e) => setAddForm((p) => ({ ...p, deviceId: e.target.value }))}
                  options={[{ value: '', label: 'Sin dispositivo' }, ...cpeDevices.map((d) => ({ value: d.id, label: `${d.name}${d.ipAddress ? ` – ${d.ipAddress}` : ''}` }))]}
                  fullWidth
                />
                <Input
                  label="Fecha de inicio (opcional)"
                  type="date"
                  value={addForm.startDate}
                  onChange={(e) => setAddForm((p) => ({ ...p, startDate: e.target.value }))}
                  fullWidth
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" isLoading={isAdding}>Guardar</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowAddForm(false); setAddError(null); setAddFormErrors({}); }}>Cancelar</Button>
              </div>
            </form>
          )}

          {contractsLoading ? (
            <div className="flex justify-center py-4"><LoadingSpinner message="Cargando servicios..." /></div>
          ) : contracts.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Sin servicios contratados.</p>
          ) : (
            <div className="space-y-3">
              {contracts.map((cs) => (
                <div key={cs.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  {editingContractId === cs.id ? (
                    <div className="space-y-3">
                      {cs.status === 'PENDING' && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Estado actual: <strong>Pendiente</strong>. Elige el nuevo estado; para activarlo debe tener un dispositivo asignado.
                        </p>
                      )}
                      {editError && (
                        <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>
                      )}
                      <div className="flex flex-wrap gap-3 items-end">
                        <Select
                          label="Plan"
                          value={editPlanId}
                          onChange={(e) => setEditPlanId(e.target.value)}
                          options={servicePlans.filter((p) => p.isActive || p.id === cs.servicePlanId).map((p) => ({ value: p.id, label: p.name }))}
                          fullWidth={false}
                        />
                        <Select
                          label="Dispositivo CPE"
                          value={editDeviceId}
                          onChange={(e) => { setEditDeviceId(e.target.value); setEditError(null); }}
                          options={[{ value: '', label: 'Sin dispositivo' }, ...cpeDevices.map((d) => ({ value: d.id, label: `${d.name}${d.ipAddress ? ` – ${d.ipAddress}` : ''}` }))]}
                          fullWidth={false}
                        />
                        <Select
                          label="Estado"
                          value={editStatus}
                          onChange={(e) => { setEditStatus(e.target.value as ContractedServiceTargetStatus); setEditError(null); }}
                          options={CONTRACT_TARGET_STATUS_OPTIONS}
                          fullWidth={false}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveContract(cs.id)} isLoading={isSavingContract}>Guardar</Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingContractId(null); setEditError(null); }}>Cancelar</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{planName(cs.servicePlanId)}</span>
                          <Badge variant={CONTRACT_STATUS_VARIANTS[cs.status]}>{CONTRACT_STATUS_LABELS[cs.status]}</Badge>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Dispositivo: {deviceName(cs.deviceId)} · Inicio: {new Date(cs.startDate).toLocaleDateString('es')}
                        </div>
                        {cs.status === 'SUSPENDED' && (
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            {enforcement[cs.id] === undefined ? (
                              <Badge variant="neutral">Limitación: estado desconocido</Badge>
                            ) : enforcement[cs.id].enforced ? (
                              <Badge variant="success">
                                Limitación aplicada{enforcement[cs.id].targetIp ? ` — ${enforcement[cs.id].targetIp}` : ''}
                              </Badge>
                            ) : (
                              <Badge variant="warning">Limitación aún no aplicada</Badge>
                            )}
                            <button
                              type="button"
                              onClick={() => handleVerifyEnforcement(cs.id)}
                              disabled={verifyingId === cs.id}
                              className="text-blue-600 dark:text-blue-400 underline disabled:opacity-50"
                            >
                              {verifyingId === cs.id ? 'Verificando…' : 'Verificar'}
                            </button>
                            {enforcementCheckedAt && (
                              <span className="text-gray-400 dark:text-gray-500">
                                {new Date(enforcementCheckedAt).toLocaleTimeString('es')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {(cs.status === 'ACTIVE' || cs.status === 'PENDING') && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => { setStatusActionError(null); setStatusNotice(null); setStatusAction({ contract: cs, action: 'SUSPEND' }); }}
                          >
                            Suspender
                          </Button>
                        )}
                        {cs.status === 'SUSPENDED' && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => { setStatusActionError(null); setStatusNotice(null); setStatusAction({ contract: cs, action: 'REACTIVATE' }); }}
                          >
                            Reactivar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingContractId(cs.id);
                            // PENDING is not a valid update target — offer ACTIVE as the next step.
                            setEditStatus(cs.status === 'PENDING' ? 'ACTIVE' : cs.status);
                            setEditPlanId(cs.servicePlanId);
                            setEditDeviceId(cs.deviceId ?? '');
                            setEditError(null);
                          }}
                        >
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteContract(cs.id)} isLoading={deletingContractId === cs.id}>Eliminar</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
