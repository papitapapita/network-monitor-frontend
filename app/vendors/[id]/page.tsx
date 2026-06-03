'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { VendorDTO, UpdateVendorDTO } from '@/types/device.types';
import { Card, Button, Input, LoadingSpinner } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function VendorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<VendorDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const makeForm = (v: VendorDTO) => ({
    name: v.name,
    slug: v.slug,
    description: v.description ?? '',
  });

  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });

  const fetchVendor = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.getVendor(vendorId);
    if (result.success && result.data) {
      setVendor(result.data);
      setFormData(makeForm(result.data));
    } else {
      setError(result.error || 'Error al cargar el proveedor');
    }
    setIsLoading(false);
  }, [vendorId]);

  useEffect(() => {
    fetchVendor();
  }, [fetchVendor]);

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

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';
    if (!formData.slug.trim()) errors.slug = 'El slug es requerido';
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug)) {
      errors.slug = 'Solo minúsculas, números y guiones (ej: tp-link)';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setError(null);

    const dto: UpdateVendorDTO = {
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      description: formData.description.trim() || null,
    };

    const result = await apiService.updateVendor(vendorId, dto);
    if (result.success && result.data) {
      setVendor(result.data);
      setFormData(makeForm(result.data));
      setIsEditing(false);
      setSlugManuallyEdited(false);
    } else {
      setError(result.error || 'Error al actualizar el proveedor');
    }
    setIsSaving(false);
  };

  const cancelEdit = () => {
    if (vendor) setFormData(makeForm(vendor));
    setFormErrors({});
    setSlugManuallyEdited(false);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await apiService.deleteVendor(vendorId);
    setIsDeleting(false);
    if (result.success) {
      router.push('/vendors');
    } else {
      setShowDeleteModal(false);
      setError(result.error || 'Error al eliminar el proveedor');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Cargando proveedor..." />
      </div>
    );
  }

  if (error && !vendor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{error}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>Volver</Button>
            <Button onClick={fetchVendor}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!vendor) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar proveedor"
        message={`¿Estás seguro de que deseas eliminar "${vendor.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>← Atrás</Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">{vendor.name}</h1>
            <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{vendor.slug}</p>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
          Eliminar
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex justify-end">
          {!isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)}>Editar</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>Cancelar</Button>
              <Button onClick={handleSave} isLoading={isSaving}>Guardar Cambios</Button>
            </div>
          )}
        </div>

        {isEditing ? (
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Editar Proveedor</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Nombre"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={formErrors.name}
                  required
                  fullWidth
                />
                <Input
                  label="Slug"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
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
                    rows={3}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <>
            <Card>
              <Card.Header>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información del Proveedor</h2>
              </Card.Header>
              <Card.Body>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Nombre</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{vendor.name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Slug</dt>
                    <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100">{vendor.slug}</dd>
                  </div>
                  <div className="md:col-span-2">
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Descripción</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">
                      {vendor.description ?? <span className="italic text-gray-400 dark:text-gray-600">Sin descripción</span>}
                    </dd>
                  </div>
                </dl>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Metadatos</h2>
              </Card.Header>
              <Card.Body>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">ID</dt>
                    <dd className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100">{vendor.id}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Creado</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{new Date(vendor.createdAt).toLocaleString('es')}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">Última Actualización</dt>
                    <dd className="mt-1 text-gray-900 dark:text-gray-100">{new Date(vendor.updatedAt).toLocaleString('es')}</dd>
                  </div>
                </dl>
              </Card.Body>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
