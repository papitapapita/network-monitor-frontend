'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { HARDWARE_CHANGES_QUERY_KEY } from '@/hooks/useHardwareChanges';
import { usePermissions } from '@/hooks/usePermissions';
import {
  DeviceModelResponseDTO,
  DeviceResponseDTO,
  ReplaceDeviceResultDTO,
  SwapHardwareResultDTO,
} from '@/types/device.types';
import { PollingStatus } from '@/types/polling.types';
import { Button, LoadingSpinner, Tooltip, IconButton, BackLink, TrashIcon, LocateIcon } from '@/components/ui';
import { ConfirmModal, UndoModal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/toast.context';
import { DeviceDetailsTab } from '@/components/devices/DeviceDetailsTab';
import { DeviceDownstreamCard } from '@/components/devices/DeviceDownstreamCard';
import { DevicePowerSourceCard } from '@/components/devices/DevicePowerSourceCard';
import { DeviceHealthCard } from '@/components/devices/DeviceHealthCard';
import { DevicePollingTab } from '@/components/devices/DevicePollingTab';
import { DeviceWirelessTab } from '@/components/devices/DeviceWirelessTab';
import type { ReplacePrefill } from '@/components/wireless/HardwareChangeCard';
import { DeviceCredentialsTab } from '@/components/devices/DeviceCredentialsTab';
import { DeviceHistoryTab } from '@/components/devices/DeviceHistoryTab';
import { DeviceBackupsTab } from '@/components/devices/DeviceBackupsTab';
import { DeviceNotificationPolicyTab } from '@/components/devices/DeviceNotificationPolicyTab';
import { DeviceNeighborsTab } from '@/components/devices/DeviceNeighborsTab';
import { DeviceNetworkLocationModal } from '@/components/devices/DeviceNetworkLocationModal';
import { isCompanyMikrotik } from '@/constants/port-speed.constants';
import { DeviceAlertThresholdsCard } from '@/components/wireless/DeviceAlertThresholdsCard';
import { ReplaceDeviceModal } from '@/components/devices/ReplaceDeviceModal';
import { SwapHardwareModal } from '@/components/devices/SwapHardwareModal';
import {
  DEVICE_STATUS_LABELS as STATUS_LABELS,
  RESTORE_GRACE_DAYS,
  RESTORE_SUCCESS_MESSAGE,
  isWirelessCategory,
} from '@/constants/device.constants';
import { isBackupTarget } from '@/constants/backup.constants';
import { useGoBack } from '@/hooks/useGoBack';
import { useInstallation } from '@/hooks/useInstallation';
import { agentPollFailure } from '@/constants/agent.constants';
import { wirelessReadingLines } from '@/constants/wireless.constants';
import { LINK_DIAGNOSIS_ANCHOR } from '@/components/wireless/LinkDiagnosisCard';
import { translateStartError } from '@/hooks/useLinkDiagnosis';

type Tab = 'details' | 'history' | 'polling' | 'wireless' | 'neighbors' | 'settings' | 'backups';

const TAB_LABELS: Record<Tab, string> = {
  details: 'Detalles',
  history: 'Historial',
  polling: 'Sondeo',
  wireless: 'Inalámbrico',
  neighbors: 'Vecinos',
  settings: 'Configuración',
  backups: 'Respaldos',
};

function SwapIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function SwapVerticalIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function PollIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function WirelessPollIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  );
}

function DiagnosisIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 17l6-6-6-6m8 14h8" />
    </svg>
  );
}

const isTab = (value: string | null): value is Tab => !!value && value in TAB_LABELS;

/**
 * The device's live connectivity in one glance, replacing three status badges
 * that already restate what the Detalles tab shows. Only "online" breathes —
 * a plain CSS ping ring, no timers — since a static color is enough to say
 * "down" or "not being watched" without drawing the eye every second.
 */
