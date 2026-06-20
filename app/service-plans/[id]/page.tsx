'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { ServicePlanDTO, UpdateServicePlanDTO } from '@/types/customer.types';
import { Card, Button, Input, Badge, LoadingSpinner } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';

function fmtPrice(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function ServicePlanDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useParams() as { id: string };

  const [plan, setPlan] = useState<ServicePlanDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const makeForm = (p: ServicePlanDTO) => ({
    name: p.name,
    downloadMbps: String(p.downloadMbps),
    uploadMbps: String(p.uploadMbps),
    monthlyPrice: String(p.monthlyPrice),
    description: p.description ?? '',
    isActive: p.isActive,
  });

  const [form, setForm] = useState({ name: '', downloadMbps: '', uploadMbps: '', monthlyPrice: '', description: '', isActive: true });

  const fetchPlan = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const r = await apiService.getServicePlan(id);
    if (r.success && r.data) { setPlan(r.data); setForm(makeForm(r.data)); }
    else setLoadError(r.error || 'Error al cargar el plan');
    setIsLoading(false);
  }, [id]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) setFormErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'El nombre es requerido';
    if (!form.downloadMbps || Number(form.downloadMbps) < 1) errors.downloadMbps = 'Velocidad de descarga inválida';
    if (!form.uploadMbps || Number(form.uploadMbps) < 1) errors.uploadMbps = 'Velocidad de subida inválida';
    if (form.monthlyPrice === '' || Number(form.monthlyPrice) < 0) errors.monthlyPrice = 'Precio inválido';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setSaveError(null);
    const dto: UpdateServicePlanDTO = {
      name: form.name.trim(),
      downloadMbps: Number(form.downloadMbps),
      uploadMbps: Number(form.uploadMbps),
      monthlyPrice: Number(form.monthlyPrice),
      description: form.description.trim() || null,
      isActive: form.isActive,
    };
    const r = await apiService.updateServicePlan(id, dto);
    if (r.success && r.data) {
      queryClient.invalidateQueries({ queryKey: ['servicePlans'] });
      setPlan(r.data);
      setIsEditing(false);
    } else {
      setSaveError(r.error || 'Error al actualizar el plan');
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const r = await apiService.deleteServicePlan(id);
    setIsDeleting(false);
    if (r.success) {
      queryClient.invalidateQueries({ queryKey: ['servicePlans'] });
      router.push('/service-plans');
    } else {
      setShowDeleteModal(false);
      setLoadError(r.error || 'Error al eliminar el plan');
    }
  };

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" message="Cargando plan..." /></div>;
  if (loadError && !plan) return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{loadError}</p>
        <div className="mt-4 flex gap-3"><Button variant="outline" onClick={() => router.back()}>Volver</Button><Button onClick={fetchPlan}>Reintentar</Button></div>
      </div>
    </div>
  );
  if (!plan) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar plan"
        message={`¿Eliminar el plan "${plan.name}"? Esta acción no se puede deshacer.`}
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
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{plan.name}</h1>
              <Badge variant={plan.isActive ? 'success' : 'neutral'}>{plan.isActive ? 'Activo' : 'Inactivo'}</Badge>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5 font-mono">{plan.downloadMbps}↓ / {plan.uploadMbps}↑ Mbps · {fmtPrice(plan.monthlyPrice)}/mes</p>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>Eliminar</Button>
      </div>

      <div>
        <div className="flex justify-end mb-2">
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Editar</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setForm(makeForm(plan)); setFormErrors({}); }} disabled={isSaving}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} isLoading={isSaving}>Guardar</Button>
            </div>
          )}
        </div>

        {saveError && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3 text-sm text-red-800 dark:text-red-400">{saveError}</div>}

        <Card>
          <Card.Header><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalles del Plan</h2></Card.Header>
          <Card.Body>
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input label="Nombre" name="name" value={form.name} onChange={handleChange} error={formErrors.name} required fullWidth />
                </div>
                <Input label="Descarga (Mbps)" name="downloadMbps" type="number" min={1} value={form.downloadMbps} onChange={handleChange} error={formErrors.downloadMbps} required fullWidth />
                <Input label="Subida (Mbps)" name="uploadMbps" type="number" min={1} value={form.uploadMbps} onChange={handleChange} error={formErrors.uploadMbps} required fullWidth />
                <Input label="Precio mensual (COP)" name="monthlyPrice" type="number" min={0} value={form.monthlyPrice} onChange={handleChange} error={formErrors.monthlyPrice} required fullWidth />
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="isActive" name="isActive" checked={form.isActive} onChange={handleChange} className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500" />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">Plan activo</label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={3}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Nombre', value: plan.name },
                  { label: 'Descarga', value: `${plan.downloadMbps} Mbps` },
                  { label: 'Subida', value: `${plan.uploadMbps} Mbps` },
                  { label: 'Precio mensual', value: fmtPrice(plan.monthlyPrice) },
                  { label: 'Estado', value: <Badge variant={plan.isActive ? 'success' : 'neutral'}>{plan.isActive ? 'Activo' : 'Inactivo'}</Badge> },
                  { label: 'Creado', value: new Date(plan.createdAt).toLocaleDateString('es') },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{value}</dd>
                  </div>
                ))}
                <div className="md:col-span-2">
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Descripción</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{plan.description ?? '—'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">ID</dt>
                  <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100">{plan.id}</dd>
                </div>
              </dl>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
