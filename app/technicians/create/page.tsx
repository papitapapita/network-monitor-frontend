'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CreateTechnicianDTO } from '@/types/technician.types';
import { Card, Button, Input } from '@/components/ui';

export default function CreateTechnicianPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({ fullName: '', phone: '', email: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (formErrors[name])
      setFormErrors((p) => {
        const n = { ...p };
        delete n[name];
        return n;
      });
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'El nombre es requerido';
    else if (formData.fullName.trim().length > 150)
      errors.fullName = 'El nombre no puede superar los 150 caracteres';

    // The backend normalizes to '+' plus digits and wants 7–15 of them, so count
    // the digits rather than the punctuation the operator typed.
    const digits = formData.phone.replace(/\D/g, '');
    if (!formData.phone.trim()) errors.phone = 'El teléfono es requerido';
    else if (digits.length < 7 || digits.length > 15)
      errors.phone = 'El teléfono debe tener entre 7 y 15 dígitos';

    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
      errors.email = 'El email no tiene un formato válido';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);

    const dto: CreateTechnicianDTO = {
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || null,
    };

    const result = await apiService.createTechnician(dto);
    if (result.success && result.data) {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      router.replace(`/technicians/${result.data.id}`);
    } else {
      const message = result.error || 'Error al crear el técnico';
      if (result.errorField) setFormErrors((prev) => ({ ...prev, [result.errorField!]: message }));
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          ← Atrás
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agregar Técnico</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Registra un trabajador de campo al que despachar tickets
          </p>
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Datos del Técnico
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Nombre Completo"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  error={formErrors.fullName}
                  maxLength={150}
                  required
                  fullWidth
                />
              </div>
              <Input
                label="Teléfono"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={formErrors.phone}
                placeholder="+57 300 111 2233"
                helperText="Identifica al técnico y no puede repetirse. Se guarda normalizado."
                required
                fullWidth
              />
              <Input
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={formErrors.email}
                placeholder="opcional"
                fullWidth
              />
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Un técnico no necesita cuenta de acceso: se le despacha trabajo sin que inicie sesión.
              Los nuevos técnicos quedan activos y disponibles para asignar de inmediato.
            </p>
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Crear Técnico
          </Button>
        </div>
      </form>
    </div>
  );
}