function ConnectivityDot({ device, onlineStatus }: { device: DeviceResponseDTO; onlineStatus: PollingStatus | null }) {
  const state = !device.monitoringEnabled
    ? 'off'
    : onlineStatus === 'ONLINE'
      ? 'online'
      : onlineStatus === 'OFFLINE'
        ? 'offline'
        : 'unknown';

  const label =
    state === 'off'
      ? 'No monitoreado'
      : state === 'online'
        ? 'En línea'
        : state === 'offline'
          ? 'Fuera de línea'
          : 'Monitoreo desconocido';

  const dotClass = state === 'online' ? 'bg-green-500' : state === 'offline' ? 'bg-red-500' : 'bg-gray-400 dark:bg-gray-500';

  return (
    <Tooltip label={label} side="bottom">
      <span className="relative inline-flex h-3 w-3 shrink-0" aria-label={label}>
        {state === 'online' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        )}
        <span className={`relative inline-flex h-3 w-3 rounded-full ${dotClass}`} />
      </span>
    </Tooltip>
  );
}

export default function DeviceDetailPage() {
  const router = useRouter();
  const goBack = useGoBack('/devices');
  const params = useParams();
  const deviceId = params.id as string;
  // The open tab lives in `?tab=`, so another page (the hardware swap banner)
  // can link straight to one, and the browser's back button steps back
  // through the tabs before it leaves the page.
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Deleting takes ADMIN, and so does undoing it — restoring is the inverse of
  // deleting, so the same authority governs both. Replacing hardware is an
  // `activate` operation, which an operator also holds.
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const canDelete = permissions.isAdmin;
  const canReplace = permissions.canWrite;

  const [device, setDevice] = useState<DeviceResponseDTO | null>(null);
  const [deviceModel, setDeviceModel] = useState<DeviceModelResponseDTO | null>(null);
  const [onlineStatus, setOnlineStatus] = useState<PollingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showError, showSuccess } = useToast();
  const { serverOnSite } = useInstallation();
  const [isPolling, setIsPolling] = useState(false);
  const [isWirelessPolling, setIsWirelessPolling] = useState(false);
  const [isStartingDiagnosis, setIsStartingDiagnosis] = useState(false);
  // Bumped after a quick poll so the open tab remounts and reads the new data.
  const [pollRefreshKey, setPollRefreshKey] = useState(0);
  const tabParam = searchParams.get('tab');
  const activeTab: Tab = isTab(tabParam) ? tabParam : 'details';
  const setActiveTab = useCallback(
    (tab: Tab) => {
      if (tab === activeTab) return;
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'details') params.delete('tab');
      else params.set('tab', tab);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [activeTab, searchParams, pathname, router],
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceResult, setReplaceResult] = useState<ReplaceDeviceResultDTO | null>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapResult, setSwapResult] = useState<SwapHardwareResultDTO | null>(null);
  // A hardware-change suggestion on the wireless tab opens the same two modals
  // pre-filled with what the radio reported. Both read it once on mount, so
  // every opening remounts them with a fresh key.
  const [replacePrefill, setReplacePrefill] = useState<ReplacePrefill>();
  const [swapWithId, setSwapWithId] = useState<string>();
  const [hardwareModalKey, setHardwareModalKey] = useState(0);
  const openReplaceModal = (prefill?: ReplacePrefill) => {
    setReplacePrefill(prefill);
    setHardwareModalKey((k) => k + 1);
    setShowReplaceModal(true);
  };
  const openSwapModal = (otherId?: string) => {
    setSwapWithId(otherId);
    setHardwareModalKey((k) => k + 1);
    setShowSwapModal(true);
  };

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

  // Quick polls from the header: the same as «Sondear ahora» on the Sondeo and
  // Inalámbrico tabs, with the outcome as a toast.
  const handleQuickPoll = async () => {
    setIsPolling(true);
    const result = await apiService.triggerPoll(deviceId);
    setIsPolling(false);
    if (result.success && result.data) {
      const r = result.data;
      setOnlineStatus(r.deviceStatus);
      setPollRefreshKey((k) => k + 1);
      if (r.status === 'SUCCESS') showSuccess(`Sondeo exitoso${r.metrics ? ` (${r.metrics.latencyMs} ms)` : ''}.`);
      else if (r.status === 'SKIPPED') showError('Sondeo omitido: el monitoreo está deshabilitado.');
      else showError(`Sondeo fallido: ${r.message}`);
    } else if (result.status === 409) {
      showError(result.error?.includes('is not polled')
        ? 'El estado de este dispositivo no admite sondeo (está fuera de servicio).'
        : 'El monitoreo está deshabilitado para este dispositivo; habilítelo antes de sondearlo.');
    } else {
      showError(agentPollFailure(result.status, result.error) ?? result.error ?? 'Error en el sondeo');
    }
  };

  const handleQuickWirelessPoll = async () => {
    setIsWirelessPolling(true);
    const result = await apiService.triggerWirelessPoll(deviceId);
    if (result.success && result.data) {
      const r = result.data;
      setPollRefreshKey((k) => k + 1);
      if (r.skipped) {
        showError('Sondeo inalámbrico omitido: el monitoreo está deshabilitado.');
      } else if (!r.metricsCollected) {
        showError('Sondeo inalámbrico completado, pero el equipo no devolvió métricas.');
      } else {
        // The poll answers only with alert counts; the readings themselves are
        // in the snapshot it just wrote, so show those without a trip to the tab.
        const status = await apiService.getWirelessStatus(deviceId);
        const details = status.success && status.data ? wirelessReadingLines(status.data) : [];
        if (r.alertsTriggered || r.alertsCleared) {
          details.push(`Alertas nuevas: ${r.alertsTriggered} · resueltas: ${r.alertsCleared}`);
        }
        showSuccess('Sondeo inalámbrico completado', { details, duration: 10000 });
      }
    } else {
      showError(agentPollFailure(result.status, result.error) ?? result.error ?? 'Error al sondear el equipo');
    }
    setIsWirelessPolling(false);
  };

  // Starts (or joins) a one-minute live diagnosis and opens the wireless tab
  // on its card, which picks the running session up and streams it.
  const handleQuickDiagnosis = async () => {
    setIsStartingDiagnosis(true);
    const result = await apiService.startLinkDiagnosis(deviceId, 60);
    setIsStartingDiagnosis(false);
    if (!result.success || !result.data) {
      showError(translateStartError(result.status, result.error));
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'wireless');
    router.push(`${pathname}?${params}#${LINK_DIAGNOSIS_ANCHOR}`, { scroll: false });
    // Already on the tab: remount the card so it joins the new session.
    setPollRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  // Only WIRELESS_CPE and ACCESS_POINT can hold a wireless config, and only on a
  // model still flagged wireless — no config can be created once the flag is off,
  // so there is nothing for the tab to offer. A device left in a wireless category
  // under a non-wireless model is inert, not an error: it just loses the tab.
  const showWireless = isWirelessCategory(device?.category) && deviceModel?.isWireless === true;

  // Only the company's antennas, routerboards and switches are backed up (BKP-010).
  const showBackups = isBackupTarget(device?.ownerType, device?.category, deviceModel?.deviceType);

  // A company MikroTik's ports say what they hear (DEV-198).
  const showNeighbors = isCompanyMikrotik(device, deviceModel);

  const canQuickPoll =
    permissions.canWrite && !!device?.ipAddress && !!device.monitoringEnabled && (serverOnSite || device.agentId !== null);

  // Falls back to details if the wireless or backups tab disappears while open —
  // the model can lose its wireless flag, or the device its category, mid-visit.
  const currentTab: Tab =
    (activeTab === 'wireless' && !showWireless) ||
    (activeTab === 'backups' && !showBackups) ||
    (activeTab === 'neighbors' && !showNeighbors)
      ? 'details'
      : activeTab;

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
      const message = result.error || 'Error al eliminar el dispositivo';
      setError(message);
      showError(message);
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
      const message = result.error || 'Error al restaurar el dispositivo';
      setError(message);
      showError(message);
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
            <Button variant="outline" onClick={() => goBack()}>Volver</Button>
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
        key={`replace-${hardwareModalKey}`}
        isOpen={showReplaceModal}
        onClose={() => setShowReplaceModal(false)}
        device={device}
        prefill={replacePrefill}
        onReplaced={(result) => {
          setShowReplaceModal(false);
          setReplaceResult(result);
          // This page is now the retired unit: it lost its IP and its status
          // changed, so take the record the call handed back.
          setDevice(result.retiredDevice);
          setOnlineStatus(null);
          queryClient.invalidateQueries({ queryKey: HARDWARE_CHANGES_QUERY_KEY });
        }}
      />

      <SwapHardwareModal
        key={`swap-${hardwareModalKey}`}
        isOpen={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        device={device}
        initialOtherId={swapWithId}
        onSwapped={(result) => {
          setShowSwapModal(false);
          setSwapResult(result);
          // Same record, different box: the model decides the wireless tab.
          setDevice(result.device);
          loadModel(result.device.deviceModelId);
          queryClient.invalidateQueries({ queryKey: HARDWARE_CHANGES_QUERY_KEY });
        }}
      />

      <DeviceNetworkLocationModal
        deviceId={device.id}
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
      />

      {/* Header */}
      <div className="mb-6">
        <BackLink onClick={() => goBack()} className="mb-2" />
        <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-col sm:items-start sm:justify-start">
          <div className="flex items-center gap-3 min-w-0">
            <ConnectivityDot device={device} onlineStatus={onlineStatus} />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere min-w-0">
              {device.name}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-end sm:justify-start">
            {/* Off site, only a device behind an agent can be polled on demand. */}
            {canQuickPoll && (
              <IconButton icon={<PollIcon />} label="Sondeo rápido" onClick={handleQuickPoll} isLoading={isPolling} />
            )}
            {canQuickPoll && showWireless && (
              <IconButton
                icon={<WirelessPollIcon />}
                label="Sondeo inalámbrico rápido"
                onClick={handleQuickWirelessPoll}
                isLoading={isWirelessPolling}
              />
            )}
            {canQuickPoll && showWireless && (
              <IconButton
                icon={<DiagnosisIcon />}
                label="Diagnóstico en vivo"
                onClick={handleQuickDiagnosis}
                isLoading={isStartingDiagnosis}
              />
            )}
            {/* The ping tool, from where this device is polled. */}
            {permissions.canWrite && device.ipAddress && (
              <IconButton
                icon={<TerminalIcon />}
                label="Hacer ping"
                onClick={() => {
                  const qs = new URLSearchParams({ ip: device.ipAddress! });
                  if (device.agentId) qs.set('agentId', device.agentId);
                  router.push(`/ping?${qs}`);
                }}
              />
            )}
            {/* Which router port it sits behind, from the MikroTiks' bridge tables (DEV-199). */}
            {!device.deletedAt && (
              <IconButton icon={<LocateIcon />} label="¿Dónde está conectado?" onClick={() => setShowLocationModal(true)} />
            )}
            {/* A unit can only be swapped once — after that the successor is the
                one to replace, and its page offers the button. */}
            {canReplace && !device.replacedByDeviceId && (
              <IconButton icon={<SwapIcon />} label="Reemplazar equipo" onClick={() => openReplaceModal()} />
            )}
            {/* The backend refuses a swap on a retired unit that was already
                replaced — the same condition that hides «Reemplazar». */}
            {canReplace && !device.replacedByDeviceId && (
              <IconButton
                icon={<SwapVerticalIcon />}
                label="Intercambiar hardware con otro equipo"
                onClick={() => openSwapModal()}
              />
            )}
            {canDelete && (
              <IconButton icon={<TrashIcon />} label="Eliminar dispositivo" variant="danger" onClick={() => setShowDeleteModal(true)} />
            )}
          </div>
        </div>
      </div>

      {/* What the swap moved — wireless first, since nothing re-creates a config. */}
      {replaceResult && (
        <div className="mb-6 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-900 dark:text-brand-300">
                Equipo reemplazado
              </p>
              <p className="mt-1 text-sm text-brand-800 dark:text-brand-400">
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
              <ul className="mt-2 text-sm text-brand-800 dark:text-brand-400 list-disc list-inside space-y-0.5">
                {replaceResult.credentialsTransferred && <li>Se trasladaron las credenciales.</li>}
                {replaceResult.contractedServiceTransferred && (
                  <li>El servicio contratado del cliente ahora apunta al equipo nuevo.</li>
                )}
                {replaceResult.downstreamDevicesMoved > 0 && (
                  <li>
                    {replaceResult.downstreamDevicesMoved === 1
                      ? 'El equipo que dependía de esta unidad ahora depende del nuevo.'
                      : `Los ${replaceResult.downstreamDevicesMoved} equipos que dependían de esta unidad ahora dependen del nuevo.`}
                  </li>
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
              className="text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 shrink-0"
            >
              <span className="sr-only">Descartar</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* The capacity figures were set for the antenna that used to be there,
          and the swap does not touch them — so ask for a review on both sides. */}
      {swapResult && (
        <div className="mb-6 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-900 dark:text-brand-300">Hardware intercambiado</p>
              <p className="mt-1 text-sm text-brand-800 dark:text-brand-400">
                Este registro ahora describe el equipo que estaba en «{swapResult.otherDevice.name}», y
                ese registro describe el que estaba aquí. Cada sitio conserva su IP, ubicación e historial.
              </p>
              {(isWirelessCategory(swapResult.device.category) ||
                isWirelessCategory(swapResult.otherDevice.category)) && (
                <>
                  <p className="mt-2 text-sm font-medium text-yellow-800 dark:text-yellow-400">
                    Revisa la capacidad de enlace y el límite de clientes de ambos equipos: se fijaron
                    para la antena anterior y el intercambio no los cambia.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {showWireless && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('wireless')}
                        className="font-medium text-brand-700 dark:text-brand-300 underline"
                      >
                        Revisar este equipo
                      </button>
                    )}
                    {isWirelessCategory(swapResult.otherDevice.category) && (
                      <Link
                        href={`/devices/${swapResult.otherDevice.id}?tab=wireless`}
                        className="font-medium text-brand-700 dark:text-brand-300 underline"
                      >
                        Revisar «{swapResult.otherDevice.name}»
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSwapResult(null)}
              className="text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 shrink-0"
            >
              <span className="sr-only">Descartar</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
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

      {/* Tab bar — scrolls within itself on a narrow screen instead of
          stretching the page, same as the table's own horizontal scroll. */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto table-scroll-x">
        <nav className="flex gap-6 w-max min-w-full">
          {([
            'details',
            'history',
            'polling',
            ...(showWireless ? ['wireless' as Tab] : []),
            ...(showNeighbors ? ['neighbors' as Tab] : []),
            'settings',
            ...(showBackups ? ['backups' as Tab] : []),
          ] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 pb-3 text-sm font-medium border-b-2 transition-colors ${
                currentTab === tab
                  ? 'border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </div>

      {/* How the device is doing comes first; what it is, below. */}
      {currentTab === 'details' && (
        <div className="space-y-6">
          <DeviceHealthCard key={pollRefreshKey} device={device} showWireless={showWireless} onOpenTab={setActiveTab} />
          <DeviceDownstreamCard deviceId={device.id} />
          <DevicePowerSourceCard deviceId={device.id} locationId={device.locationId} />
          <DeviceDetailsTab
            device={device}
            onDeviceUpdated={(updated) => {
              setDevice(updated);
              if (updated.deviceModelId !== device.deviceModelId) loadModel(updated.deviceModelId);
            }}
          />
        </div>
      )}

      {currentTab === 'history' && (
        <DeviceHistoryTab key={pollRefreshKey} device={device} />
      )}

      {currentTab === 'polling' && (
        <DevicePollingTab key={pollRefreshKey} device={device} onDeviceUpdated={setDevice} />
      )}

      {currentTab === 'wireless' && (
        <DeviceWirelessTab
          key={pollRefreshKey}
          deviceId={deviceId}
          category={device.category}
          deviceIpAddress={device.ipAddress}
          vendorSlug={deviceModel?.vendorSlug ?? null}
          deviceAgentId={device.agentId}
          deviceStatus={device.status}
          deviceDeletedAt={device.deletedAt}
          deviceReplacedAt={device.replacedAt}
          onDeviceUpdated={(updated) => {
            setDevice(updated);
            // Accepting a reported model on an INVENTORY unit changes it.
            if (updated.deviceModelId !== device.deviceModelId) loadModel(updated.deviceModelId);
          }}
          onReplaceHardware={canReplace && !device.replacedByDeviceId ? openReplaceModal : undefined}
          onSwapHardware={canReplace && !device.replacedByDeviceId ? openSwapModal : undefined}
        />
      )}

      {currentTab === 'neighbors' && <DeviceNeighborsTab key={pollRefreshKey} deviceId={deviceId} />}

      {/* Set-once settings that rarely change: quiet hours, a radio's alert
          thresholds, then the logins polling and backups use. Off Detalles so secrets never load on the
          tab every visit opens. */}
      {currentTab === 'settings' && (
        <div className="space-y-6">
          <DeviceNotificationPolicyTab deviceId={deviceId} />
          {showWireless && <DeviceAlertThresholdsCard deviceId={deviceId} canWrite={permissions.canWrite} />}
          <DeviceCredentialsTab deviceId={deviceId} vendorSlug={deviceModel?.vendorSlug ?? null} />
        </div>
      )}

      {currentTab === 'backups' && (
        <DeviceBackupsTab device={device} />
      )}
    </div>
  );
}
