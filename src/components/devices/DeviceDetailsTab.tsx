'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api.service';
import {
  DeviceResponseDTO,
  UpdateDeviceDTO,
  DeviceStatus,
  DeviceCategory,
  DeviceOwnerType,
  DeviceModelResponseDTO,
} from '@/types/device.types';
import { LocationResponseDTO } from '@/types/location.types';
import {
  Card,
  Button,
  Input,
  Textarea,
  Select,
  Combobox,
  Badge,
  getDeviceStatusBadgeVariant
} from '@/components/ui';
import { LocationCreateModal } from '@/components/LocationCreateModal';
import { DEVICE_CATEGORY_OPTIONS, DEVICE_STATUS_OPTIONS, DEVICE_STATUS_LABELS as STATUS_LABELS, MISSING_IDENTIFIER_MESSAGE, deviceCategoryLabel, isWirelessCategory, isValidIpAddress, isValidMacAddress, requiresIdentifier, canEnableMonitoring } from '@/constants/device.constants';

interface Props {
  device: DeviceResponseDTO;
  onDeviceUpdated: (updated: DeviceResponseDTO) => void;
}

export function DeviceDetailsTab({ device, onDeviceUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [deviceModel, setDeviceModel] = useState<DeviceModelResponseDTO | null>(null);
  const [deviceModels, setDeviceModels] = useState<DeviceModelResponseDTO[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const makeFormData = (d: DeviceResponseDTO) => ({
    name: d.name,
    deviceModelId: d.deviceModelId,
    status: d.status as DeviceStatus | '',
    category: (d.category ?? '') as DeviceCategory | '',
    ownerType: d.ownerType as DeviceOwnerType | '',
    ipAddress: d.ipAddress ?? '',
    macAddress: d.macAddress ?? '',
    serialNumber: d.serialNumber ?? '',
    locationId: d.locationId ?? '',
    installedDate: d.installedDate ? d.installedDate.slice(0, 10) : '',
    description: d.description ?? '',
    monitoringEnabled: d.monitoringEnabled
  });

  const [formData, setFormData] = useState(makeFormData(device));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // The model may only be corrected while the device has never been polled —
  // any other status and the backend rejects a deviceModelId change with 400.
  const canEditModel = device.status === 'INVENTORY';

  // Falls back to the device's own model: the list is capped at 100 entries, so
  // the current one is not guaranteed to be in it.
  const selectedModel =
    deviceModels.find((m) => m.id === formData.deviceModelId) ??
    (formData.deviceModelId === device.deviceModelId ? deviceModel : null);

  const wirelessMismatch = isWirelessCategory(formData.category) && !!selectedModel && !selectedModel.isWireless;

  useEffect(() => {
    apiService.listLocations({ limit: 100 }).then((r) => {
      if (r.success && r.data) setLocations(r.data.locations);
    });
    apiService.listDeviceModels({ limit: 100 }).then((r) => {
      if (r.success && r.data) setDeviceModels(r.data.deviceModels);
    });
  }, []);

  useEffect(() => {
    apiService.getDeviceModel(device.deviceModelId).then((r) => {
      if (r.success && r.data) setDeviceModel(r.data);
    });
  }, [device.deviceModelId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      // Polling needs a target address: clearing the IP turns monitoring off.
      ...(name === 'ipAddress' && !value.trim() ? { monitoringEnabled: false } : {}),
    }));
    // Either identifier satisfies the inventory rule, and the message for it
    // sits on the serial number — so typing a MAC has to clear it too.
    const cleared = name === 'macAddress' ? [name, 'serialNumber'] : [name];
    if (cleared.some((f) => formErrors[f])) {
      setFormErrors((prev) => { const n = { ...prev }; for (const f of cleared) delete n[f]; return n; });
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as DeviceStatus | '';
    setFormData((prev) => ({
      ...prev,
      status: value,
      monitoringEnabled:
        value === 'INVENTORY' || value === 'DAMAGED' ? false
        : !prev.ipAddress.trim() ? false
        : value === 'COMMISSIONING' ? true
        : prev.monitoringEnabled,
    }));
    if (formErrors.status) setFormErrors((prev) => { const n = { ...prev }; delete n.status; return n; });
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';
    else if (formData.name.trim().length > 150) errors.name = 'El nombre no puede superar los 150 caracteres';

    if (canEditModel && !formData.deviceModelId) {
      errors.deviceModelId = 'El modelo es requerido';
    }
    if (wirelessMismatch) {
      const message = `Esta categoría requiere un modelo inalámbrico, pero «${selectedModel?.model}» no lo es`;
      if (canEditModel) errors.deviceModelId = message;
      else errors.category = message;
    }
    if (formData.description.trim().length > 500) {
      errors.description = 'La descripción no puede superar los 500 caracteres';
    }

    const status = (formData.status || 'INVENTORY') as DeviceStatus;
    const hasIp = !!formData.ipAddress.trim();
    if (hasIp && !isValidIpAddress(formData.ipAddress)) {
      errors.ipAddress = 'La dirección IP no es válida';
    } else if ((status === 'ACTIVE' || status === 'COMMISSIONING') && !hasIp) {
      errors.ipAddress = 'La dirección IP es requerida';
    } else if (formData.monitoringEnabled && !hasIp) {
      errors.ipAddress = 'La dirección IP es requerida para habilitar el monitoreo';
    }
    if (status === 'ACTIVE' && !formData.locationId) {
      errors.locationId = 'La ubicación es requerida para dispositivos activos';
    }
    if (formData.installedDate && formData.installedDate > new Date().toISOString().slice(0, 10)) {
      errors.installedDate = 'La fecha de instalación no puede ser futura';
    }
    if (formData.macAddress.trim() && !isValidMacAddress(formData.macAddress)) {
      errors.macAddress = 'La dirección MAC no es válida (ej: AA:BB:CC:DD:EE:FF)';
    }
    if (formData.serialNumber.trim().length > 100) {
      errors.serialNumber = 'El número de serie no puede superar los 100 caracteres';
    }
    if (!errors.serialNumber && requiresIdentifier(status)) {
      if (!formData.serialNumber.trim() && !formData.macAddress.trim()) {
        errors.serialNumber = MISSING_IDENTIFIER_MESSAGE;
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setError(null);

    const dto: UpdateDeviceDTO = {
      name: formData.name.trim(),
      // Only an INVENTORY device may have its model corrected; the backend
      // applies the correction before any status change in the same request.
      ...(canEditModel && formData.deviceModelId !== device.deviceModelId
        ? { deviceModelId: formData.deviceModelId }
        : {}),
      status: formData.status as DeviceStatus || undefined,
      category: (formData.category as DeviceCategory) || null,
      ownerType: formData.ownerType as DeviceOwnerType || undefined,
      ipAddress: formData.ipAddress.trim() || null,
      macAddress: formData.macAddress.trim() || null,
      serialNumber: formData.serialNumber.trim() || null,
      locationId: formData.locationId || null,
      installedDate: formData.installedDate ? new Date(formData.installedDate).toISOString() : null,
      description: formData.description.trim() || null,
      monitoringEnabled: formData.monitoringEnabled
    };

    // Backend validates current locationId before applying the update, so activating a device
    // that has no location while simultaneously assigning one requires two sequential requests.
    const needsTwoSteps =
      !device.locationId &&
      !!dto.locationId &&
      dto.status === 'ACTIVE';

    let result;
    if (needsTwoSteps) {
      const locationResult = await apiService.updateDevice(device.id, { locationId: dto.locationId });
      if (!locationResult.success) {
        setError(locationResult.error || 'Error al actualizar el dispositivo');
        setIsSaving(false);
        return;
      }
      result = await apiService.updateDevice(device.id, dto);
    } else {
      result = await apiService.updateDevice(device.id, dto);
    }

    if (result.success && result.data) {
      if (formData.monitoringEnabled !== device.monitoringEnabled) {
        await apiService.createPollingConfig(device.id, {
          enabled: formData.monitoringEnabled,
          ...(formData.monitoringEnabled ? { ipAddress: dto.ipAddress } : {})
        });
      }
      onDeviceUpdated(result.data);
      setIsEditing(false);
    } else {
      const message = result.error || 'Error al actualizar el dispositivo';
      // A rejected MAC or IP belongs on its own input, not only in the banner above.
      if (result.errorField) {
        setFormErrors((prev) => ({ ...prev, [result.errorField!]: message }));
      }
      setError(message);
    }
    setIsSaving(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setFormErrors({});
    setFormData(makeFormData(device));
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Editar Dispositivo</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={formErrors.name}
                maxLength={150}
                required
                fullWidth
              />
              {canEditModel ? (
                <div>
                <Combobox
                  label="Modelo"
                  options={(() => {
                    const opts = deviceModels.map((m) => ({
                      value: m.id,
                      label: `${m.vendorName} — ${m.model} (${m.deviceType})`,
                    }));
                    // Keep the current model selectable even if it fell outside the first 100.
                    return opts.some((o) => o.value === device.deviceModelId) || !deviceModel
                      ? opts
                      : [
                          {
                            value: deviceModel.id,
                            label: `${deviceModel.vendorName} — ${deviceModel.model} (${deviceModel.deviceType})`,
                          },
                          ...opts,
                        ];
                  })()}
                  value={formData.deviceModelId}
                  onChange={(modelId) => {
                    setFormData((prev) => ({ ...prev, deviceModelId: modelId }));
                    if (formErrors.deviceModelId) {
                      setFormErrors((prev) => { const n = { ...prev }; delete n.deviceModelId; return n; });
                    }
                  }}
                  placeholder="Escribir para buscar modelo..."
                  error={formErrors.deviceModelId}
                  fullWidth
                />
                {!formErrors.deviceModelId && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Solo para corregir un modelo mal registrado, no para sustituir el equipo.
                  </p>
                )}
                </div>
              ) : (
                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modelo</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100 py-2">
                    {deviceModel ? `${deviceModel.vendorName} ${deviceModel.model}` : device.deviceModelId}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    El modelo solo puede corregirse mientras el dispositivo está en inventario.
                  </p>
                </div>
              )}
              <Select
                label="Tipo de Propietario"
                name="ownerType"
                value={formData.ownerType}
                onChange={handleChange}
                options={[
                  { value: 'COMPANY', label: 'Empresa' },
                  { value: 'CLIENT', label: 'Cliente' }
                ]}
                fullWidth
              />
              <Select
                label="Estado"
                name="status"
                value={formData.status}
                onChange={handleStatusChange}
                options={DEVICE_STATUS_OPTIONS}
                fullWidth
              />
              <Select
                label="Categoría"
                name="category"
                value={formData.category}
                onChange={handleChange}
                options={DEVICE_CATEGORY_OPTIONS}
                error={formErrors.category}
                fullWidth
              />
              <Input label="Dirección IP" name="ipAddress" value={formData.ipAddress} onChange={handleChange} error={formErrors.ipAddress} fullWidth />
              <Input label="Dirección MAC" name="macAddress" value={formData.macAddress} onChange={handleChange} error={formErrors.macAddress} fullWidth />
              <Input label="Número de Serie" name="serialNumber" value={formData.serialNumber} onChange={handleChange} error={formErrors.serialNumber} maxLength={100} fullWidth />
              <Combobox
                label="Ubicación"
                options={[
                  { value: '', label: 'Sin ubicación' },
                  ...locations.map((l) => ({ value: l.id, label: l.name }))
                ]}
                value={formData.locationId}
                onChange={(locId) => {
                  setFormData((prev) => ({ ...prev, locationId: locId }));
                  if (formErrors.locationId) setFormErrors((prev) => { const n = { ...prev }; delete n.locationId; return n; });
                }}
                placeholder="Escribir para buscar ubicación..."
                createLabel="+ Crear nueva ubicación"
                onCreateNew={() => setShowLocationModal(true)}
                error={formErrors.locationId}
                fullWidth
              />
              <Input
                label="Fecha de Instalación"
                name="installedDate"
                type="date"
                value={formData.installedDate}
                onChange={handleChange}
                error={formErrors.installedDate}
                max={new Date().toISOString().slice(0, 10)}
                fullWidth
              />
              {(() => {
                const st = (formData.status || 'INVENTORY') as DeviceStatus;
                const noIp = !formData.ipAddress.trim();
                const suggestOn = st === 'COMMISSIONING';
                const autoOff = !canEnableMonitoring(st, formData.ipAddress);
                return (
                  <div className="flex items-center gap-2 pt-6 flex-wrap">
                    <input
                      type="checkbox"
                      id="edit-monitoring"
                      name="monitoringEnabled"
                      checked={autoOff ? false : formData.monitoringEnabled}
                      onChange={autoOff ? undefined : handleChange}
                      disabled={autoOff}
                      className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                    <label htmlFor="edit-monitoring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Habilitar monitoreo
                    </label>
                    {suggestOn && !noIp && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">(recomendado en comisionamiento, opcional)</span>
                    )}
                    {noIp ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">(requiere una dirección IP)</span>
                    ) : autoOff && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">(se desactiva automáticamente)</span>
                    )}
                  </div>
                );
              })()}
              <div className="md:col-span-2">
                <Textarea
                  label="Descripción"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  error={formErrors.description}
                  maxLength={500}
                  fullWidth
                />
              </div>
            </div>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información del Dispositivo</h2>
            </Card.Header>
            <Card.Body>
              <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Nombre', value: device.name },
                  {
                    label: 'Estado',
                    value: (
                      <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
                        {STATUS_LABELS[device.status] ?? device.status}
                      </Badge>
                    )
                  },
                  { label: 'Categoría', value: deviceCategoryLabel(device.category) },
                  { label: 'Tipo de Propietario', value: device.ownerType === 'COMPANY' ? 'Empresa' : 'Cliente' },
                  { label: 'Dirección IP', value: device.ipAddress || '—', mono: true },
                  { label: 'Dirección MAC', value: device.macAddress || '—', mono: true },
                  { label: 'Número de Serie', value: device.serialNumber || '—' },
                  {
                    label: 'Monitoreo',
                    value: (
                      <Badge variant={device.monitoringEnabled ? 'success' : 'neutral'}>
                        {device.monitoringEnabled ? 'Habilitado' : 'Deshabilitado'}
                      </Badge>
                    )
                  },
                  {
                    label: 'Fecha de Instalación',
                    value: device.installedDate ? new Date(device.installedDate).toLocaleDateString('es') : '—'
                  },
                  {
                    label: 'Ubicación',
                    value: device.locationId
                      ? (() => {
                          const loc = locations.find((l) => l.id === device.locationId);
                          return (
                            <Link
                              href={`/locations/${device.locationId}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {loc ? loc.name : device.locationId}
                            </Link>
                          );
                        })()
                      : '—',
                  },
                  {
                    label: 'Modelo',
                    value: (
                      <Link
                        href={`/device-models/${device.deviceModelId}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {deviceModel ? `${deviceModel.vendorName} ${deviceModel.model}` : device.deviceModelId}
                      </Link>
                    ),
                  },
                ].map(({ label, value, mono }) => (
                  <div key={label}>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className={`mt-1 text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : ''}`}>
                      {value}
                    </dd>
                  </div>
                ))}
                <div className="md:col-span-2">
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Descripción</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{device.description || '—'}</dd>
                </div>
              </dl>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Metadatos</h2>
            </Card.Header>
            <Card.Body>
              <dl className="wrap-anywhere grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Creado</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{new Date(device.createdAt).toLocaleString('es')}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Última Actualización</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{new Date(device.updatedAt).toLocaleString('es')}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">ID</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono text-xs">{device.id}</dd>
                </div>
              </dl>
            </Card.Body>
          </Card>
        </>
      )}

      <LocationCreateModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onCreated={(loc) => {
          setLocations((prev) => [...prev, loc]);
          setFormData((prev) => ({ ...prev, locationId: loc.id }));
          setShowLocationModal(false);
        }}
      />
    </div>
  );
}
