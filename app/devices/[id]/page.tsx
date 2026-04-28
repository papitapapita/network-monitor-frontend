'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  DeviceResponseDTO,
  UpdateDeviceDTO,
  LocationResponseDTO,
  PollingStatusDTO,
  PollingHistoryResponse,
  ManualPollResultDTO,
  DeviceStatus,
  DeviceCategory,
  DeviceOwnerType
} from '@/types/device.types';
import {
  Card,
  Button,
  Input,
  Select,
  LoadingSpinner,
  Badge,
  getDeviceStatusBadgeVariant,
  getPollingStatusBadgeVariant
} from '@/components/ui';
import { LocationCreateModal } from '@/components/LocationCreateModal';

type Tab = 'details' | 'polling';

const STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: 'Activo',
  INVENTORY: 'Inventario',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED: 'Dañado',
  DECOMMISSIONED: 'Descomisionado',
};

const CONNECTIVITY_LABELS: Record<string, string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Desconectado',
  UNKNOWN: 'Desconocido',
};

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>('details');

  // ── Details ──────────────────────────────────────────────
  const [device, setDevice] = useState<DeviceResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    status: '' as DeviceStatus | '',
    category: '' as DeviceCategory | '',
    ownerType: '' as DeviceOwnerType | '',
    ipAddress: '',
    macAddress: '',
    serialNumber: '',
    locationId: '',
    installedDate: '',
    description: '',
    monitoringEnabled: false
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Polling – Status ──────────────────────────────────────
  const [pollingStatus, setPollingStatus] = useState<PollingStatusDTO | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollResult, setPollResult] = useState<ManualPollResultDTO | null>(null);

  // ── Polling – Config ──────────────────────────────────────
  const [configForm, setConfigForm] = useState({
    enabled: false,
    intervalSeconds: '',
    failuresBeforeDown: ''
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);

  // ── Polling – History ─────────────────────────────────────
  const [historyQuery, setHistoryQuery] = useState({
    fromDate: '',
    toDate: '',
    status: '',
    limit: '50',
    offset: 0
  });
  const [pollingHistory, setPollingHistory] = useState<PollingHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ── Fetch device ──────────────────────────────────────────
  const fetchDevice = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.getDevice(deviceId);
    if (result.success && result.data) {
      const d = result.data;
      setDevice(d);
      setFormData({
        name: d.name,
        status: d.status,
        category: d.category ?? '',
        ownerType: d.ownerType,
        ipAddress: d.ipAddress ?? '',
        macAddress: d.macAddress ?? '',
        serialNumber: d.serialNumber ?? '',
        locationId: d.locationId ?? '',
        installedDate: d.installedDate ? d.installedDate.slice(0, 10) : '',
        description: d.description ?? '',
        monitoringEnabled: d.monitoringEnabled
      });
    } else {
      setError(result.error || 'Error al cargar el dispositivo');
    }
    setIsLoading(false);
  }, [deviceId]);

  useEffect(() => {
    fetchDevice();
    apiService.listLocations({ limit: 100 }).then((r) => {
      if (r.success && r.data) setLocations(r.data.locations);
    });
  }, [fetchDevice]);

  // ── Fetch polling status ──────────────────────────────────
  const fetchPollingStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    const result = await apiService.getPollingStatus(deviceId);
    console.log('[fetchPollingStatus] result:', result);
    if (result.success && result.data) {
      const s = result.data;
      setPollingStatus(s);
      setConfigForm({
        enabled: s.pollingEnabled,
        intervalSeconds: String(s.intervalSeconds),
        failuresBeforeDown: String(s.failuresBeforeDown)
      });
    } else {
      setStatusError(result.error || 'Error al cargar el estado de sondeo');
    }
    setStatusLoading(false);
  }, [deviceId]);

  useEffect(() => {
    if (activeTab === 'polling' && !pollingStatus) {
      fetchPollingStatus();
    }
  }, [activeTab, pollingStatus, fetchPollingStatus]);

  // ── Edit form handlers ────────────────────────────────────
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
      installedDate: formData.installedDate
        ? new Date(formData.installedDate).toISOString()
        : null,
      description: formData.description.trim() || null,
      monitoringEnabled: formData.monitoringEnabled
    };

    const result = await apiService.updateDevice(deviceId, dto);
    if (result.success && result.data) {
      setDevice(result.data);
      setIsEditing(false);
    } else {
      setError(result.error || 'Error al actualizar el dispositivo');
    }
    setIsSaving(false);
  };

  const cancelEdit = () => {
    if (!device) return;
    setIsEditing(false);
    setFormErrors({});
    setFormData({
      name: device.name,
      status: device.status,
      category: device.category ?? '',
      ownerType: device.ownerType,
      ipAddress: device.ipAddress ?? '',
      macAddress: device.macAddress ?? '',
      serialNumber: device.serialNumber ?? '',
      locationId: device.locationId ?? '',
      installedDate: device.installedDate ? device.installedDate.slice(0, 10) : '',
      description: device.description ?? '',
      monitoringEnabled: device.monitoringEnabled
    });
  };

  // ── Poll now ──────────────────────────────────────────────
  const handlePollNow = async () => {
    setIsPolling(true);
    setPollResult(null);
    console.log('Hello there')
    const result = await apiService.triggerPoll(deviceId);
    console.log(result);
    if (result.success && result.data) {
      setPollResult(result.data);
      fetchPollingStatus();
    } else {
      setStatusError(result.error || 'Error en el sondeo');
    }
    setIsPolling(false);
  };

  // ── Save polling config ───────────────────────────────────
  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(false);

    const data: { intervalSeconds?: number; failuresBeforeDown?: number; enabled?: boolean } = {};
    if (configForm.intervalSeconds) data.intervalSeconds = parseInt(configForm.intervalSeconds);
    if (configForm.failuresBeforeDown) data.failuresBeforeDown = parseInt(configForm.failuresBeforeDown);
    data.enabled = configForm.enabled;

    const result = await apiService.updatePollingConfig(deviceId, data);
    if (result.success) {
      setConfigSuccess(true);
      fetchPollingStatus();
    } else {
      setConfigError(result.error || 'Error al guardar la configuración');
    }
    setConfigSaving(false);
  };

  // ── Fetch history ─────────────────────────────────────────
  const fetchHistory = async (offset = 0) => {
    setHistoryLoading(true);
    setHistoryError(null);
    const result = await apiService.getPollingHistory(deviceId, {
      fromDate: historyQuery.fromDate || undefined,
      toDate: historyQuery.toDate || undefined,
      status: historyQuery.status || undefined,
      limit: parseInt(historyQuery.limit),
      offset
    });
    if (result.success && result.data) {
      setPollingHistory(result.data);
      setHistoryQuery((prev) => ({ ...prev, offset }));
    } else {
      setHistoryError(result.error || 'Error al cargar el historial');
    }
    setHistoryLoading(false);
  };

  // ── Loading / Error ───────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Cargando dispositivo..." />
      </div>
    );
  }

  if (error && !device) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{error}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>Volver</Button>
            <Button onClick={fetchDevice}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!device) return null;

  const tabLabels: Record<Tab, string> = { details: 'Detalles', polling: 'Sondeo' };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Page header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              ← Atrás
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{device.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
              {STATUS_LABELS[device.status] ?? device.status}
            </Badge>
            {device.category && (
              <Badge variant="info">{device.category.replace(/_/g, ' ')}</Badge>
            )}
            <Badge variant={device.monitoringEnabled ? 'success' : 'neutral'}>
              Monitoreo {device.monitoringEnabled ? 'ACTIVO' : 'INACTIVO'}
            </Badge>
          </div>
        </div>

        {activeTab === 'details' && (
          <div className="flex gap-2">
            {!isEditing ? (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Editar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} isLoading={isSaving}>
                  Guardar Cambios
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-6">
          {(['details', 'polling'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Details Tab ─────────────────────────────────── */}
      {activeTab === 'details' && (
        <div className="space-y-6">
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
                  <Input label="Dirección IP" name="ipAddress" value={formData.ipAddress} onChange={handleChange} fullWidth />
                  <Input label="Dirección MAC" name="macAddress" value={formData.macAddress} onChange={handleChange} fullWidth />
                  <Input label="Número de Serie" name="serialNumber" value={formData.serialNumber} onChange={handleChange} fullWidth />
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
                      {
                        label: 'Categoría',
                        value: device.category ? device.category.replace(/_/g, ' ') : '—'
                      },
                      {
                        label: 'Tipo de Propietario',
                        value: device.ownerType === 'COMPANY' ? 'Empresa' : 'Cliente'
                      },
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
                        value: device.installedDate
                          ? new Date(device.installedDate).toLocaleDateString('es')
                          : '—'
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
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {new Date(device.createdAt).toLocaleString('es')}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Última Actualización</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {new Date(device.updatedAt).toLocaleString('es')}
                      </dd>
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
        </div>
      )}

      {/* ── Polling Tab ──────────────────────────────────── */}
      {activeTab === 'polling' && (
        <div className="space-y-6">

          {/* Status */}
          <Card>
            <Card.Header>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Estado del Sondeo</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={fetchPollingStatus} disabled={statusLoading}>
                    Actualizar
                  </Button>
                  <Button size="sm" onClick={handlePollNow} isLoading={isPolling}>
                    Sondear Ahora
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {statusLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner message="Cargando estado..." />
                </div>
              ) : statusError ? (
                <p className="text-red-600 dark:text-red-400 text-sm">{statusError}</p>
              ) : pollingStatus ? (
                <>
                  <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Estado Actual</dt>
                      <dd className="mt-1">
                        <Badge variant={getPollingStatusBadgeVariant(pollingStatus.currentStatus)}>
                          {CONNECTIVITY_LABELS[pollingStatus.currentStatus] ?? pollingStatus.currentStatus}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Sondeo Habilitado</dt>
                      <dd className="mt-1">
                        <Badge variant={pollingStatus.pollingEnabled ? 'success' : 'neutral'}>
                          {pollingStatus.pollingEnabled ? 'Sí' : 'No'}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Fallos Consecutivos</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{pollingStatus.consecutiveFailures}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Intervalo</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{pollingStatus.intervalSeconds}s</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Fallos Antes de Caída</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{pollingStatus.failuresBeforeDown}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Último Sondeo</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {pollingStatus.lastPolled
                          ? new Date(pollingStatus.lastPolled).toLocaleString('es')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Próximo Programado</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {pollingStatus.nextScheduled
                          ? new Date(pollingStatus.nextScheduled).toLocaleString('es')
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  {pollResult && (
                    <div className={`mt-4 p-3 rounded-md text-sm ${
                      pollResult.status === 'SUCCESS'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                    }`}>
                      Resultado: <strong>{pollResult.status === 'SUCCESS' ? 'Exitoso' : 'Fallido'}</strong> — {pollResult.message}
                      {pollResult.metrics && ` (${pollResult.metrics.latencyMs}ms)`}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Sin estado de sondeo disponible.</p>
              )}
            </Card.Body>
          </Card>

          {/* Config */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configuración de Sondeo</h2>
            </Card.Header>
            <Card.Body>
              {configError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-4 text-sm text-red-800 dark:text-red-400">
                  {configError}
                </div>
              )}
              {configSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 mb-4 text-sm text-green-800 dark:text-green-400">
                  Configuración guardada.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Intervalo (segundos)"
                  type="number"
                  value={configForm.intervalSeconds}
                  onChange={(e) => setConfigForm((p) => ({ ...p, intervalSeconds: e.target.value }))}
                  fullWidth
                />
                <Input
                  label="Fallos Antes de Caída"
                  type="number"
                  value={configForm.failuresBeforeDown}
                  onChange={(e) => setConfigForm((p) => ({ ...p, failuresBeforeDown: e.target.value }))}
                  fullWidth
                />
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configForm.enabled}
                      onChange={(e) => setConfigForm((p) => ({ ...p, enabled: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-400 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Sondeo habilitado
                    </span>
                  </label>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={handleSaveConfig} isLoading={configSaving}>
                  Guardar Configuración
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* History */}
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Historial de Sondeo</h2>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Input
                  label="Desde"
                  type="date"
                  value={historyQuery.fromDate}
                  onChange={(e) => setHistoryQuery((p) => ({ ...p, fromDate: e.target.value }))}
                  fullWidth
                />
                <Input
                  label="Hasta"
                  type="date"
                  value={historyQuery.toDate}
                  onChange={(e) => setHistoryQuery((p) => ({ ...p, toDate: e.target.value }))}
                  fullWidth
                />
                <Select
                  label="Estado"
                  value={historyQuery.status}
                  onChange={(e) => setHistoryQuery((p) => ({ ...p, status: e.target.value }))}
                  options={[
                    { value: '', label: 'Todos' },
                    { value: 'SUCCESS', label: 'Exitoso' },
                    { value: 'FAILED', label: 'Fallido' }
                  ]}
                  fullWidth
                />
                <Select
                  label="Límite"
                  value={historyQuery.limit}
                  onChange={(e) => setHistoryQuery((p) => ({ ...p, limit: e.target.value }))}
                  options={[
                    { value: '20', label: '20' },
                    { value: '50', label: '50' },
                    { value: '100', label: '100' },
                    { value: '500', label: '500' }
                  ]}
                  fullWidth
                />
              </div>
              <Button size="sm" onClick={() => fetchHistory(0)} isLoading={historyLoading}>
                Obtener Historial
              </Button>

              {historyError && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">{historyError}</p>
              )}

              {pollingHistory && (
                <div className="mt-4">
                  {/* Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    {[
                      { label: 'Tasa de Éxito', value: `${pollingHistory.statistics.successRate.toFixed(1)}%` },
                      { label: 'Disponibilidad', value: `${pollingHistory.statistics.uptimePercentage.toFixed(1)}%` },
                      { label: 'Latencia Prom.', value: `${pollingHistory.statistics.averageResponseTime.toFixed(0)}ms` },
                      { label: 'Latencia Mín.', value: `${pollingHistory.statistics.minResponseTime.toFixed(0)}ms` },
                      { label: 'Latencia Máx.', value: `${pollingHistory.statistics.maxResponseTime.toFixed(0)}ms` }
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Results table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                          <th className="pb-2 pr-4 font-medium">Fecha/Hora</th>
                          <th className="pb-2 pr-4 font-medium">Estado</th>
                          <th className="pb-2 pr-4 font-medium">Latencia</th>
                          <th className="pb-2 font-medium">Dispositivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pollingHistory.results.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-gray-400 dark:text-gray-500">
                              Sin resultados
                            </td>
                          </tr>
                        ) : (
                          pollingHistory.results.map((r) => (
                            <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700">
                              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {new Date(r.timestamp).toLocaleString('es')}
                              </td>
                              <td className="py-2 pr-4">
                                <Badge variant={r.status === 'SUCCESS' ? 'success' : 'danger'}>
                                  {r.status === 'SUCCESS' ? 'Exitoso' : 'Fallido'}
                                </Badge>
                              </td>
                              <td className="py-2 pr-4 font-mono text-gray-900 dark:text-gray-100">
                                {r.metrics ? `${r.metrics.latencyMs}ms` : '—'}
                              </td>
                              <td className="py-2">
                                <Badge variant={getPollingStatusBadgeVariant(r.deviceStatus)}>
                                  {CONNECTIVITY_LABELS[r.deviceStatus] ?? r.deviceStatus}
                                </Badge>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pollingHistory.totalCount > parseInt(historyQuery.limit) && (
                    <div className="flex justify-between items-center mt-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>
                        {historyQuery.offset + 1}–{Math.min(
                          historyQuery.offset + parseInt(historyQuery.limit),
                          pollingHistory.totalCount
                        )} de {pollingHistory.totalCount}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={historyQuery.offset === 0}
                          onClick={() => fetchHistory(Math.max(0, historyQuery.offset - parseInt(historyQuery.limit)))}
                        >
                          Anterior
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={historyQuery.offset + parseInt(historyQuery.limit) >= pollingHistory.totalCount}
                          onClick={() => fetchHistory(historyQuery.offset + parseInt(historyQuery.limit))}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </div>
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
