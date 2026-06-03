'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { DeviceModelResponseDTO, DeviceType, VendorDTO } from '@/types/device.types';
import { Button, Input, Select } from '@/components/ui';

const DEVICE_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar tipo' },
  { value: 'ANTENNA', label: 'Antena' },
  { value: 'OTHER', label: 'Otro' },
  { value: 'RADIO', label: 'Radio' },
  { value: 'ROUTER', label: 'Router' },
  { value: 'ROUTERBOARD', label: 'Routerboard' },
  { value: 'SERVER', label: 'Servidor' },
  { value: 'SWITCH', label: 'Switch' },
];

interface InlineModelFormProps {
  vendorId: string;
  vendor: VendorDTO | undefined;
  onCreated: (model: DeviceModelResponseDTO) => void;
  onCancel: () => void;
}

export function InlineModelForm({ vendorId, vendor, onCreated, onCancel }: InlineModelFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ model: '', deviceType: '' as DeviceType | '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!form.model.trim()) errs.model = 'El nombre del modelo es requerido';
    if (!form.deviceType) errs.deviceType = 'El tipo de dispositivo es requerido';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsLoading(true);
    setApiError(null);

    const result = await apiService.createDeviceModel({
      vendorId,
      model: form.model.trim(),
      deviceType: form.deviceType as DeviceType,
    });

    if (result.success && result.data) {
      const newModel: DeviceModelResponseDTO = {
        ...result.data,
        vendorId,
        vendorName: vendor?.name ?? '',
        vendorSlug: vendor?.slug ?? '',
      };
      queryClient.invalidateQueries({ queryKey: ['deviceModels'] });
      onCreated(newModel);
    } else {
      setApiError(result.error || 'Error al crear el modelo');
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 p-4 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Nuevo modelo para este fabricante</p>

      {apiError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
          <p className="text-sm text-red-800 dark:text-red-400">{apiError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Nombre del modelo"
          name="model"
          value={form.model}
          onChange={handleChange}
          placeholder="RB450G"
          error={errors.model}
          fullWidth
        />
        <Select
          label="Tipo de dispositivo"
          name="deviceType"
          value={form.deviceType}
          onChange={handleChange}
          options={DEVICE_TYPE_OPTIONS}
          error={errors.deviceType}
          fullWidth
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={handleSubmit} isLoading={isLoading}>
          Crear Modelo
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
