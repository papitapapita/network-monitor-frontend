'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { CreateDeviceModelDTO, VendorDTO, DeviceType } from '@/types/device.types';
import { Card, Button, Input, Select, LoadingSpinner } from '@/components/ui';

export default function CreateDeviceModelPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [vendors, setVendors] = useState<VendorDTO[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);

  const [formData, setFormData] = useState({
    vendorId: '',
    model: '',
    deviceType: '' as DeviceType | '',
  });

  useEffect(() => {
    apiService.listVendors({ limit: 100 }).then((r) => {
      if (r.success && r.data) setVendors(r.data.vendors);
      setLoadingVendors(false);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.vendorId) errors.vendorId = 'El proveedor es requerido';
    if (!formData.model.trim()) errors.model = 'El modelo es requerido';
    if (!formData.deviceType) errors.deviceType = 'El tipo de dispositivo es requerido';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);

    const dto: CreateDeviceModelDTO = {
      vendorId: formData.vendorId,
      model: formData.model.trim(),
      deviceType: formData.deviceType as DeviceType,
    };

    const result = await apiService.createDeviceModel(dto);
    if (result.success && result.data) {
      router.push(`/device-models/${result.data.id}`);
    } else {
      setError(result.error || 'Error al crear el modelo');
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agregar Modelo</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Registra un nuevo modelo de dispositivo</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {loadingVendors ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner message="Cargando proveedores..." />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información del Modelo</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 gap-4">
                <Select
                  label="Proveedor"
                  name="vendorId"
                  value={formData.vendorId}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Seleccionar proveedor' },
                    ...vendors.map((v) => ({ value: v.id, label: v.name })),
                  ]}
                  error={formErrors.vendorId}
                  required
                  fullWidth
                />
                <Input
                  label="Modelo"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  placeholder="RB750Gr3"
                  error={formErrors.model}
                  required
                  fullWidth
                />
                <Select
                  label="Tipo de Dispositivo"
                  name="deviceType"
                  value={formData.deviceType}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Seleccionar tipo' },
                    { value: 'ANTENNA', label: 'Antena' },
                    { value: 'OTHER', label: 'Otro' },
                    { value: 'RADIO', label: 'Radio' },
                    { value: 'ROUTER', label: 'Router' },
                    { value: 'ROUTERBOARD', label: 'RouterBoard' },
                    { value: 'SERVER', label: 'Servidor' },
                    { value: 'SWITCH', label: 'Switch' },
                  ]}
                  error={formErrors.deviceType}
                  required
                  fullWidth
                />
              </div>
            </Card.Body>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Crear Modelo
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
