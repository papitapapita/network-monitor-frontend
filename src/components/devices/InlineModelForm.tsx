'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { DeviceModelResponseDTO, DeviceType, VendorDTO } from '@/types/device.types';
import { Button, Input, Select, Switch, submitOnEnterCancelOnEscape } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';

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
  vendors: VendorDTO[];
  /** Skips the vendor picker and uses this vendor, for flows where it's already chosen upstream (e.g. network scan). */
  lockedVendorId?: string;
  /** Prefills the model name from whatever the user already typed into the model combobox. */
  initialModelName?: string;
  /** Pre-check the wireless toggle when creating a model for a wireless category. */
  defaultIsWireless?: boolean;
  onCreated: (model: DeviceModelResponseDTO) => void;
  onCancel: () => void;
}

export function InlineModelForm({ vendors, lockedVendorId, initialModelName = '', defaultIsWireless = false, onCreated, onCancel }: InlineModelFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ vendorId: lockedVendorId ?? '', model: initialModelName, deviceType: '' as DeviceType | '', isWireless: defaultIsWireless });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { showError, showFormErrors } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!form.vendorId) errs.vendorId = 'El fabricante es requerido';
    if (!form.model.trim()) errs.model = 'El nombre del modelo es requerido';
    else if (form.model.trim().length > 150) errs.model = 'El modelo no puede superar los 150 caracteres';
    if (!form.deviceType) errs.deviceType = 'El tipo de dispositivo es requerido';
    setErrors(errs);
    if (showFormErrors(errs)) return;

    setIsLoading(true);

    const result = await apiService.createDeviceModel({
      vendorId: form.vendorId,
      model: form.model.trim(),
      deviceType: form.deviceType as DeviceType,
      isWireless: form.isWireless,
    });

    if (result.success && result.data) {
      const vendor = vendors.find((v) => v.id === form.vendorId);
      const newModel: DeviceModelResponseDTO = {
        ...result.data,
        vendorId: form.vendorId,
        vendorName: vendor?.name ?? '',
        vendorSlug: vendor?.slug ?? '',
      };
      queryClient.invalidateQueries({ queryKey: ['deviceModels'] });
      onCreated(newModel);
    } else if (result.error?.startsWith('Ya existe un modelo de dispositivo')) {
      setErrors((prev) => ({ ...prev, model: result.error! }));
      showError(result.error!);
      setIsLoading(false);
    } else {
      showError(result.error || 'Error al crear el modelo');
      setIsLoading(false);
    }
  };

  return (
    <div
      className="mt-3 p-4 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3"
      // Rendered inside the device form, so a bare Enter would submit that one — save this model instead, and Escape cancels it.
      onKeyDown={submitOnEnterCancelOnEscape(handleSubmit, onCancel, isLoading)}
    >
      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Nuevo modelo</p>

      <div className={`grid grid-cols-1 gap-3 ${lockedVendorId ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {!lockedVendorId && (
          <Select
            label="Fabricante"
            name="vendorId"
            value={form.vendorId}
            onChange={handleChange}
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            placeholder="Seleccionar fabricante"
            error={errors.vendorId}
            fullWidth
          />
        )}
        <Input
          label="Nombre del modelo"
          name="model"
          value={form.model}
          onChange={handleChange}
          placeholder="RB450G"
          error={errors.model}
          maxLength={150}
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
        <Switch
          id="inline-model-isWireless"
          name="isWireless"
          checked={form.isWireless}
          onChange={handleChange}
          label="Modelo inalámbrico"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">(requerido para categorías CPE Inalámbrico y AP)</span>
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
