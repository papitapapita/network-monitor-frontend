'use client';

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  DeviceModelResponseDTO,
  DeviceResponseDTO,
  UpdateDeviceModelDTO,
  VendorDTO,
  DeviceType,
} from '@/types/device.types';
import { Card, Input, Select, Checkbox, Badge, EditFormActions } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { isWirelessCategory } from '@/constants/device.constants';

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
  isEditing: boolean;
  onEditingChange: (isEditing: boolean) => void;
}

export function DeviceModelDetailsTab({ model, onModelUpdated, isEditing, onEditingChange }: Props) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [vendors, setVendors] = useState<VendorDTO[]>([]);

  const makeFormData = (m: DeviceModelResponseDTO) => ({
    vendorId: m.vendorId,
    model: m.model,
    deviceType: m.deviceType as DeviceType | '',
    isWireless: m.isWireless,
  });

  const [formData, setFormData] = useState(makeFormData(model));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { showError, showFormErrors } = useToast();

  useEffect(() => {
    apiService.listVendors({ limit: 100 }).then((r) => {
      if (r.success && r.data) setVendors(r.data.vendors);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  /**
   * Devices on this model that currently hold a wireless config — the ones the
   * backend will refuse the save over, read so the refusal can name them instead
   * of only counting them. Only WIRELESS_CPE and ACCESS_POINT may have a config,
   * and the device's category is frozen while it does, so the category filter
   * cannot miss one while keeping the per-device lookups down to the handful that
   * could. Returns null if the device list could not be read — the caller must
   * not assume "none".
   */
  const findConfiguredDevices = async (): Promise<DeviceResponseDTO[] | null> => {
    const candidates: DeviceResponseDTO[] = [];
    let offset = 0;
    for (;;) {
      const page = await apiService.listDevices({ deviceModelId: model.id, limit: 300, offset });
      if (!page.success || !page.data) return null;
      candidates.push(...page.data.devices.filter((d) => isWirelessCategory(d.category)));
      if (!page.data.hasMore || page.data.devices.length === 0) break;
      offset += page.data.devices.length;
    }
    const configs = await Promise.all(candidates.map((d) => apiService.getWirelessConfig(d.id)));
    // A 404 (no config registered) comes back as a plain failure — same as any
    // other error, so a device we can't read is left off the list. The backend
    // still counts it, and its 409 is what stops the save in that case.
    return candidates.filter((_, i) => configs[i].success && !!configs[i].data);
  };

  const persist = async () => {
    setIsSaving(true);

    const dto: UpdateDeviceModelDTO = {
      vendorId: formData.vendorId,
      model: formData.model.trim(),
      deviceType: formData.deviceType as DeviceType,
      isWireless: formData.isWireless,
    };

    const result = await apiService.updateDeviceModel(model.id, dto);
    if (result.success && result.data) {
      queryClient.invalidateQueries({ queryKey: ['deviceModels'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      onModelUpdated(result.data);
      onEditingChange(false);
    } else if (result.error?.startsWith('Ya existe un modelo de dispositivo')) {
      setFormErrors((prev) => ({ ...prev, model: result.error! }));
    } else {
      // Includes the refusal to drop the wireless flag, already counted and
      // translated by the api service. It only lands here when the pre-flight
      // below saw nothing — a config created between the two calls — so there
      // are no names to list and the server's count stands on its own.
      showError(result.error || 'Error al actualizar el modelo');
    }
    setIsSaving(false);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.model.trim()) errors.model = 'El modelo es requerido';
    else if (formData.model.trim().length > 150) errors.model = 'El modelo no puede superar los 150 caracteres';
    if (!formData.vendorId) errors.vendorId = 'El fabricante es requerido';
    if (!formData.deviceType) errors.deviceType = 'El tipo es requerido';
    setFormErrors(errors);
    if (showFormErrors(errors)) return;

    // The backend refuses to drop the wireless flag while any device on the model
    // still has a wireless config, and never deletes one for us. Ask first, so the
    // operator gets the devices by name instead of a bare count after a failed save.
    if (model.isWireless && !formData.isWireless) {
      setIsSaving(true);
      const configured = await findConfiguredDevices();
      setIsSaving(false);
      if (configured === null) {
        showError('No se pudieron consultar los dispositivos de este modelo. Inténtalo de nuevo.');
        return;
      }
      if (configured.length > 0) {
        const names = configured.map((d) => d.name);
        const shown = names.slice(0, 4);
        const hidden = names.length - shown.length;
        if (hidden > 0) shown.push(`y ${hidden} más`);
        showError('No se puede quitar el modo inalámbrico', {
          details: shown,
        });
        return;
      }
    }

    await persist();
  };

  const cancelEdit = () => {
    onEditingChange(false);
    setFormErrors({});
    setFormData(makeFormData(model));
  };

  return (
    <div className="space-y-6">
      {isEditing ? (
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Editar Modelo</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 gap-4">
              <Select
                label="Fabricante"
                name="vendorId"
                value={formData.vendorId}
                onChange={handleChange}
                options={[
                  { value: '', label: 'Seleccionar fabricante' },
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
                maxLength={150}
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isWireless"
                  name="isWireless"
                  checked={formData.isWireless}
                  onChange={handleChange}
                  label="Modelo inalámbrico"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">(requerido para categorías CPE Inalámbrico y AP)</span>
              </div>
            </div>
          </Card.Body>
          <Card.Footer>
            <EditFormActions onCancel={cancelEdit} onSave={handleSave} isSaving={isSaving} />
          </Card.Footer>
        </Card>
      ) : (
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información del Modelo</h2>
            </Card.Header>
            <Card.Body>
              <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Fabricante</dt>
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
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Inalámbrico</dt>
                  <dd className="mt-1">
                    <Badge variant={model.isWireless ? 'success' : 'neutral'}>
                      {model.isWireless ? 'Sí' : 'No'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Slug del Fabricante</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono text-xs">{model.vendorSlug}</dd>
                </div>
              </dl>
            </Card.Body>
            <Card.Footer>
              <dl className="wrap-anywhere grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">ID de Fabricante</dt>
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
            </Card.Footer>
          </Card>
      )}
    </div>
  );
}
