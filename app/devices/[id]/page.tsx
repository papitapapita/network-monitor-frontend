'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { DeviceResponseDTO, DeviceStatus } from '@/types/device.types';
import { Button, Badge, LoadingSpinner, getDeviceStatusBadgeVariant } from '@/components/ui';
import { DeviceDetailsTab } from '@/components/devices/DeviceDetailsTab';
import { DevicePollingTab } from '@/components/devices/DevicePollingTab';

type Tab = 'details' | 'polling';

const STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: 'Activo',
  INVENTORY: 'Inventario',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED: 'Dañado',
  DECOMMISSIONED: 'Descomisionado',
};

const TAB_LABELS: Record<Tab, string> = { details: 'Detalles', polling: 'Sondeo' };

export default function DeviceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deviceId = params.id as string;

  const [device, setDevice] = useState<DeviceResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('details');

  const fetchDevice = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.getDevice(deviceId);
    if (result.success && result.data) {
      setDevice(result.data);
    } else {
      setError(result.error || 'Error al cargar el dispositivo');
    }
    setIsLoading(false);
  }, [deviceId]);

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()}>← Atrás</Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{device.name}</h1>
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
      </div>

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
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'details' && (
        <DeviceDetailsTab
          device={device}
          onDeviceUpdated={(updated) => setDevice(updated)}
        />
      )}

      {activeTab === 'polling' && (
        <DevicePollingTab deviceId={deviceId} />
      )}
    </div>
  );
}
