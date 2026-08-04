'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { DeviceModelResponseDTO, DeviceResponseDTO, DeviceStatus } from '@/types/device.types';
import { PollingStatus } from '@/types/polling.types';
import { Button, Badge, LoadingSpinner, getDeviceStatusBadgeVariant, getPollingStatusBadgeVariant } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import { DeviceDetailsTab } from '@/components/devices/DeviceDetailsTab';
import { DevicePollingTab } from '@/components/devices/DevicePollingTab';
import { DeviceWirelessTab } from '@/components/devices/DeviceWirelessTab';
import { DeviceCredentialsTab } from '@/components/devices/DeviceCredentialsTab';
import { isWirelessCategory, deviceCategoryLabel } from '@/constants/device.constants';

type Tab = 'details' | 'polling' | 'wireless' | 'credentials';

const STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: 'Activo',
  COMMISSIONING: 'Comisionamiento',
  INVENTORY: 'Inventario',
  DAMAGED: 'Dañado',
};

const ONLINE_STATUS_LABELS: Record<PollingStatus | 'NOT_ACTIVATED', string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Fuera de línea',
  UNKNOWN: 'Monitoreo desconocido',
  NOT_ACTIVATED: 'No activado',
};

const TAB_LABELS: Record<Tab, string> = { details: 'Detalles', polling: 'Sondeo', wireless: 'Inalámbrico', credentials: 'Credenciales' };

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<DeviceResponseDTO | null>(null);
  const [deviceModel, setDeviceModel] = useState<DeviceModelResponseDTO | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<PollingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // The model decides whether wireless applies at all, so it is loaded before the
  // page renders — otherwise the wireless tab would flash in after the fact.
  const loadModel = useCallback(async (deviceModelId: string) => {
    const result = await apiService.getDeviceModel(deviceModelId);
    setDeviceModel(result.success && result.data ? result.data : null);
  }, []);

  const fetchDevice = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const [deviceResult, pollingResult] = await Promise.all([
      apiService.getDevice(deviceId),
      apiService.getPollingStatus(deviceId),
    ]);
    if (deviceResult.success && deviceResult.data) {
      setDevice(deviceResult.data);
      await loadModel(deviceResult.data.deviceModelId);
    } else {
      setError(deviceResult.error || 'Error al cargar el dispositivo');
    }
    if (pollingResult.success && pollingResult.data) {
      setOnlineStatus(pollingResult.data.currentStatus);
    }
    setIsLoading(false);
  }, [deviceId, loadModel]);

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  // Only WIRELESS_CPE and ACCESS_POINT can hold a wireless config, and only on a
  // model still flagged wireless — no config can be created once the flag is off,
  // so there is nothing for the tab to offer. A device left in a wireless category
  // under a non-wireless model is inert, not an error: it just loses the tab.
  const showWireless = isWirelessCategory(device?.category) && deviceModel?.isWireless === true;

  // Falls back to details if the wireless tab disappears while open — the model
  // can lose its wireless flag, or the device its category, mid-visit.
  const currentTab: Tab = activeTab === 'wireless' && !showWireless ? 'details' : activeTab;

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

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await apiService.deleteDevice(deviceId);
    setIsDeleting(false);
    if (result.success) {
      router.push('/devices');
    } else {
      setShowDeleteModal(false);
      setError(result.error || 'Error al eliminar el dispositivo');
    }
  };

  if (!device) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar dispositivo"
        message={`¿Estás seguro de que deseas eliminar "${device.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>← Atrás</Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere mb-2">{device.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
                {STATUS_LABELS[device.status] ?? device.status}
              </Badge>
              {device.category && (
                <Badge variant="info">{deviceCategoryLabel(device.category)}</Badge>
              )}
              {(() => {
                const key = !device.monitoringEnabled ? 'NOT_ACTIVATED' : (onlineStatus ?? 'UNKNOWN');
                const variant = key === 'NOT_ACTIVATED' ? 'neutral' : getPollingStatusBadgeVariant(key);
                return <Badge variant={variant}>{ONLINE_STATUS_LABELS[key]}</Badge>;
              })()}
            </div>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
          Eliminar
        </Button>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-6">
          {(['details', 'polling', ...(showWireless ? ['wireless' as Tab] : []), 'credentials'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                currentTab === tab
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </div>

      {currentTab === 'details' && (
        <DeviceDetailsTab
          device={device}
          onDeviceUpdated={(updated) => {
            setDevice(updated);
            if (updated.deviceModelId !== device.deviceModelId) loadModel(updated.deviceModelId);
          }}
        />
      )}

      {currentTab === 'polling' && (
        <DevicePollingTab deviceId={deviceId} deviceIpAddress={device.ipAddress} />
      )}

      {currentTab === 'wireless' && (
        <DeviceWirelessTab deviceId={deviceId} category={device.category} deviceIpAddress={device.ipAddress} />
      )}

      {currentTab === 'credentials' && (
        <DeviceCredentialsTab deviceId={deviceId} />
      )}
    </div>
  );
}
