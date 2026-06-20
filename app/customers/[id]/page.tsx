'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  CustomerDTO, UpdateCustomerDTO,
  ServicePlanDTO, ContractedServiceDTO,
  ContractedServiceStatus, CreateContractedServiceDTO, UpdateContractedServiceDTO,
} from '@/types/customer.types';
import { DeviceResponseDTO } from '@/types/device.types';
import { Card, Button, Input, Select, LoadingSpinner, Badge } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import type { BadgeVariant } from '@/components/ui';

const CONTRACT_STATUS_LABELS: Record<ContractedServiceStatus, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
};
const CONTRACT_STATUS_VARIANTS: Record<ContractedServiceStatus, BadgeVariant> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'danger',
};

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
  const [editStatus, setEditStatus] = useState<ContractedServiceStatus>('ACTIVE');
  const [editPlanId, setEditPlanId] = useState('');
  const [isSavingContract, setIsSavingContract] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    setContractsLoading(true);
    const r = await apiService.listContractedServices({ customerId, limit: 100 });
    if (r.success && r.data) setContracts(r.data.contractedServices);
    setContractsLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchContracts();
    apiService.listServicePlans({ limit: 100 }).then((r) => { if (r.success && r.data) setServicePlans(r.data.servicePlans); });
    apiService.listDevices({ category: 'CPE', limit: 200 }).then((r) => { if (r.success && r.data) setCpeDevices(r.data.devices); });
    apiService.listDevices({ category: 'WIRELESS_CPE', limit: 200 }).then((r) => {
      if (r.success && r.data) setCpeDevices((p) => [...p, ...r.data!.devices]);
    });
  }, [fetchContracts]);

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
    setIsSavingContract(true);
    const dto: UpdateContractedServiceDTO = { status: editStatus, servicePlanId: editPlanId || undefined };
    const r = await apiService.updateContractedService(id, dto);
    if (r.success) { setEditingContractId(null); fetchContracts(); }
    setIsSavingContract(false);
  };

  const handleDeleteContract = async (id: string) => {
    setDeletingContractId(id);
    await apiService.deleteContractedService(id);
    setDeletingContractId(null);
    fetchContracts();
  };

  const planName = (id: string) => servicePlans.find((p) => p.id === id)?.name ?? id;
  const deviceName = (id: string | null) => {
    if (!id) return '—';
    const d = cpeDevices.find((x) => x.id === id);
    return d ? `${d.name} (${d.ipAddress ?? 'sin IP'})` : id;
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

      {loadError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"><p className="text-red-800 dark:text-red-400">{loadError}</p></div>}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>← Atrás</Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{customer.fullName}</h1>
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
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
                    <div className="flex flex-wrap gap-3 items-end">
                      <Select
                        label="Plan"
                        value={editPlanId}
                        onChange={(e) => setEditPlanId(e.target.value)}
                        options={servicePlans.filter((p) => p.isActive || p.id === cs.servicePlanId).map((p) => ({ value: p.id, label: p.name }))}
                        fullWidth={false}
                      />
                      <Select
                        label="Estado"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as ContractedServiceStatus)}
                        options={[
                          { value: 'ACTIVE', label: 'Activo' },
                          { value: 'SUSPENDED', label: 'Suspendido' },
                          { value: 'CANCELLED', label: 'Cancelado' },
                        ]}
                        fullWidth={false}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveContract(cs.id)} isLoading={isSavingContract}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingContractId(null)}>Cancelar</Button>
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
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingContractId(cs.id); setEditStatus(cs.status); setEditPlanId(cs.servicePlanId); }}>Editar</Button>
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
