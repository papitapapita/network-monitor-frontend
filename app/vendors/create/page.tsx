'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { CreateVendorDTO } from '@/types/device.types';
import { Card, Button, Input, LoadingSpinner } from '@/components/ui';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CreateVendorPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'name') {
      setFormData((prev) => ({
        ...prev,
        name: value,
        slug: slugManuallyEdited ? prev.slug : toSlug(value),
      }));
    } else if (name === 'slug') {
      setSlugManuallyEdited(true);
      setFormData((prev) => ({ ...prev, slug: value }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';
    if (!formData.slug.trim()) errors.slug = 'El slug es requerido';
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      errors.slug = 'Solo minúsculas, números y guiones (ej: tp-link)';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);

    const dto: CreateVendorDTO = {
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      description: formData.description.trim() || null,
    };

    const result = await apiService.createVendor(dto);
    if (result.success && result.data) {
      router.push(`/vendors/${result.data.id}`);
    } else {
      setError(result.error || 'Error al crear el proveedor');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Atrás
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agregar Proveedor</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Registra un nuevo fabricante de dispositivos</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información del Proveedor</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 gap-4">
              <Input
                label="Nombre"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="MikroTik"
                error={formErrors.name}
                required
                fullWidth
              />
              <Input
                label="Slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="mikrotik"
                error={formErrors.slug}
                helperText="Identificador único en minúsculas con guiones"
                required
                fullWidth
              />
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Descripción <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Fabricante de equipos de red..."
                  rows={3}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Crear Proveedor
          </Button>
        </div>
      </form>
    </div>
  );
}
