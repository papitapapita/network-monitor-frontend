'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CreateCustomerDTO } from '@/types/customer.types';
import { Card, Button, Input } from '@/components/ui';

export default function CreateCustomerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({ fullName: '', phone: '', email: '', cedula: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) setFormErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'El nombre completo es requerido';
    if (!formData.phone.trim()) errors.phone = 'El teléfono es requerido';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);

    const dto: CreateCustomerDTO = {
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || null,
      cedula: formData.cedula.trim() || null,
    };

    const result = await apiService.createCustomer(dto);
    if (result.success && result.data) {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.replace(`/customers/${result.data.id}`);
    } else {
      setError(result.error || 'Error al crear el cliente');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>← Atrás</Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agregar Cliente</h1>
          <p className="text-gray-600 dark:text-gray-400">Registra un nuevo cliente del servicio</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información del Cliente</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input label="Nombre Completo" name="fullName" value={formData.fullName} onChange={handleChange} error={formErrors.fullName} required fullWidth />
              </div>
              <Input label="Teléfono" name="phone" value={formData.phone} onChange={handleChange} error={formErrors.phone} placeholder="3001234567" required fullWidth />
              <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="opcional" fullWidth />
              <Input label="Cédula" name="cedula" value={formData.cedula} onChange={handleChange} placeholder="opcional" fullWidth />
            </div>
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" isLoading={isSubmitting}>Crear Cliente</Button>
        </div>
      </form>
    </div>
  );
}
