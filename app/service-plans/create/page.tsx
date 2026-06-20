'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CreateServicePlanDTO } from '@/types/customer.types';
import { Card, Button, Input } from '@/components/ui';

export default function CreateServicePlanPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    downloadMbps: '',
    uploadMbps: '',
    monthlyPrice: '',
    description: '',
    isActive: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) setFormErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';
    if (!formData.downloadMbps || Number(formData.downloadMbps) < 1) errors.downloadMbps = 'Velocidad de descarga inválida';
    if (!formData.uploadMbps || Number(formData.uploadMbps) < 1) errors.uploadMbps = 'Velocidad de subida inválida';
    if (formData.monthlyPrice === '' || Number(formData.monthlyPrice) < 0) errors.monthlyPrice = 'Precio inválido';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);

    const dto: CreateServicePlanDTO = {
      name: formData.name.trim(),
      downloadMbps: Number(formData.downloadMbps),
      uploadMbps: Number(formData.uploadMbps),
      monthlyPrice: Number(formData.monthlyPrice),
      description: formData.description.trim() || null,
      isActive: formData.isActive,
    };

    const result = await apiService.createServicePlan(dto);
    if (result.success && result.data) {
      queryClient.invalidateQueries({ queryKey: ['servicePlans'] });
      router.replace(`/service-plans/${result.data.id}`);
    } else {
      setError(result.error || 'Error al crear el plan');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>← Atrás</Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agregar Plan de Servicio</h1>
          <p className="text-gray-600 dark:text-gray-400">Define un plan de internet para tus clientes</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <Card.Header><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalles del Plan</h2></Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input label="Nombre" name="name" value={formData.name} onChange={handleChange} error={formErrors.name} placeholder="Estándar 50MB" required fullWidth />
              </div>
              <Input label="Descarga (Mbps)" name="downloadMbps" type="number" min={1} value={formData.downloadMbps} onChange={handleChange} error={formErrors.downloadMbps} placeholder="50" required fullWidth />
              <Input label="Subida (Mbps)" name="uploadMbps" type="number" min={1} value={formData.uploadMbps} onChange={handleChange} error={formErrors.uploadMbps} placeholder="10" required fullWidth />
              <Input label="Precio mensual (COP)" name="monthlyPrice" type="number" min={0} value={formData.monthlyPrice} onChange={handleChange} error={formErrors.monthlyPrice} placeholder="59990" required fullWidth />
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="isActive" name="isActive" checked={formData.isActive} onChange={handleChange} className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500" />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">Plan activo (disponible para contratar)</label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripción <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Características adicionales del plan..."
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" isLoading={isSubmitting}>Crear Plan</Button>
        </div>
      </form>
    </div>
  );
}
