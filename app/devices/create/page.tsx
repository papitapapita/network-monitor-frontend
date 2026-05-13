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
  VendorDTO,
  DeviceType,
} from '@/types/device.types';
import { LocationResponseDTO } from '@/types/location.types';
import { Card, Button, Input, Select, Combobox, LoadingSpinner } from '@/components/ui';
import { LocationCreateModal } from '@/components/LocationCreateModal';

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

export default function CreateDevicePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [vendors, setVendors] = useState<VendorDTO[]>([]);
  const [allDeviceModels, setAllDeviceModels] = useState<DeviceModelResponseDTO[]>([]);
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Inline "create model" form state
  const [showInlineModelForm, setShowInlineModelForm] = useState(false);
  const [inlineModelForm, setInlineModelForm] = useState({ model: '', deviceType: '' as DeviceType | '' });
  const [inlineModelErrors, setInlineModelErrors] = useState<Record<string, string>>({});
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [inlineModelError, setInlineModelError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    selectedVendorId: '',
    deviceModelId: '',
    name: '',
    ownerType: '' as DeviceOwnerType | '',
    status: '' as DeviceStatus | '',
    category: '' as DeviceCategory | '',
    monitoringEnabled: false,
    pollingIntervalSeconds: 60,
    pollingFailuresBeforeDown: 3,
    ipAddress: '',
    macAddress: '',
    serialNumber: '',
    locationId: '',
    installedDate: '',
    description: '',
  });

  useEffect(() => {
    const loadOptions = async () => {
      const [vendorsRes, modelsRes, locationsRes] = await Promise.all([
        apiService.listVendors({ limit: 100 }),
        apiService.listDeviceModels({ limit: 100 }),
        apiService.listLocations({ limit: 100 }),
      ]);
      if (vendorsRes.success && vendorsRes.data) setVendors(vendorsRes.data.vendors);
      if (modelsRes.success && modelsRes.data) setAllDeviceModels(modelsRes.data.deviceModels);
      if (locationsRes.success && locationsRes.data) setLocations(locationsRes.data.locations);
      setLoadingOptions(false);
    };
    loadOptions();
  }, []);

  const filteredModels = formData.selectedVendorId
    ? allDeviceModels.filter((m) => m.vendorId === formData.selectedVendorId)
    : [];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (formErrors[name]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleInlineModelChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInlineModelForm((prev) => ({ ...prev, [name]: value }));
    if (inlineModelErrors[name]) {
      setInlineModelErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const handleCreateModel = async () => {
    const errors: Record<string, string> = {};
    if (!inlineModelForm.model.trim()) errors.model = 'El nombre del modelo es requerido';
    if (!inlineModelForm.deviceType) errors.deviceType = 'El tipo de dispositivo es requerido';
    setInlineModelErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsCreatingModel(true);
    setInlineModelError(null);

    const result = await apiService.createDeviceModel({
      vendorId: formData.selectedVendorId,
      model: inlineModelForm.model.trim(),
      deviceType: inlineModelForm.deviceType as DeviceType,
    });

    if (result.success && result.data) {
      const newModel = result.data;
      setAllDeviceModels((prev) => [...prev, newModel]);
      setFormData((prev) => ({ ...prev, deviceModelId: newModel.id }));
      setShowInlineModelForm(false);
      setInlineModelForm({ model: '', deviceType: '' });
      setInlineModelErrors({});
    } else {
      setInlineModelError(result.error || 'Error al crear el modelo');
    }
    setIsCreatingModel(false);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'El nombre es requerido';
    if (!formData.selectedVendorId) errors.selectedVendorId = 'El fabricante es requerido';
    if (!formData.deviceModelId) errors.deviceModelId = 'El modelo es requerido';

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
    };
    if (formData.ownerType) dto.ownerType = formData.ownerType as DeviceOwnerType;

    if (formData.status) dto.status = formData.status as DeviceStatus;
    if (formData.category) dto.category = formData.category as DeviceCategory;
    dto.monitoringEnabled = formData.monitoringEnabled;
    if (formData.ipAddress.trim()) dto.ipAddress = formData.ipAddress.trim();
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
          ipAddress: dto.ipAddress ?? null,
          intervalSeconds: formData.pollingIntervalSeconds,
          failuresBeforeDown: formData.pollingFailuresBeforeDown,
        });
      }
      router.replace(`/devices/${result.data.id}`);
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
          {/* Información Requerida */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Información Requerida</h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                {/* Name — full width */}
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

                {/* Vendor — full width */}
                <Combobox
                  label="Fabricante"
                  options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                  value={formData.selectedVendorId}
                  onChange={(vendorId) => {
                    setFormData((prev) => ({ ...prev, selectedVendorId: vendorId, deviceModelId: '' }));
                    setShowInlineModelForm(false);
                    setInlineModelForm({ model: '', deviceType: '' });
                    setInlineModelErrors({});
                    setInlineModelError(null);
                    if (formErrors.selectedVendorId) {
                      setFormErrors((prev) => { const n = { ...prev }; delete n.selectedVendorId; return n; });
                    }
                  }}
                  placeholder="Escribir fabricante..."
                  error={formErrors.selectedVendorId}
                  required
                  fullWidth
                />

                {/* Model — full width */}
                <div className="w-full">
                  <Combobox
                    label="Modelo"
                    options={filteredModels.map((m) => ({ value: m.id, label: `${m.model} (${m.deviceType})` }))}
                    value={formData.deviceModelId}
                    onChange={(modelId) => {
                      setShowInlineModelForm(false);
                      setInlineModelForm({ model: '', deviceType: '' });
                      setInlineModelErrors({});
                      setInlineModelError(null);
                      setFormData((prev) => ({ ...prev, deviceModelId: modelId }));
                      if (formErrors.deviceModelId) {
                        setFormErrors((prev) => { const n = { ...prev }; delete n.deviceModelId; return n; });
                      }
                    }}
                    placeholder={formData.selectedVendorId ? 'Escribir modelo...' : 'Primero selecciona un fabricante'}
                    error={formErrors.deviceModelId}
                    required
                    disabled={!formData.selectedVendorId}
                    createLabel="+ Crear nuevo modelo"
                    onCreateNew={() => {
                      setShowInlineModelForm(true);
                      setFormData((prev) => ({ ...prev, deviceModelId: '' }));
                    }}
                    fullWidth
                  />

                  {/* Inline create model form */}
                  {showInlineModelForm && (
                    <div className="mt-3 p-4 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Nuevo modelo para este fabricante</p>

                      {inlineModelError && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                          <p className="text-sm text-red-800 dark:text-red-400">{inlineModelError}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Nombre del modelo"
                          name="model"
                          value={inlineModelForm.model}
                          onChange={handleInlineModelChange}
                          placeholder="RB450G"
                          error={inlineModelErrors.model}
                          fullWidth
                        />
                        <Select
                          label="Tipo de dispositivo"
                          name="deviceType"
                          value={inlineModelForm.deviceType}
                          onChange={handleInlineModelChange}
                          options={DEVICE_TYPE_OPTIONS}
                          error={inlineModelErrors.deviceType}
                          fullWidth
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateModel}
                          isLoading={isCreatingModel}
                        >
                          Crear Modelo
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowInlineModelForm(false);
                            setInlineModelForm({ model: '', deviceType: '' });
                            setInlineModelErrors({});
                            setInlineModelError(null);
                            setFormData((prev) => ({ ...prev, deviceModelId: '' }));
                          }}
                          disabled={isCreatingModel}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* IP Address — required for ACTIVE status or any category */}
                <Input
                  label="Dirección IP"
                  name="ipAddress"
                  value={formData.ipAddress}
                  onChange={handleChange}
                  placeholder="192.168.1.100"
                  error={formErrors.ipAddress}
                  fullWidth
                />
              </div>
            </Card.Body>
          </Card>

          {/* Clasificación */}
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
                <Select
                  label="Tipo de Propietario"
                  name="ownerType"
                  value={formData.ownerType}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Seleccionar tipo' },
                    { value: 'COMPANY', label: 'Empresa' },
                    { value: 'CLIENT', label: 'Cliente' },
                  ]}
                  error={formErrors.ownerType}
                  fullWidth
                />
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="monitoringEnabled"
                      name="monitoringEnabled"
                      checked={formData.monitoringEnabled}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="monitoringEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Habilitar Monitoreo
                    </label>
                  </div>

                  {formData.monitoringEnabled && (
                    <div className="p-4 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Configuración de Polling</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Select
                          label="Intervalo de polling"
                          name="pollingIntervalSeconds"
                          value={String(formData.pollingIntervalSeconds)}
                          onChange={(e) => setFormData((prev) => ({ ...prev, pollingIntervalSeconds: Number(e.target.value) }))}
                          options={[
                            { value: '30', label: '30 segundos' },
                            { value: '60', label: '1 minuto (recomendado)' },
                            { value: '120', label: '2 minutos' },
                            { value: '300', label: '5 minutos' },
                            { value: '600', label: '10 minutos' },
                          ]}
                          fullWidth
                        />
                        <Input
                          label="Fallos antes de desconectar"
                          name="pollingFailuresBeforeDown"
                          type="number"
                          value={String(formData.pollingFailuresBeforeDown)}
                          onChange={(e) => setFormData((prev) => ({ ...prev, pollingFailuresBeforeDown: Math.max(1, Number(e.target.value)) }))}
                          fullWidth
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Detalles de Red */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalles de Red</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  error={formErrors.serialNumber}
                  fullWidth
                />
              </div>
            </Card.Body>
          </Card>

          {/* Ubicación y Metadatos */}
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
                    <Combobox
                      options={locations.map((l) => ({ value: l.id, label: l.name }))}
                      value={formData.locationId}
                      onChange={(locId) => setFormData((prev) => ({ ...prev, locationId: locId }))}
                      placeholder="Escribir ubicación..."
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
