'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { fetchAllDeviceModels } from '@/hooks/useCatalogs';
import {
  DeviceResponseDTO,
  ReplaceDeviceDTO,
  ReplaceDeviceResultDTO,
  RetiredDeviceStatus,
} from '@/types/device.types';
import { Modal, Button, Input, Textarea, Select, Combobox } from '@/components/ui';
import {
  MISSING_IDENTIFIER_MESSAGE,
  RETIRED_STATUS_OPTIONS,
  isValidMacAddress,
} from '@/constants/device.constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The unit being replaced. */
  device: DeviceResponseDTO;
  onReplaced: (result: ReplaceDeviceResultDTO) => void;
}

const emptyForm = {
  deviceModelId: '',
  retiredStatus: 'DAMAGED' as RetiredDeviceStatus,
  name: '',
  serialNumber: '',
  macAddress: '',
  description: '',
  installedDate: '',
};

/**
 * Records a physical box being swapped for a different one. This is not the
 * model picker on the details tab: that corrects a mis-registered model on a
 * device that was never polled, whereas this creates a second device record and
 * links the two, so months of readings stay attributed to the hardware that
 * actually produced them.
 *
 * The new unit inherits the retired one's location, category, owner and IP, plus
 * its credentials and the customer's contracted service — so the form only asks
 * for what belongs to the new box itself.
 */
export function ReplaceDeviceModal({ isOpen, onClose, device, onReplaced }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: deviceModels = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['deviceModels'],
    queryFn: fetchAllDeviceModels,
    enabled: isOpen,
  });

  const selectedModel = deviceModels.find((m) => m.id === form.deviceModelId);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Either identifier satisfies the rule, and its message sits on the serial
    // number — so typing a MAC has to clear it too.
    const cleared = name === 'macAddress' ? [name, 'serialNumber'] : [name];
    if (cleared.some((f) => errors[f])) {
      setErrors((prev) => {
        const next = { ...prev };
        for (const f of cleared) delete next[f];
        return next;
      });
    }
  };

  const handleClose = () => {
    setForm(emptyForm);
    setErrors({});
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const found: Record<string, string> = {};
    if (!form.deviceModelId) found.deviceModelId = 'El modelo del equipo nuevo es requerido';
    if (form.name.trim().length > 150) found.name = 'El nombre no puede superar los 150 caracteres';
    if (form.serialNumber.trim().length > 100) {
      found.serialNumber = 'El número de serie no puede superar los 100 caracteres';
    }
    if (form.macAddress.trim() && !isValidMacAddress(form.macAddress)) {
      found.macAddress = 'La dirección MAC no es válida (ej: AA:BB:CC:DD:EE:FF)';
    }
    // It is a different physical box, so it needs its own identifier.
    if (!found.serialNumber && !form.serialNumber.trim() && !form.macAddress.trim()) {
      found.serialNumber = MISSING_IDENTIFIER_MESSAGE;
    }
    if (form.description.trim().length > 500) {
      found.description = 'La descripción no puede superar los 500 caracteres';
    }
    if (form.installedDate && form.installedDate > new Date().toISOString().slice(0, 10)) {
      found.installedDate = 'La fecha de instalación no puede ser futura';
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsSaving(true);
    setError(null);

    const dto: ReplaceDeviceDTO = {
      deviceModelId: form.deviceModelId,
      retiredStatus: form.retiredStatus,
      ...(form.name.trim() ? { name: form.name.trim() } : {}),
      ...(form.serialNumber.trim() ? { serialNumber: form.serialNumber.trim() } : {}),
      ...(form.macAddress.trim() ? { macAddress: form.macAddress.trim() } : {}),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.installedDate
        ? { installedDate: new Date(form.installedDate).toISOString() }
        : {}),
    };

    const result = await apiService.replaceDevice(device.id, dto);
    setIsSaving(false);

    if (result.success && result.data) {
      onReplaced(result.data);
      setForm(emptyForm);
      setErrors({});
      return;
    }

    const message = result.error || 'Error al reemplazar el equipo';
    if (result.errorField) setErrors((prev) => ({ ...prev, [result.errorField!]: message }));
    setError(message);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Reemplazar equipo" size="lg">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Registra que «{device.name}» fue sustituido por una unidad física distinta. El equipo
        nuevo hereda la ubicación, la categoría, el propietario y la dirección IP del anterior,
        junto con sus credenciales y el servicio contratado del cliente. El historial de
        mediciones se queda con la unidad retirada.
      </p>

      {error && (
        <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Combobox
            label="Modelo del equipo nuevo"
            options={deviceModels.map((m) => ({
              value: m.id,
              label: `${m.vendorName} — ${m.model} (${m.deviceType})`,
            }))}
            value={form.deviceModelId}
            onChange={(modelId) => {
              setForm((prev) => ({ ...prev, deviceModelId: modelId }));
              if (errors.deviceModelId) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.deviceModelId;
                  return next;
                });
              }
            }}
            placeholder={modelsLoading ? 'Cargando modelos...' : 'Escribir para buscar modelo...'}
            error={errors.deviceModelId}
            fullWidth
          />
          {/* Losing the radio stops wireless monitoring for the site, and nothing
              re-creates the config — so say it before the swap, not only after. */}
          {selectedModel && !selectedModel.isWireless && (
            <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-500">
              «{selectedModel.model}» no es un modelo inalámbrico. Si esta unidad tiene
              configuración inalámbrica, se eliminará con el reemplazo y el monitoreo
              inalámbrico del sitio se detendrá.
            </p>
          )}
        </div>

        <div>
          <Select
            label="Estado de la unidad retirada"
            name="retiredStatus"
            value={form.retiredStatus}
            onChange={handleChange}
            options={RETIRED_STATUS_OPTIONS}
            fullWidth
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Un reemplazo no siempre es una falla: si la unidad sigue sirviendo, vuelve a
            inventario.
          </p>
        </div>

        <Input
          label="Nombre del equipo nuevo"
          name="name"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
          placeholder={device.name}
          maxLength={150}
          helperText="Si lo dejas vacío, conserva el nombre actual"
          fullWidth
        />

        <Input
          label="Número de Serie"
          name="serialNumber"
          value={form.serialNumber}
          onChange={handleChange}
          error={errors.serialNumber}
          maxLength={100}
          fullWidth
        />

        <Input
          label="Dirección MAC"
          name="macAddress"
          value={form.macAddress}
          onChange={handleChange}
          error={errors.macAddress}
          fullWidth
        />

        <Input
          label="Fecha de Instalación"
          name="installedDate"
          type="date"
          value={form.installedDate}
          onChange={handleChange}
          error={errors.installedDate}
          max={new Date().toISOString().slice(0, 10)}
          helperText="Si la dejas vacía, se registra hoy"
          fullWidth
        />

        <div className="md:col-span-2">
          <Textarea
            label="Descripción"
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={2}
            error={errors.description}
            maxLength={500}
            fullWidth
          />
        </div>
      </div>

      <Modal.Footer>
        <Button variant="outline" onClick={handleClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} isLoading={isSaving}>
          Reemplazar equipo
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
