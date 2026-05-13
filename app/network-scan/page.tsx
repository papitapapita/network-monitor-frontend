'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  DeviceModelResponseDTO,
  DeviceResponseDTO,
  DeviceOwnerType,
  DeviceStatus,
  DeviceCategory,
  DeviceType,
  CreateDeviceDTO,
  VendorDTO,
} from '@/types/device.types';
import { LocationResponseDTO } from '@/types/location.types';
import { DiscoveredHost, NetworkScanResult } from '@/types/network-scan.types';
import {
  Button,
  Input,
  Select,
  Table,
  TableEmptyState,
  LoadingSpinner,
  Modal,
} from '@/components/ui';
import { LocationCreateModal } from '@/components/LocationCreateModal';

function normalizeMac(mac: string): string {
  return mac.replace(/[:\-\.]/g, '').toUpperCase();
}

function isValidCidr(value: string): boolean {
  const cidrRe = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[1-2]\d|3[0-2])$/;
  if (!cidrRe.test(value)) return false;
  const [ip, prefix] = value.split('/');
  const parts = ip.split('.').map(Number);
  if (parts.some((p) => p > 255)) return false;
  return Number(prefix) >= 0 && Number(prefix) <= 32;
}

const CREATE_MODEL_SENTINEL = '__create_new__';

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

const MANUFACTURER_ALIASES: Record<string, string> = {
  'routerboard': 'mikrotik',
  'mikrotik': 'mikrotik',
  'ubiquiti': 'ubiquiti',
  'mimosa': 'mimosa',
  'cambium': 'cambium',
  'cisco': 'cisco',
  'tp-link': 'tp-link',
  'tplink': 'tp-link',
  'huawei': 'huawei',
  'zyxel': 'zyxel',
  'netgear': 'netgear',
  'ligowave': 'ligowave',
  'radwin': 'radwin',
  'siklu': 'siklu',
};

