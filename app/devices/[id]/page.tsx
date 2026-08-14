'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import {
  DeviceModelResponseDTO,
  DeviceResponseDTO,
  ReplaceDeviceResultDTO,
} from '@/types/device.types';
import { PollingStatus } from '@/types/polling.types';
import { Button, Badge, LoadingSpinner, getDeviceStatusBadgeVariant, getPollingStatusBadgeVariant } from '@/components/ui';
import { ConfirmModal, UndoModal } from '@/components/ui/Modal';
import { DeviceDetailsTab } from '@/components/devices/DeviceDetailsTab';
import { DevicePollingTab } from '@/components/devices/DevicePollingTab';
import { DeviceWirelessTab } from '@/components/devices/DeviceWirelessTab';
import { DeviceCredentialsTab } from '@/components/devices/DeviceCredentialsTab';
import { ReplaceDeviceModal } from '@/components/devices/ReplaceDeviceModal';
import {
  DEVICE_STATUS_LABELS as STATUS_LABELS,
  RESTORE_GRACE_DAYS,
  RESTORE_SUCCESS_MESSAGE,
  deviceCategoryLabel,
  isWirelessCategory,
} from '@/constants/device.constants';

type Tab = 'details' | 'polling' | 'wireless' | 'credentials';

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

  // Deleting takes ADMIN, and so does undoing it — restoring is the inverse of
  // deleting, so the same authority governs both. Replacing hardware is an
  // `activate` operation, which an operator also holds.
  const { user } = useAuth();
  const canDelete = user?.role === 'ADMIN';
  const canReplace = user?.role === 'ADMIN' || user?.role === 'OPERATOR';

  const [device, setDevice] = useState<DeviceResponseDTO | null>(null);
  const [deviceModel, setDeviceModel] = useState<DeviceModelResponseDTO | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<PollingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceResult, setReplaceResult] = useState<ReplaceDeviceResultDTO | null>(null);

  /**
   * Set once the delete lands. The device is gone from every read path, so the
   * page cannot show it any more — but it holds the id the restore endpoint
   * needs, which is the cheapest undo there is.
   */
  const [deletedDevice, setDeletedDevice] = useState<DeviceResponseDTO | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

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

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await apiService.deleteDevice(deviceId);
    setIsDeleting(false);
    setShowDeleteModal(false);
    if (result.success && device) {
      setDeletedDevice(device);
      setError(null);
    } else {
      // A live contracted service or an open ticket blocks the delete. Neither
      // is fixable here, so the message stays on the page rather than in a
      // dialog the operator is about to close.
      setError(result.error || 'Error al eliminar el dispositivo');
    }
  };

  const handleRestore = async () => {
    if (!deletedDevice) return;
    setIsRestoring(true);
    const result = await apiService.restoreDevice(deletedDevice.id);
    setIsRestoring(false);
    if (result.success) {
      setDeletedDevice(null);
      // It comes back with monitoring off whatever it had before, so say so
      // instead of letting them find it later on a grey status pill.
      setRestoreNotice(RESTORE_SUCCESS_MESSAGE);
      await fetchDevice();
    } else {
      setError(result.error || 'Error al restaurar el dispositivo');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Cargando dispositivo..." />
      </div>
    );
  }

  // The device is out of every listing now, so the page behind has nothing left
  // to show — this stands in its place until the operator undoes the delete or
  // leaves. Closing it goes to the listing rather than back to a page whose
  // device no longer exists. The grace period and the freed IP are the bin's
  // story to tell; here they would only bury the one button that matters.
  if (deletedDevice) {
    return (
      <UndoModal
        isOpen
        onClose={() => router.push('/devices')}
        onUndo={handleRestore}
        title="Dispositivo eliminado"
        message={`«${deletedDevice.name}» se eliminó.`}
        canUndo={canDelete}
        isUndoing={isRestoring}
        error={error}
      />
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
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar dispositivo"
        message={`¿Estás seguro de que deseas eliminar "${device.name}"? Saldrá de todos los listados y dejará de monitorearse, pero podrás restaurarlo durante ${RESTORE_GRACE_DAYS} días desde la papelera.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      <ReplaceDeviceModal
        isOpen={showReplaceModal}
        onClose={() => setShowReplaceModal(false)}
        device={device}
        onReplaced={(result) => {
          setShowReplaceModal(false);
          setReplaceResult(result);
          // This page is now the retired unit: it lost its IP and its status
          // changed, so take the record the call handed back.
          setDevice(result.retiredDevice);
          setOnlineStatus(null);
        }}
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
        <div className="flex flex-wrap gap-2 justify-end">
          {/* A unit can only be swapped once — after that the successor is the
              one to replace, and its page offers the button. */}
          {canReplace && !device.replacedByDeviceId && (
            <Button variant="outline" size="sm" onClick={() => setShowReplaceModal(true)}>
              Reemplazar equipo
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* What the swap moved — wireless first, since nothing re-creates a config. */}
      {replaceResult && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Equipo reemplazado
              </p>
              <p className="mt-1 text-sm text-blue-800 dark:text-blue-400">
                Esta unidad quedó en «{STATUS_LABELS[replaceResult.retiredDevice.status] ?? replaceResult.retiredDevice.status}»
                y conserva todo su historial.{' '}
                <Link
                  href={`/devices/${replaceResult.newDevice.id}`}
                  className="font-medium underline"
                >
                  Ir al equipo nuevo «{replaceResult.newDevice.name}»
                </Link>
                .
              </p>
              <ul className="mt-2 text-sm text-blue-800 dark:text-blue-400 list-disc list-inside space-y-0.5">
                {replaceResult.credentialsTransferred && <li>Se trasladaron las credenciales.</li>}
                {replaceResult.contractedServiceTransferred && (
                  <li>El servicio contratado del cliente ahora apunta al equipo nuevo.</li>
                )}
              </ul>
              {replaceResult.wirelessConfigRemoved && (
                <p className="mt-2 text-sm font-medium text-yellow-800 dark:text-yellow-400">
                  Se eliminó la configuración inalámbrica porque el modelo nuevo no tiene radio:
                  el monitoreo inalámbrico de este sitio se detuvo y nada lo vuelve a crear.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setReplaceResult(null)}
              className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 shrink-0"
            >
              <span className="sr-only">Descartar</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Lineage. Makes "this CPE, current box since March" answerable. */}
      {(device.replacesDeviceId || device.replacedByDeviceId) && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
          {device.replacesDeviceId && (
            <span>
              Sustituyó a{' '}
              <Link
                href={`/devices/${device.replacesDeviceId}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                la unidad anterior
              </Link>
              {device.replacedAt && ` el ${new Date(device.replacedAt).toLocaleDateString('es')}`}
            </span>
          )}
          {device.replacedByDeviceId && (
            <span>
              Esta unidad fue reemplazada por{' '}
              <Link
                href={`/devices/${device.replacedByDeviceId}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                el equipo actual
              </Link>
            </span>
          )}
        </div>
      )}

      {restoreNotice && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-green-800 dark:text-green-400">{restoreNotice}</p>
            <button
              type="button"
              onClick={() => setRestoreNotice(null)}
              className="text-green-500 hover:text-green-700 dark:hover:text-green-300 shrink-0"
            >
              <span className="sr-only">Descartar</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

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
        <DevicePollingTab device={device} onDeviceUpdated={setDevice} />
      )}

      {currentTab === 'wireless' && (
        <DeviceWirelessTab
          deviceId={deviceId}
          category={device.category}
          deviceIpAddress={device.ipAddress}
          deviceStatus={device.status}
          deviceDeletedAt={device.deletedAt}
          deviceReplacedAt={device.replacedAt}
        />
      )}

      {currentTab === 'credentials' && (
        <DeviceCredentialsTab deviceId={deviceId} />
      )}
    </div>
  );
}
