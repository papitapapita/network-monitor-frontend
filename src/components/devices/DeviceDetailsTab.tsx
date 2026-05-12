'use client';

import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import {
  DeviceResponseDTO,
  UpdateDeviceDTO,
  DeviceStatus,
  DeviceCategory,
  DeviceOwnerType,
} from '@/types/device.types';
import { LocationResponseDTO } from '@/types/location.types';
import {
  Card,
  Button,
  Input,
  Select,
  Badge,
  getDeviceStatusBadgeVariant
} from '@/components/ui';
import { LocationCreateModal } from '@/components/LocationCreateModal';

const STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: 'Activo',
  INVENTORY: 'Inventario',
  DAMAGED: 'Dañado',
};

interface Props {
  device: DeviceResponseDTO;
  onDeviceUpdated: (updated: DeviceResponseDTO) => void;
}

export function DeviceDetailsTab({ device, onDeviceUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const makeFormData = (d: DeviceResponseDTO) => ({
    name: d.name,
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

  useEffect(() => {
    apiService.listLocations({ limit: 100 }).then((r) => {
      if (r.success && r.data) setLocations(r.data.locations);
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

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';

    const status = (formData.status || 'INVENTORY') as DeviceStatus;
    const hasCategory = !!formData.category;
    const hasIp = !!formData.ipAddress.trim();
    if ((hasCategory || status === 'ACTIVE') && !hasIp) {
      errors.ipAddress = 'La dirección IP es requerida';
    }
    if (!hasIp && (status === 'INVENTORY' || status === 'DAMAGED')) {
      if (!formData.serialNumber.trim() && !formData.macAddress.trim()) {
        errors.serialNumber = 'Se requiere número de serie o dirección MAC';
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setError(null);

    const dto: UpdateDeviceDTO = {
      name: formData.name.trim(),
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

    const result = await apiService.updateDevice(device.id, dto);
    if (result.success && result.data) {
      if (formData.monitoringEnabled !== device.monitoringEnabled) {
        await apiService.createPollingConfig(device.id, {
          enabled: formData.monitoringEnabled
        });
      }
      onDeviceUpdated(result.data);
      setIsEditing(false);
    } else {
      setError(result.error || 'Error al actualizar el dispositivo');
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
                required
                fullWidth
              />
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
                onChange={handleChange}
                options={[
                  { value: 'INVENTORY', label: 'Inventario' },
                  { value: 'ACTIVE', label: 'Activo' },
                  { value: 'DAMAGED', label: 'Dañado' },
                ]}
                fullWidth
              />
              <Select
                label="Categoría"
                name="category"
                value={formData.category}
                onChange={handleChange}
                options={[
                  { value: '', label: 'Ninguna' },
                  { value: 'CPE', label: 'CPE (Cliente)' },
                  { value: 'AP', label: 'Punto de Acceso (AP)' },
                  { value: 'ROUTERBOARD', label: 'Routerboard' },
                  { value: 'SMART_SWITCH', label: 'Switch Gestionable' },
                  { value: 'SMART_SWITCH_POE', label: 'Switch Gestionable PoE' },
                  { value: 'OTHER', label: 'Otro' },
                ]}
                fullWidth
              />
              <Input label="Dirección IP" name="ipAddress" value={formData.ipAddress} onChange={handleChange} error={formErrors.ipAddress} fullWidth />
              <Input label="Dirección MAC" name="macAddress" value={formData.macAddress} onChange={handleChange} fullWidth />
              <Input label="Número de Serie" name="serialNumber" value={formData.serialNumber} onChange={handleChange} error={formErrors.serialNumber} fullWidth />
              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ubicación</label>
                <div className="flex items-center gap-2">
                  <Select
                    name="locationId"
                    value={formData.locationId}
                    onChange={handleChange}
                    options={[
                      { value: '', label: 'Sin ubicación' },
                      ...locations.map((l) => ({ value: l.id, label: l.name }))
                    ]}
                    fullWidth
                  />
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className="flex-shrink-0 w-9 h-9 rounded-md border border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center text-xl font-medium"
                    title="Crear nueva ubicación"
                  >
                    +
                  </button>
                </div>
              </div>
              <Input
                label="Fecha de Instalación"
                name="installedDate"
                type="date"
                value={formData.installedDate}
                onChange={handleChange}
                fullWidth
              />
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="edit-monitoring"
                  name="monitoringEnabled"
                  checked={formData.monitoringEnabled}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500"
                />
                <label htmlFor="edit-monitoring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Habilitar monitoreo
                </label>
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Descripción"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
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
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
                  { label: 'Categoría', value: device.category ? device.category.replace(/_/g, ' ') : '—' },
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
                  { label: 'ID de Ubicación', value: device.locationId || '—', mono: true, xs: true },
                  { label: 'ID de Modelo', value: device.deviceModelId, mono: true, xs: true },
                ].map(({ label, value, mono, xs }) => (
                  <div key={label}>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className={`mt-1 text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : ''} ${xs ? 'text-xs' : ''}`}>
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
              <dl className="grid grid-cols-2 gap-4 text-sm">
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
