'use client';

import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import {
  DeviceModelResponseDTO,
  UpdateDeviceModelDTO,
  VendorDTO,
  DeviceType,
} from '@/types/device.types';
import { Card, Button, Input, Select, Badge } from '@/components/ui';

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  ANTENNA: 'Antena',
  OTHER: 'Otro',
  RADIO: 'Radio',
  ROUTER: 'Router',
  ROUTERBOARD: 'RouterBoard',
  SERVER: 'Servidor',
  SWITCH: 'Switch',
};

interface Props {
  model: DeviceModelResponseDTO;
  onModelUpdated: (updated: DeviceModelResponseDTO) => void;
}

export function DeviceModelDetailsTab({ model, onModelUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<VendorDTO[]>([]);

  const makeFormData = (m: DeviceModelResponseDTO) => ({
    vendorId: m.vendorId,
    model: m.model,
    deviceType: m.deviceType as DeviceType | '',
  });

  const [formData, setFormData] = useState(makeFormData(model));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    apiService.listVendors({ limit: 100 }).then((r) => {
      if (r.success && r.data) setVendors(r.data.vendors);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.model.trim()) errors.model = 'El modelo es requerido';
    if (!formData.vendorId) errors.vendorId = 'El proveedor es requerido';
    if (!formData.deviceType) errors.deviceType = 'El tipo es requerido';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setError(null);

    const dto: UpdateDeviceModelDTO = {
      vendorId: formData.vendorId,
      model: formData.model.trim(),
      deviceType: formData.deviceType as DeviceType,
    };

    const result = await apiService.updateDeviceModel(model.id, dto);
    if (result.success && result.data) {
      onModelUpdated(result.data);
      setIsEditing(false);
    } else {
      setError(result.error || 'Error al actualizar el modelo');
    }
    setIsSaving(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setFormErrors({});
    setFormData(makeFormData(model));
  };

  return (
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

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {isEditing ? (
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Editar Modelo</h2>
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
      ) : (
        <>
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información del Modelo</h2>
            </Card.Header>
            <Card.Body>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Proveedor</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{model.vendorName}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Modelo</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{model.model}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Tipo de Dispositivo</dt>
                  <dd className="mt-1">
                    <Badge variant="info">
                      {DEVICE_TYPE_LABELS[model.deviceType] ?? model.deviceType}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Slug del Proveedor</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono text-xs">{model.vendorSlug}</dd>
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
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono text-xs">{model.id}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">ID de Proveedor</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono text-xs">{model.vendorId}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Creado</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{new Date(model.createdAt).toLocaleString('es')}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Última Actualización</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{new Date(model.updatedAt).toLocaleString('es')}</dd>
                </div>
              </dl>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}
