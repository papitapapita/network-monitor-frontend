'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  CreateDeviceDTO,
  DeviceModelResponseDTO,
  DeviceStatus,
  DeviceCategory,
  DeviceOwnerType,
} from '@/types/device.types';
import { LocationResponseDTO } from '@/types/location.types';
import { Card, Button, Input, Select, LoadingSpinner } from '@/components/ui';
import { LocationCreateModal } from '@/components/LocationCreateModal';

export default function CreateDevicePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [deviceModels, setDeviceModels] = useState<DeviceModelResponseDTO[]>([]);
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [formData, setFormData] = useState({
    deviceModelId: '',
    name: '',
    ownerType: '' as DeviceOwnerType | '',
    status: '' as DeviceStatus | '',
    category: '' as DeviceCategory | '',
    monitoringEnabled: false,
    ipAddress: '',
    macAddress: '',
    serialNumber: '',
    locationId: '',
    installedDate: '',
    description: ''
  });

  useEffect(() => {
    const loadOptions = async () => {
      const [modelsRes, locationsRes] = await Promise.all([
        apiService.listDeviceModels({ limit: 100 }),
        apiService.listLocations({ limit: 100 })
      ]);
      if (modelsRes.success && modelsRes.data) setDeviceModels(modelsRes.data.deviceModels);
      if (locationsRes.success && locationsRes.data) setLocations(locationsRes.data.locations);
      setLoadingOptions(false);
    };
    loadOptions();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.deviceModelId) errors.deviceModelId = 'El modelo es requerido';
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';
    if (!formData.ownerType) errors.ownerType = 'El tipo de propietario es requerido';
    if (!formData.ipAddress.trim()) errors.ipAddress = 'La dirección IP es requerida';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);

    const dto: CreateDeviceDTO = {
      deviceModelId: formData.deviceModelId,
      name: formData.name.trim(),
      ownerType: formData.ownerType as DeviceOwnerType
    };

    if (formData.status) dto.status = formData.status as DeviceStatus;
    if (formData.category) dto.category = formData.category as DeviceCategory;
    dto.monitoringEnabled = formData.monitoringEnabled;
    dto.ipAddress = formData.ipAddress.trim();
    if (formData.macAddress.trim()) dto.macAddress = formData.macAddress.trim();
    if (formData.serialNumber.trim()) dto.serialNumber = formData.serialNumber.trim();
    if (formData.locationId) dto.locationId = formData.locationId;
    if (formData.installedDate) dto.installedDate = new Date(formData.installedDate).toISOString();
    if (formData.description.trim()) dto.description = formData.description.trim();

    const result = await apiService.createDevice(dto);

    if (result.success && result.data) {
      if (formData.monitoringEnabled) {
        await apiService.createPollingConfig(result.data.id, {
          enabled: true,
          ipAddress: dto.ipAddress ?? null
        });
      }
      router.push(`/devices/${result.data.id}`);
    } else {
      setError(result.error || 'Error al crear el dispositivo');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Atrás
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Agregar Dispositivo</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Registra un nuevo dispositivo en la red</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {loadingOptions ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner message="Cargando opciones..." />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Required */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información Requerida</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Select
                    label="Modelo de Dispositivo"
                    name="deviceModelId"
                    value={formData.deviceModelId}
                    onChange={handleChange}
                    options={[
                      { value: '', label: 'Seleccionar modelo' },
                      ...deviceModels.map((m) => ({
                        value: m.id,
                        label: `${m.vendorName} — ${m.model} (${m.deviceType})`
                      }))
                    ]}
                    error={formErrors.deviceModelId}
                    required
                    fullWidth
                  />
                </div>
                <Input
                  label="Nombre"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Router-Core-01"
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
                    { value: '', label: 'Seleccionar tipo' },
                    { value: 'COMPANY', label: 'Empresa' },
                    { value: 'CLIENT', label: 'Cliente' }
                  ]}
                  error={formErrors.ownerType}
                  required
                  fullWidth
                />
              </div>
            </Card.Body>
          </Card>

          {/* Classification */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Clasificación</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Estado"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Por defecto (Inventario)' },
                    { value: 'INVENTORY', label: 'Inventario' },
                    { value: 'ACTIVE', label: 'Activo' },
                    { value: 'MAINTENANCE', label: 'Mantenimiento' },
                    { value: 'DAMAGED', label: 'Dañado' },
                    { value: 'DECOMMISSIONED', label: 'Descomisionado' }
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
                    { value: 'CORE', label: 'Núcleo' },
                    { value: 'DISTRIBUTION', label: 'Distribución' },
                    { value: 'POE', label: 'PoE' },
                    { value: 'ACCESS_POINT', label: 'Punto de Acceso' },
                    { value: 'CLIENT_CPE', label: 'CPE Cliente' }
                  ]}
                  fullWidth
                />
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="monitoringEnabled"
                    name="monitoringEnabled"
                    checked={formData.monitoringEnabled}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="monitoringEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Habilitar monitoreo
                  </label>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Network */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalles de Red</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Dirección IP"
                  name="ipAddress"
                  value={formData.ipAddress}
                  onChange={handleChange}
                  placeholder="192.168.1.100"
                  error={formErrors.ipAddress}
                  required
                  fullWidth
                />
                <Input
                  label="Dirección MAC"
                  name="macAddress"
                  value={formData.macAddress}
                  onChange={handleChange}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  fullWidth
                />
                <Input
                  label="Número de Serie"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleChange}
                  fullWidth
                />
              </div>
            </Card.Body>
          </Card>

          {/* Location & Metadata */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ubicación y Metadatos</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ubicación
                  </label>
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
                      className="flex-shrink-0 w-9 h-9 rounded-md border border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center text-xl font-medium"
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
                <div className="md:col-span-2">
                  <Input
                    label="Descripción"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Descripción opcional"
                    fullWidth
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
              Crear Dispositivo
            </Button>
          </div>
        </form>
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