function guessVendorId(manufacturer: string | null, vendors: VendorDTO[]): string {
  if (!manufacturer || vendors.length === 0) return '';
  const raw = manufacturer.toLowerCase();

  for (const [keyword, target] of Object.entries(MANUFACTURER_ALIASES)) {
    if (raw.includes(keyword)) {
      const match = vendors.find((v) => v.name.toLowerCase().includes(target));
      if (match) return match.id;
    }
  }

  const found = vendors.find((v) => raw.includes(v.name.toLowerCase()));
  return found?.id ?? '';
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

interface AddDeviceModalProps {
  host: DiscoveredHost;
  vendors: VendorDTO[];
  deviceModels: DeviceModelResponseDTO[];
  locations: LocationResponseDTO[];
  onLocationCreated: (loc: LocationResponseDTO) => void;
  onClose: () => void;
  onAdded: (ip: string) => void;
}

function AddDeviceModal({
  host,
  vendors,
  deviceModels,
  locations,
  onLocationCreated,
  onClose,
  onAdded,
}: AddDeviceModalProps) {
  const router = useRouter();

  const [selectedVendorId, setSelectedVendorId] = useState(() =>
    guessVendorId(host.manufacturer, vendors)
  );

  const [form, setForm] = useState({
    name: '',
    deviceModelId: '',
    ipAddress: host.ipAddress,
    macAddress: host.macAddress ?? '',
    ownerType: '' as DeviceOwnerType | '',
    status: 'ACTIVE' as DeviceStatus | '',
    category: '' as DeviceCategory | '',
    monitoringEnabled: false,
    pollingIntervalSeconds: 60,
    pollingFailuresBeforeDown: 3,
    serialNumber: '',
    locationId: '',
    installedDate: '',
    description: '',
  });

  const [showInlineModelForm, setShowInlineModelForm] = useState(false);
  const [inlineModelForm, setInlineModelForm] = useState({ model: '', deviceType: '' as DeviceType | '' });
  const [inlineModelErrors, setInlineModelErrors] = useState<Record<string, string>>({});
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [inlineModelError, setInlineModelError] = useState<string | null>(null);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const filteredModels = selectedVendorId
    ? deviceModels.filter((m) => m.vendorId === selectedVendorId)
    : deviceModels;

  const modelSelectOptions = [
    { value: '', label: selectedVendorId ? 'Seleccionar modelo' : 'Seleccionar modelo (todos)' },
    ...filteredModels.map((m) => ({
      value: m.id,
      label: selectedVendorId ? `${m.model} (${m.deviceType})` : `${m.vendorName} — ${m.model}`,
    })),
    ...(selectedVendorId ? [{ value: CREATE_MODEL_SENTINEL, label: '+ Crear nuevo modelo' }] : []),
  ];

  const modelSelectValue = showInlineModelForm ? CREATE_MODEL_SENTINEL : form.deviceModelId;

  const handleVendorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVendorId(e.target.value);
    setForm((prev) => ({ ...prev, deviceModelId: '' }));
    setShowInlineModelForm(false);
    setInlineModelForm({ model: '', deviceType: '' });
    setInlineModelErrors({});
    setInlineModelError(null);
    if (errors.deviceModelId) setErrors((prev) => { const n = { ...prev }; delete n.deviceModelId; return n; });
  };

  const handleModelSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === CREATE_MODEL_SENTINEL) {
      setShowInlineModelForm(true);
      setForm((prev) => ({ ...prev, deviceModelId: '' }));
    } else {
      setShowInlineModelForm(false);
      setInlineModelForm({ model: '', deviceType: '' });
      setInlineModelErrors({});
      setInlineModelError(null);
      setForm((prev) => ({ ...prev, deviceModelId: value }));
    }
    if (errors.deviceModelId) setErrors((prev) => { const n = { ...prev }; delete n.deviceModelId; return n; });
  };

  const handleInlineModelChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInlineModelForm((prev) => ({ ...prev, [name]: value }));
    if (inlineModelErrors[name]) setInlineModelErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleCreateModel = async () => {
    const errs: Record<string, string> = {};
    if (!inlineModelForm.model.trim()) errs.model = 'El nombre del modelo es requerido';
    if (!inlineModelForm.deviceType) errs.deviceType = 'El tipo de dispositivo es requerido';
    setInlineModelErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsCreatingModel(true);
    setInlineModelError(null);

    const result = await apiService.createDeviceModel({
      vendorId: selectedVendorId,
      model: inlineModelForm.model.trim(),
      deviceType: inlineModelForm.deviceType as DeviceType,
    });

    if (result.success && result.data) {
      const newModel = result.data;
      setForm((prev) => ({ ...prev, deviceModelId: newModel.id }));
      setShowInlineModelForm(false);
      setInlineModelForm({ model: '', deviceType: '' });
      setInlineModelErrors({});
    } else {
      setInlineModelError(result.error || 'Error al crear el modelo');
    }
    setIsCreatingModel(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'El nombre es requerido';
    if (!selectedVendorId) e.selectedVendorId = 'El fabricante es requerido';
    if (!form.deviceModelId) e.deviceModelId = 'El modelo es requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);

    const dto: CreateDeviceDTO = {
      name: form.name.trim(),
      deviceModelId: form.deviceModelId,
      ipAddress: form.ipAddress.trim() || undefined,
      macAddress: form.macAddress.trim() || undefined,
      status: (form.status || 'ACTIVE') as DeviceStatus,
    };
    if (form.ownerType) dto.ownerType = form.ownerType as DeviceOwnerType;
    if (form.category) dto.category = form.category as DeviceCategory;
    dto.monitoringEnabled = form.monitoringEnabled;
    if (form.serialNumber.trim()) dto.serialNumber = form.serialNumber.trim();
    if (form.locationId) dto.locationId = form.locationId;
    if (form.installedDate) dto.installedDate = new Date(form.installedDate).toISOString();
    if (form.description.trim()) dto.description = form.description.trim();

    const res = await apiService.createDevice(dto);
    if (res.success && res.data) {
      if (form.monitoringEnabled) {
        await apiService.createPollingConfig(res.data.id, {
          enabled: true,
          ipAddress: dto.ipAddress ?? null,
          intervalSeconds: form.pollingIntervalSeconds,
          failuresBeforeDown: form.pollingFailuresBeforeDown,
        });
      }
      onAdded(host.ipAddress);
      router.push(`/devices/${res.data.id}`);
    } else {
      setApiError(res.error || 'Error al crear el dispositivo');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal isOpen onClose={onClose} title="Agregar Dispositivo" size="xl">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Scrollable body */}
          <div className="overflow-y-auto max-h-[calc(100vh-16rem)] space-y-4 pr-1">
            {apiError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-400">{apiError}</p>
              </div>
            )}

            {/* Información Requerida */}
            <Section title="Información Requerida">
              <div className="space-y-4">
                <Input
                  label="Nombre"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Router-Core-01"
                  error={errors.name}
                  required
                  fullWidth
                />

                <Select
                  label="Fabricante"
                  value={selectedVendorId}
                  onChange={handleVendorChange}
                  options={[
                    { value: '', label: 'Seleccionar fabricante' },
                    ...vendors.map((v) => ({ value: v.id, label: v.name })),
                  ]}
                  error={errors.selectedVendorId}
                  required
                  fullWidth
                />

                {host.manufacturer && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                    Detectado: <span className="font-medium text-gray-700 dark:text-gray-300">{host.manufacturer}</span>
                  </p>
                )}

                <div>
                  <Select
                    label="Modelo"
                    value={modelSelectValue}
                    onChange={handleModelSelectChange}
                    options={modelSelectOptions}
                    error={errors.deviceModelId}
                    required
                    disabled={!selectedVendorId}
                    fullWidth
                  />

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
                        <Button type="button" size="sm" onClick={handleCreateModel} isLoading={isCreatingModel}>
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
                            setForm((prev) => ({ ...prev, deviceModelId: '' }));
                          }}
                          disabled={isCreatingModel}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* Clasificación */}
            <Section title="Clasificación">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Estado"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  options={[
                    { value: 'ACTIVE', label: 'Activo' },
                    { value: 'INVENTORY', label: 'Inventario' },
                    { value: 'DAMAGED', label: 'Dañado' },
                  ]}
                  fullWidth
                />
                <Select
                  label="Categoría"
                  name="category"
                  value={form.category}
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
                  value={form.ownerType}
                  onChange={handleChange}
                  options={[
                    { value: '', label: 'Seleccionar tipo' },
                    { value: 'COMPANY', label: 'Empresa' },
                    { value: 'CLIENT', label: 'Cliente' },
                  ]}
                  error={errors.ownerType}
                  fullWidth
                />
                <div className="sm:col-span-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="monitoringEnabled"
                      name="monitoringEnabled"
                      checked={form.monitoringEnabled}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="monitoringEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Habilitar Monitoreo
                    </label>
                  </div>

                  {form.monitoringEnabled && (
                    <div className="p-4 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Configuración de Polling</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Select
                          label="Intervalo de polling"
                          name="pollingIntervalSeconds"
                          value={String(form.pollingIntervalSeconds)}
                          onChange={(e) => setForm((prev) => ({ ...prev, pollingIntervalSeconds: Number(e.target.value) }))}
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
                          value={String(form.pollingFailuresBeforeDown)}
                          onChange={(e) => setForm((prev) => ({ ...prev, pollingFailuresBeforeDown: Math.max(1, Number(e.target.value)) }))}
                          fullWidth
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* Detalles de Red */}
            <Section title="Detalles de Red">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Dirección IP"
                  name="ipAddress"
                  value={form.ipAddress}
                  onChange={handleChange}
                  placeholder="192.168.1.100"
                  disabled={!!host.ipAddress}
                  fullWidth
                />
                <Input
                  label="Dirección MAC"
                  name="macAddress"
                  value={form.macAddress}
                  onChange={handleChange}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  disabled={!!host.macAddress}
                  fullWidth
                />
                <Input
                  label="Número de Serie"
                  name="serialNumber"
                  value={form.serialNumber}
                  onChange={handleChange}
                  fullWidth
                />
              </div>
            </Section>

            {/* Ubicación y Metadatos */}
            <Section title="Ubicación y Metadatos">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ubicación
                  </label>
                  <div className="flex items-center gap-2">
                    <Select
                      name="locationId"
                      value={form.locationId}
                      onChange={handleChange}
                      options={[
                        { value: '', label: 'Sin ubicación' },
                        ...locations.map((l) => ({ value: l.id, label: l.name })),
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
                  value={form.installedDate}
                  onChange={handleChange}
                  fullWidth
                />
                <div className="sm:col-span-2">
                  <Input
                    label="Descripción"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Descripción opcional"
                    fullWidth
                  />
                </div>
              </div>
            </Section>
          </div>

          {/* Pinned footer */}
          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={submitting}>
              Crear Dispositivo
            </Button>
          </div>
        </form>
      </Modal>

      <LocationCreateModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onCreated={(loc) => {
          onLocationCreated(loc);
          setForm((prev) => ({ ...prev, locationId: loc.id }));
          setShowLocationModal(false);
        }}
      />
    </>
  );
}

const SCAN_CACHE_KEY = 'nms_last_scan';

interface ScanCache {
  segment: string;
  result: NetworkScanResult;
  addedIps: string[];
  scannedAt: number;
}

export default function NetworkScanPage() {
  const [segment, setSegment] = useState('');
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [result, setResult] = useState<NetworkScanResult | null>(null);
  const [scannedAt, setScannedAt] = useState<number | null>(null);

  const [vendors, setVendors] = useState<VendorDTO[]>([]);
  const [deviceModels, setDeviceModels] = useState<DeviceModelResponseDTO[]>([]);
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [addingHost, setAddingHost] = useState<DiscoveredHost | null>(null);
  const [addedIps, setAddedIps] = useState<Set<string>>(new Set());
  // Maps for detecting already-registered devices: ip → device, normalizedMac → device
  const [devicesByIp, setDevicesByIp] = useState<Map<string, DeviceResponseDTO>>(new Map());
  const [devicesByMac, setDevicesByMac] = useState<Map<string, DeviceResponseDTO>>(new Map());

  const loadDeviceMaps = async () => {
    const devRes = await apiService.listDevices({ limit: 1000 });
    if (devRes.success && devRes.data) {
      const byIp = new Map<string, DeviceResponseDTO>();
      const byMac = new Map<string, DeviceResponseDTO>();
      for (const d of devRes.data.devices) {
        if (d.ipAddress) byIp.set(d.ipAddress, d);
        if (d.macAddress) byMac.set(normalizeMac(d.macAddress), d);
      }
      setDevicesByIp(byIp);
      setDevicesByMac(byMac);
    }
  };

  useEffect(() => {
    Promise.all([
      apiService.listVendors({ limit: 100 }),
      apiService.listDeviceModels({ limit: 100 }),
      apiService.listLocations({ limit: 100 }),
    ]).then(([vendorsRes, modelsRes, locationsRes]) => {
      if (vendorsRes.success && vendorsRes.data) setVendors(vendorsRes.data.vendors);
      if (modelsRes.success && modelsRes.data) setDeviceModels(modelsRes.data.deviceModels);
      if (locationsRes.success && locationsRes.data) setLocations(locationsRes.data.locations);
    });

    // Restore last scan from cache
    try {
      const raw = localStorage.getItem(SCAN_CACHE_KEY);
      if (raw) {
        const cached: ScanCache = JSON.parse(raw);
        setSegment(cached.segment);
        setResult(cached.result);
        setAddedIps(new Set(cached.addedIps));
        setScannedAt(cached.scannedAt);
        loadDeviceMaps();
      }
    } catch {
      // ignore corrupt cache
    }
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCidr(segment.trim())) {
      setSegmentError('Ingresa un bloque CIDR válido, ej. 192.168.1.0/24 (máximo /22)');
      return;
    }
    setSegmentError(null);
    setScanError(null);
    setResult(null);
    setAddedIps(new Set());
    setDevicesByIp(new Map());
    setDevicesByMac(new Map());
    setIsScanning(true);

    const res = await apiService.scanNetwork({ segment: segment.trim() });
    if (res.success && res.data) {
      const now = Date.now();
      setResult(res.data);
      setScannedAt(now);

      // Persist scan to cache
      try {
        const cache: ScanCache = { segment: segment.trim(), result: res.data, addedIps: [], scannedAt: now };
        localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(cache));
      } catch { /* ignore */ }

      await loadDeviceMaps();
    } else {
      setScanError(res.error || 'Error al escanear la red');
    }
    setIsScanning(false);
  };

  const updateCacheAddedIps = (ips: Set<string>) => {
    try {
      const raw = localStorage.getItem(SCAN_CACHE_KEY);
      if (raw) {
        const cached: ScanCache = JSON.parse(raw);
        cached.addedIps = [...ips];
        localStorage.setItem(SCAN_CACHE_KEY, JSON.stringify(cached));
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Escaneo de Red</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Descubre hosts activos en un segmento de red
        </p>
      </div>

      {/* Scan form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Segmento CIDR"
              value={segment}
              onChange={(e) => { setSegment(e.target.value); setSegmentError(null); }}
              placeholder="192.168.1.0/24"
              error={segmentError ?? undefined}
              fullWidth
            />
          </div>
          <Button type="submit" isLoading={isScanning} disabled={isScanning || !segment.trim()}>
            {isScanning ? 'Escaneando…' : 'Escanear'}
          </Button>
        </form>
      </div>

      {scanError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{scanError}</p>
        </div>
      )}

      {isScanning && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Escaneando red…" />
        </div>
      )}

      {result && !isScanning && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-4 text-sm text-gray-600 dark:text-gray-400">
            <span>Segmento: <strong className="text-gray-900 dark:text-gray-100">{result.segment}</strong></span>
            <span>IPs escaneadas: <strong className="text-gray-900 dark:text-gray-100">{result.scannedCount}</strong></span>
            <span>
              Hosts encontrados:{' '}
              <strong className="text-green-700 dark:text-green-400">{result.responsiveCount}</strong>
            </span>
            {scannedAt && (
              <span className="text-gray-400 dark:text-gray-500">
                Escaneado: {new Date(scannedAt).toLocaleString('es', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <Table>
              <Table.Header>
                <Table.Head>Dirección IP</Table.Head>
                <Table.Head>Latencia</Table.Head>
                <Table.Head>MAC</Table.Head>
                <Table.Head>Fabricante</Table.Head>
                <Table.Head> </Table.Head>
              </Table.Header>
              <Table.Body>
                {result.discoveredHosts.length === 0 ? (
                  <TableEmptyState message="No se encontraron hosts activos en el segmento." />
                ) : (
                  result.discoveredHosts.map((host) => (
                    <Table.Row key={host.ipAddress}>
                      <Table.Cell>
                        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                          {host.ipAddress}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {host.latencyMs} ms
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                          {host.macAddress ?? '—'}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {host.manufacturer ?? '—'}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        {(() => {
                          const existingByIp = devicesByIp.get(host.ipAddress);
                          const existingByMac = host.macAddress
                            ? devicesByMac.get(normalizeMac(host.macAddress))
                            : undefined;
                          const existing = existingByIp ?? existingByMac;

                          if (existing) {
                            return (
                              <Link
                                href={`/devices/${existing.id}`}
                                className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                              >
                                Registrado →
                              </Link>
                            );
                          }
                          if (addedIps.has(host.ipAddress)) {
                            return (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                Agregado
                              </span>
                            );
                          }
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAddingHost(host)}
                            >
                              Agregar
                            </Button>
                          );
                        })()}
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table>
          </div>
        </>
      )}

      {addingHost && (
        <AddDeviceModal
          host={addingHost}
          vendors={vendors}
          deviceModels={deviceModels}
          locations={locations}
          onLocationCreated={(loc) => setLocations((prev) => [...prev, loc])}
          onClose={() => setAddingHost(null)}
          onAdded={(ip) => {
            setAddedIps((prev) => {
              const next = new Set(prev).add(ip);
              updateCacheAddedIps(next);
              return next;
            });
            setAddingHost(null);
          }}
        />
      )}
    </div>
  );
}
