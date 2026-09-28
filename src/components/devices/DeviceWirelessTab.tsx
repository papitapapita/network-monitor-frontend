'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api.service';
import {
  WirelessConfigDTO,
  WirelessStatusDTO,
  WirelessAlertDTO,
  WirelessClientDTO,
  WirelessDeviceType,
  CreateWirelessConfigDTO,
  WirelessExpectedClientsResponse,
  WirelessIdentitySuggestion,
} from '@/types/wireless.types';
import { DeviceCategory, DeviceStatus, DeviceResponseDTO } from '@/types/device.types';
import { Card, Input, Select, LoadingSpinner, Badge, ConfirmModal, IconButton, EditFormActions, EditToggleButton, SectionTitle } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { useAuth } from '@/contexts/auth.context';
import {
  WIRELESS_INTERVAL_MIN_SECONDS,
  INTERVAL_MAX_SECONDS,
  validateIntervalSeconds,
} from '@/constants/polling.constants';
import {
  fmtBps,
  fmtKbps,
  canEnableWirelessPolling,
  wirelessEnableBlockedReason,
  WIRELESS_DISABLED_BY_STATUS_NOTE,
  WIRELESS_INDEPENDENT_OF_ICMP_NOTE,
  lanSpeedOptions,
  isValidLanSpeed,
  wirelessCollectorFor,
  COLLECTION_METHOD_LABELS,
} from '@/constants/wireless.constants';
import { WirelessThroughputCard } from '@/components/wireless/WirelessThroughputCard';
import { LinkDiagnosisCard } from '@/components/wireless/LinkDiagnosisCard';

function CloseIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function PollIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

interface Props {
  deviceId: string;
  category: DeviceCategory | null;
  deviceIpAddress: string | null;
  /**
   * Of the device's model. Picks how the backend polls the radio — and so
   * which credentials it needs — or whether it can at all. Null while unknown.
   */
  vendorSlug: string | null;
  /**
   * The backend owns `enabled` too — a move to a retired status turns polling
   * off, a move to COMMISSIONING turns it back on — so the tab re-reads the
   * config whenever the status changes rather than trusting its last write.
   */
  deviceStatus: DeviceStatus;
  deviceDeletedAt: string | null;
  deviceReplacedAt: string | null;
  /** Called after an identity suggestion is accepted and the device record changes underneath the caller. */
  onDeviceUpdated: (device: DeviceResponseDTO) => void;
}

function fmt(val: number | null | undefined, unit: string, decimals = 1): string {
  if (val == null) return '—';
  return `${val.toFixed(decimals)} ${unit}`;
}

function fmtBytes(val: string | null): string {
  if (val === null) return '—';
  const n = parseInt(val, 10);
  if (isNaN(n)) return val;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} GB`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} KB`;
  return `${n} B`;
}

function fmtRam(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1_024).toFixed(0)} KB`;
}

function fmtDistance(meters: number | null): string {
  if (meters === null) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters} m`;
}

function fmtUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function signalBadgeVariant(dbm: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (dbm === null) return 'neutral';
  if (dbm >= -65) return 'success';
  if (dbm >= -75) return 'warning';
  return 'danger';
}

function linkScoreBadgeVariant(score: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (score === null) return 'neutral';
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}

function alertSeverityVariant(severity: string): 'warning' | 'danger' {
  return severity === 'CRITICAL' ? 'danger' : 'warning';
}

// The backend derives the radio mode from the device's category and returns it
// on the config; this mirrors that rule so the form can be laid out before the
// config exists.
function inferDeviceType(category: DeviceCategory | null): WirelessDeviceType {
  return category === 'ACCESS_POINT' ? 'ACCESS_POINT' : 'STATION';
}

// A rebooted AirOS antenna stays offline ~1–2 min; polls fail meanwhile, so we
// mute the "no snapshot" errors for this long instead of showing them as faults.
const REBOOT_WINDOW_MS = 120_000;

function ClientRow({ client }: { client: WirelessClientDTO }) {
  const [expanded, setExpanded] = useState(false);

  const displayName = client.remoteHostname || client.macAddress;
  const displaySub = client.remoteHostname ? client.macAddress : null;

  return (
    <>
      <tr
        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* CPE identity */}
        <td className="py-2 pr-3">
          <div className="font-mono text-xs font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
          {displaySub && (
            <div className="font-mono text-xs text-gray-400 dark:text-gray-500">{displaySub}</div>
          )}
          {client.remotePlatform && (
            <div className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[140px]">{client.remotePlatform}</div>
          )}
        </td>
        {/* IP */}
        <td className="py-2 pr-3">
          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
            {client.ipAddress ?? '—'}
          </span>
        </td>
        {/* Signal AP receives from CPE */}
        <td className="py-2 pr-3">
          {client.signalRxDbm !== null ? (
            <Badge variant={signalBadgeVariant(client.signalRxDbm)}>
              {client.signalRxDbm} dBm
            </Badge>
          ) : <span className="text-gray-400">—</span>}
        </td>
        {/* Signal CPE receives from AP */}
        <td className="py-2 pr-3">
          {client.remoteSignal !== null ? (
            <Badge variant={signalBadgeVariant(client.remoteSignal)}>
              {client.remoteSignal} dBm
            </Badge>
          ) : <span className="text-gray-400">—</span>}
        </td>
        {/* Distance */}
        <td className="py-2 pr-3 text-sm text-gray-900 dark:text-gray-100">
          {fmtDistance(client.distanceM)}
        </td>
        {/* DL / UL Score */}
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1">
            {client.dlLinkScore !== null ? (
              <Badge variant={linkScoreBadgeVariant(client.dlLinkScore)} className="text-xs">
                ↓{client.dlLinkScore}
              </Badge>
            ) : <span className="text-gray-400 text-xs">—</span>}
            {client.ulLinkScore !== null ? (
              <Badge variant={linkScoreBadgeVariant(client.ulLinkScore)} className="text-xs">
                ↑{client.ulLinkScore}
              </Badge>
            ) : <span className="text-gray-400 text-xs">—</span>}
          </div>
        </td>
        {/* Uptime */}
        <td className="py-2 pr-3 text-sm text-gray-900 dark:text-gray-100">
          {fmtUptime(client.uptimeSeconds)}
        </td>
        {/* Expand toggle */}
        <td className="py-2 text-right">
          <span className="text-gray-400 dark:text-gray-500 text-xs select-none">
            {expanded ? '▲' : '▼'}
          </span>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700">
          <td colSpan={8} className="px-3 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-xs">
              {/* RF */}
              <div>
                <div className="text-gray-400 dark:text-gray-500 font-medium mb-1 uppercase tracking-wide">RF</div>
                <div className="space-y-1">
                  <div><span className="text-gray-500 dark:text-gray-400">Piso ruido CPE:</span> <span className="text-gray-900 dark:text-gray-100">{fmt(client.remoteNoiseFloor, 'dBm', 0)}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Piso ruido AP:</span> <span className="text-gray-900 dark:text-gray-100">{fmt(client.noiseFloorDbm, 'dBm', 0)}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Potencia TX CPE:</span> <span className="text-gray-900 dark:text-gray-100">{fmt(client.remoteTxPower, 'dBm', 0)}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">CINR DL / UL:</span> <span className="text-gray-900 dark:text-gray-100">{fmt(client.dlCinr, 'dB', 1)} / {fmt(client.ulCinr, 'dB', 1)}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Latencia TX:</span> <span className="text-gray-900 dark:text-gray-100">{client.txLatencyMs !== null ? `${client.txLatencyMs} ms` : '—'}</span></div>
                </div>
              </div>
              {/* Capacidad y throughput */}
              <div>
                <div className="text-gray-400 dark:text-gray-500 font-medium mb-1 uppercase tracking-wide">Capacidad</div>
                <div className="space-y-1">
                  <div><span className="text-gray-500 dark:text-gray-400">Cap. DL:</span> <span className="text-gray-900 dark:text-gray-100">{fmtKbps(client.dlCapacityKbps)}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Cap. UL:</span> <span className="text-gray-900 dark:text-gray-100">{fmtKbps(client.ulCapacityKbps)}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Throughput TX:</span> <span className="text-gray-900 dark:text-gray-100">{fmtKbps(client.remoteTxThroughputKbps)}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Throughput RX:</span> <span className="text-gray-900 dark:text-gray-100">{fmtKbps(client.remoteRxThroughputKbps)}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">PPS TX / RX:</span> <span className="text-gray-900 dark:text-gray-100">{client.txPps ?? '—'} / {client.rxPps ?? '—'}</span></div>
                </div>
              </div>
              {/* Tráfico acumulado */}
              <div>
                <div className="text-gray-400 dark:text-gray-500 font-medium mb-1 uppercase tracking-wide">Tráfico total</div>
                <div className="space-y-1">
                  <div><span className="text-gray-500 dark:text-gray-400">Enviado:</span> <span className="text-gray-900 dark:text-gray-100">{fmtBytes(client.txBytesTotal)}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">Recibido:</span> <span className="text-gray-900 dark:text-gray-100">{fmtBytes(client.rxBytesTotal)}</span></div>
                </div>
              </div>
              {/* CPE remoto */}
              <div>
                <div className="text-gray-400 dark:text-gray-500 font-medium mb-1 uppercase tracking-wide">CPE remoto</div>
                <div className="space-y-1">
                  <div><span className="text-gray-500 dark:text-gray-400">Firmware:</span> <span className="text-gray-900 dark:text-gray-100">{client.remoteVersion ?? '—'}</span></div>
                  <div><span className="text-gray-500 dark:text-gray-400">CPU:</span> <span className="text-gray-900 dark:text-gray-100">{fmt(client.remoteCpuLoad, '%', 0)}</span></div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">RAM:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">
                      {client.remoteTotalRam !== null && client.remoteFreeRam !== null
                        ? `${fmtRam(client.remoteFreeRam)} libre / ${fmtRam(client.remoteTotalRam)}`
                        : '—'}
                    </span>
                  </div>
                  {client.remoteIpAddresses.length > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">IPs:</span>{' '}
                      <span className="font-mono text-gray-900 dark:text-gray-100">
                        {client.remoteIpAddresses.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function validateWirelessConfigForm(form: { intervalSecs: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  const interval = validateIntervalSeconds(form.intervalSecs, {
    min: WIRELESS_INTERVAL_MIN_SECONDS,
    max: INTERVAL_MAX_SECONDS,
  });
  if (interval) errors.intervalSecs = interval;
  return errors;
}

export function DeviceWirelessTab({
  deviceId,
  category,
  deviceIpAddress,
  vendorSlug,
  deviceStatus,
  deviceDeletedAt,
  deviceReplacedAt,
  onDeviceUpdated,
}: Props) {
  const { user } = useAuth();
  const [config, setConfig] = useState<WirelessConfigDTO | null>(null);
  const [noConfig, setNoConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const { showError, showFormErrors } = useToast();

  const [status, setStatus] = useState<WirelessStatusDTO | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<WirelessAlertDTO[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [alertsNotice, setAlertsNotice] = useState<string | null>(null);
  /** Which row's clear is in flight; also blocks the other buttons while it runs. */
  const [clearingAlertId, setClearingAlertId] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState<string | null>(null);

  // Polling and reboot log in with the device credentials — the tab loads
  // their presence only to gate the buttons.
  const [hasHttpCreds, setHasHttpCreds] = useState<boolean | null>(null);
  const [hasSnmpCreds, setHasSnmpCreds] = useState<boolean | null>(null);
  const [showRebootModal, setShowRebootModal] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [rebootError, setRebootError] = useState<string | null>(null);
  const [rebootingUntil, setRebootingUntil] = useState<number | null>(null);

  const [configForm, setConfigForm] = useState({
    intervalSecs: '3600',
    enabled: 'true',
    linkCapacityKbps: '',
    clientsProvisionedLimit: '',
    provisionedLanSpeedMbps: '',
    parentApDeviceId: '',
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configFormErrors, setConfigFormErrors] = useState<Record<string, string>>({});
  const [configSaveError, setConfigSaveError] = useState<string | null>(null);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);

  // Candidate parents for a STATION's `parentApDeviceId` — loaded lazily, only
  // once the edit form for a STATION is actually opened.
  const [apDevices, setApDevices] = useState<{ id: string; name: string }[]>([]);
  const [apDevicesLoading, setApDevicesLoading] = useState(false);
  // The declared parent AP's name, resolved for display in the read-only view
  // (the config only carries the id).
  const [parentApName, setParentApName] = useState<string | null>(null);

  const [expectedClients, setExpectedClients] = useState<WirelessExpectedClientsResponse | null>(null);
  const [expectedClientsLoading, setExpectedClientsLoading] = useState(false);
  const [expectedClientsError, setExpectedClientsError] = useState<string | null>(null);

  const [identitySuggestions, setIdentitySuggestions] = useState<WirelessIdentitySuggestion[]>([]);
  const [identitySuggestionsLoading, setIdentitySuggestionsLoading] = useState(false);
  // Suggestions carry no id of their own — key on field + value so a dismissal
  // survives a refetch that returns the same still-unresolved suggestion.
  const [dismissedSuggestionKeys, setDismissedSuggestionKeys] = useState<Set<string>>(new Set());
  const [acceptingSuggestionKey, setAcceptingSuggestionKey] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    setNoConfig(false);
    const result = await apiService.getWirelessConfig(deviceId);
    if (result.success && result.data) {
      const c = result.data;
      setConfig(c);
      setConfigForm({
        intervalSecs: String(c.intervalSecs),
        enabled: String(c.enabled),
        linkCapacityKbps: c.linkCapacityKbps != null ? String(c.linkCapacityKbps) : '',
        clientsProvisionedLimit: c.clientsProvisionedLimit !== null ? String(c.clientsProvisionedLimit) : '',
        provisionedLanSpeedMbps: c.provisionedLanSpeedMbps !== null ? String(c.provisionedLanSpeedMbps) : '',
        parentApDeviceId: c.parentApDeviceId ?? '',
      });
    } else {
      if (result.error?.toLowerCase().includes('not found') || result.error?.toLowerCase().includes('404')) {
        setNoConfig(true);
      } else {
        setConfigError(result.error || 'Error al cargar configuración inalámbrica');
      }
    }
    setConfigLoading(false);
  }, [deviceId]);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    const result = await apiService.getWirelessStatus(deviceId);
    if (result.success && result.data) {
      setStatus(result.data);
    } else {
      setStatusError(result.error || 'Sin snapshot disponible');
    }
    setStatusLoading(false);
  }, [deviceId]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    const result = await apiService.getWirelessAlerts(deviceId);
    if (result.success && result.data) {
      setAlerts(result.data);
    }
    setAlertsLoading(false);
  }, [deviceId]);

  const fetchExpectedClients = useCallback(async () => {
    setExpectedClientsLoading(true);
    setExpectedClientsError(null);
    const result = await apiService.getExpectedClients(deviceId);
    if (result.success && result.data) {
      setExpectedClients(result.data);
    } else {
      setExpectedClientsError(result.error || 'Error al cargar las estaciones esperadas');
    }
    setExpectedClientsLoading(false);
  }, [deviceId]);

  const fetchIdentitySuggestions = useCallback(async () => {
    setIdentitySuggestionsLoading(true);
    const result = await apiService.getIdentitySuggestions(deviceId);
    if (result.success && result.data) {
      setIdentitySuggestions(result.data.suggestions);
    }
    setIdentitySuggestionsLoading(false);
  }, [deviceId]);

  /**
   * Clearing by hand makes the same transition the poller makes when the metric
   * recovers — recovery notification and ticket close included — so it is not a
   * way to hide a fault: the next poll re-raises the alert if it persists.
   */
  const handleClearAlert = async (alertId: string) => {
    setClearingAlertId(alertId);
    setAlertsError(null);
    setAlertsNotice(null);
    const result = await apiService.clearWirelessAlert(deviceId, alertId);
    setClearingAlertId(null);

    if (!result.success) {
      const message = result.error || 'No se pudo limpiar la alerta';
      setAlertsError(message);
      showError(message);
      return;
    }
    // The list holds only active alerts, so a cleared one leaves it. Refetching
    // also picks up anything the poller changed meanwhile.
    await fetchAlerts();
    fetchStatus();
  };

  const handleClearAllAlerts = async () => {
    setClearingAll(true);
    setAlertsError(null);
    setAlertsNotice(null);
    // No ids: the endpoint clears the device's whole active list, so the button
    // does not depend on the list this tab happens to be showing.
    const result = await apiService.bulkClearWirelessAlerts(deviceId);
    setClearingAll(false);
    setShowClearAllModal(false);

    if (!result.success || !result.data) {
      const message = result.error || 'No se pudieron limpiar las alertas';
      setAlertsError(message);
      showError(message);
      return;
    }
    const { cleared, skipped, failed } = result.data;
    const parts = [`${cleared.length} ${cleared.length === 1 ? 'alerta limpiada' : 'alertas limpiadas'}`];
    if (skipped.length > 0) parts.push(`${skipped.length} sin cambios`);
    if (failed.length > 0) parts.push(`${failed.length} con error (${failed[0].error})`);
    const message = parts.join(' · ');
    if (failed.length > 0) {
      setAlertsError(message);
      showError(message);
    } else {
      setAlertsNotice(message);
    }

    await fetchAlerts();
    fetchStatus();
  };

  // `fetchConfig` is keyed on the device id alone, so name the status as its own
  // dependency: a retirement or a commissioning flips `enabled` server-side, and
  // the toggle would otherwise keep showing what this tab last wrote.
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig, deviceStatus]);

  useEffect(() => {
    if (config) {
      fetchStatus();
      fetchAlerts();
      fetchIdentitySuggestions();
      if (config.deviceType === 'ACCESS_POINT' || category === 'ACCESS_POINT') {
        fetchExpectedClients();
      }
    }
  }, [config, category, fetchStatus, fetchAlerts, fetchIdentitySuggestions, fetchExpectedClients]);

  // The config only carries the declared parent's id — resolve its name once
  // for the read-only view instead of asking the operator to recognise a UUID.
  useEffect(() => {
    if (!config?.parentApDeviceId) {
      setParentApName(null);
      return;
    }
    let cancelled = false;
    apiService.getDevice(config.parentApDeviceId).then((r) => {
      if (!cancelled) setParentApName(r.success && r.data ? r.data.name : null);
    });
    return () => { cancelled = true; };
  }, [config?.parentApDeviceId]);

  // Candidate APs for the "parent AP" picker — loaded only once the STATION
  // config form is actually open, not on every tab visit.
  useEffect(() => {
    if (!showConfigForm) return;
    const isStationForm = noConfig ? inferDeviceType(category) === 'STATION' : config?.deviceType === 'STATION';
    if (!isStationForm || apDevices.length > 0) return;
    setApDevicesLoading(true);
    apiService.listDevices({ category: 'ACCESS_POINT', deleted: 'false', limit: 200 }).then((r) => {
      if (r.success && r.data) {
        setApDevices(r.data.devices.map((d) => ({ id: d.id, name: d.name })));
      }
      setApDevicesLoading(false);
    });
  }, [showConfigForm, noConfig, category, config?.deviceType, apDevices.length]);

  useEffect(() => {
    apiService.getDeviceCredentials(deviceId).then((r) => {
      setHasHttpCreds(r.success && r.data ? r.data.hasHttpCredentials : false);
      setHasSnmpCreds(r.success && r.data ? r.data.hasSnmpCredentials : false);
    });
  }, [deviceId]);

  // Close the reboot window and pull a fresh snapshot once the antenna is back.
  useEffect(() => {
    if (rebootingUntil === null) return;
    const timer = setTimeout(() => {
      setRebootingUntil(null);
      fetchStatus();
    }, Math.max(rebootingUntil - Date.now(), 0));
    return () => clearTimeout(timer);
  }, [rebootingUntil, fetchStatus]);

  const handleReboot = async () => {
    setRebooting(true);
    setRebootError(null);
    const result = await apiService.rebootWirelessDevice(deviceId);
    setRebooting(false);
    setShowRebootModal(false);
    if (result.success) {
      setPollMsg(null);
      // Start the window from the client clock — server/browser skew would
      // otherwise make it expire immediately or hang around for minutes.
      setRebootingUntil(Date.now() + REBOOT_WINDOW_MS);
    } else {
      const message = result.error || 'No se pudo reiniciar el equipo';
      setRebootError(message);
      showError(message);
    }
  };

  const handlePollNow = async () => {
    setPolling(true);
    setPollMsg(null);
    const result = await apiService.triggerWirelessPoll(deviceId);
    if (result.success && result.data) {
      const r = result.data;
      setPollMsg(
        r.skipped
          ? 'Sondeo omitido (monitoreo deshabilitado)'
          : `Sondeo completado — métricas: ${r.metricsCollected ? 'sí' : 'no'}, alertas activadas: ${r.alertsTriggered}, resueltas: ${r.alertsCleared}`
      );
      fetchStatus();
      fetchAlerts();
    } else {
      setPollMsg(`Error: ${result.error}`);
      showError(result.error || 'Error al sondear el equipo');
    }
    setPolling(false);
  };

  const handleSaveConfig = async () => {
    const errors = validateWirelessConfigForm(configForm);
    setConfigFormErrors(errors);
    if (showFormErrors(errors)) return;

    setConfigSaving(true);
    setConfigSaveError(null);
    setConfigSaveSuccess(false);

    const formIsAP = noConfig ? inferDeviceType(category) === 'ACCESS_POINT' : isAP;
    const payload = {
      ipAddress: deviceIpAddress,
      intervalSecs: configForm.intervalSecs ? parseInt(configForm.intervalSecs) : undefined,
      // `enabled: true` is a 400 on a device that cannot be polled, and this
      // save sends the whole config back — so a retired unit's other edits
      // would fail on a field the form is not even offering.
      enabled: canEnablePolling && configForm.enabled === 'true',
      linkCapacityKbps: configForm.linkCapacityKbps ? parseInt(configForm.linkCapacityKbps) : null,
      clientsProvisionedLimit: configForm.clientsProvisionedLimit ? parseInt(configForm.clientsProvisionedLimit) : null,
      // An auto-captured baseline may be off the WLS-165 list; sent back
      // unchanged it would be refused, so leave it out and let it stand.
      provisionedLanSpeedMbps:
        config && String(config.provisionedLanSpeedMbps ?? '') === configForm.provisionedLanSpeedMbps &&
        !isValidLanSpeed(configForm.provisionedLanSpeedMbps)
          ? undefined
          : configForm.provisionedLanSpeedMbps ? parseInt(configForm.provisionedLanSpeedMbps) : null,
      // STATION only — the backend 400s if this is set on an ACCESS_POINT.
      parentApDeviceId: formIsAP ? null : (configForm.parentApDeviceId || null),
    };

    let result;
    if (noConfig) {
      // deviceType is not accepted here — the backend derives it from the
      // device's category and returns it on the config.
      const createPayload: CreateWirelessConfigDTO = { ...payload };
      result = await apiService.createWirelessConfig(deviceId, createPayload);
    } else {
      result = await apiService.updateWirelessConfig(deviceId, payload);
    }

    if (result.success) {
      setConfigSaveSuccess(true);
      setNoConfig(false);
      setShowConfigForm(false);
      fetchConfig();
    } else {
      const message = result.error || 'Error al guardar configuración';
      setConfigSaveError(message);
      showError(message);
    }
    setConfigSaving(false);
  };

  const handleDeleteConfig = async () => {
    const result = await apiService.deleteWirelessConfig(deviceId);
    if (result.success) {
      setConfig(null);
      setStatus(null);
      setAlerts([]);
      setNoConfig(true);
      setExpectedClients(null);
      setIdentitySuggestions([]);
      setParentApName(null);
    } else {
      showError(result.error || 'No se pudo eliminar la configuración inalámbrica');
    }
  };

  const suggestionKey = (s: WirelessIdentitySuggestion) => `${s.field}:${s.suggestedValue}`;

  /** Never auto-written — accepting is the operator's own `PATCH`, made explicit through this button. */
  const handleAcceptSuggestion = async (s: WirelessIdentitySuggestion) => {
    const key = suggestionKey(s);
    setAcceptingSuggestionKey(key);
    const result = await apiService.updateDevice(
      deviceId,
      s.field === 'name' ? { name: s.suggestedValue } : { macAddress: s.suggestedValue }
    );
    setAcceptingSuggestionKey(null);
    if (result.success && result.data) {
      onDeviceUpdated(result.data);
      fetchIdentitySuggestions();
    } else {
      showError(result.error || 'No se pudo aplicar la sugerencia');
    }
  };

  const handleDismissSuggestion = (s: WirelessIdentitySuggestion) => {
    setDismissedSuggestionKeys((prev) => new Set(prev).add(suggestionKey(s)));
  };

  const visibleSuggestions = identitySuggestions.filter((s) => !dismissedSuggestionKeys.has(suggestionKey(s)));

  const metrics = status?.metrics;
  const isAP = config?.deviceType === 'ACCESS_POINT' || category === 'ACCESS_POINT';
  const effectiveDeviceType = config?.deviceType ?? inferDeviceType(category);

  const isRebooting = rebootingUntil !== null;
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR';

  const deviceLifecycle = { deletedAt: deviceDeletedAt, replacedAt: deviceReplacedAt };
  const enableBlockedReason = wirelessEnableBlockedReason(deviceStatus, category, deviceLifecycle);
  const canEnablePolling = canEnableWirelessPolling(deviceStatus, category, deviceLifecycle);
  /**
   * The config the backend disabled on its own, rather than one the operator
   * turned off. Worth calling out: nothing in this tab did it, and the settings
   * are still there waiting for the equipment to come back into service.
   */
  const disabledByStatus = !!config && !config.enabled && !canEnablePolling;
  // Ubiquiti radios are polled over the AirOS HTTP API, Mimosa over SNMP, and
  // any other vendor is refused by the backend without contacting the radio.
  const collector = vendorSlug ? wirelessCollectorFor(vendorSlug) : null;
  const unsupportedVendorReason =
    vendorSlug && !collector
      ? `El sondeo inalámbrico no está disponible para equipos del fabricante «${vendorSlug}»; solo Ubiquiti y Mimosa.`
      : null;
  // Model failed to load: don't guess which pair — let the backend decide.
  let hasCollectorCreds: boolean | null = null;
  if (collector) hasCollectorCreds = collector.credentials === 'http' ? hasHttpCreds : hasSnmpCreds;
  else if (!vendorSlug && hasHttpCreds !== null && hasSnmpCreds !== null) hasCollectorCreds = hasHttpCreds || hasSnmpCreds;
  // The backend takes the IP from the wireless config and the login from the
  // device credentials — without either it answers 400, so block it up front.
  // Only AirOS exposes a reboot the backend can drive.
  const rebootBlockedReason = collector && !collector.canReboot
    ? 'El reinicio remoto solo está disponible para equipos Ubiquiti (AirOS)'
    : !config?.ipAddress
      ? 'El equipo no tiene IP configurada en el monitoreo inalámbrico'
      : hasHttpCreds === false
        ? 'Configura credenciales HTTP en la pestaña Credenciales'
        : null;
  // A config created without the credentials its collector logs in with would
  // just sit there never collecting anything — require them up front instead
  // of letting the operator find out later.
  const credentialsBlockedReason =
    unsupportedVendorReason ??
    (hasCollectorCreds === false
      ? `Configura credenciales ${collector ? collector.credentials.toUpperCase() : 'HTTP o SNMP'} en la pestaña Credenciales antes de crear el sondeo inalámbrico`
      : null);

  return (
    <div className="space-y-6">

      <ConfirmModal
        isOpen={showRebootModal}
        onClose={() => setShowRebootModal(false)}
        onConfirm={handleReboot}
        title="Reiniciar equipo"
        message={`Se reiniciará la antena en ${config?.ipAddress ?? 'este equipo'}. El enlace se caerá alrededor de 2 minutos y los clientes conectados perderán el servicio durante ese tiempo.`}
        confirmText="Reiniciar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={rebooting}
      />

      <ConfirmModal
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        onConfirm={handleClearAllAlerts}
        title="Limpiar alertas activas"
        message="Se limpiarán todas las alertas inalámbricas activas de este equipo, igual que si las métricas se hubieran recuperado. Si el próximo sondeo sigue viendo la falla, volverán a activarse."
        confirmText="Limpiar"
        cancelText="Cancelar"
        isLoading={clearingAll}
      />

      {/* Config card */}
      <Card>
        <Card.Header>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <SectionTitle
              info={
                <>
                  El tipo se deduce de la categoría del dispositivo: un punto de acceso se registra como
                  Access Point y cualquier otro como Estación (CPE); para cambiarlo, ajusta la categoría en la
                  pestaña Detalles. {WIRELESS_INDEPENDENT_OF_ICMP_NOTE}
                </>
              }
            >
              Configuración Inalámbrica
            </SectionTitle>
            {!configLoading && !configError && (noConfig || config) && (
              <div className="flex gap-2">
                <EditToggleButton
                  isEditing={showConfigForm}
                  onEdit={() => { setShowConfigForm(true); setConfigSaveSuccess(false); setConfigSaveError(null); }}
                  onCancel={() => setShowConfigForm(false)}
                  editLabel={noConfig ? 'Crear configuración' : 'Editar'}
                  disabled={noConfig && !showConfigForm && hasCollectorCreds !== true}
                />
                {!noConfig && !showConfigForm && (
                  <IconButton icon={<TrashIcon />} label="Eliminar configuración" variant="danger" onClick={handleDeleteConfig} />
                )}
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {configLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Cargando configuración..." />
            </div>
          ) : configError ? (
            <p className="text-red-600 dark:text-red-400 text-sm">{configError}</p>
          ) : noConfig ? (
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                Este dispositivo no tiene configuración de monitoreo inalámbrico.
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-4">
                Se registrará como{' '}
                <span className="font-medium">
                  {inferDeviceType(category) === 'ACCESS_POINT' ? 'Access Point' : 'Estación (CPE)'}
                </span>
                .
              </p>
              {credentialsBlockedReason && (
                <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">{credentialsBlockedReason}</p>
              )}
            </div>
          ) : config && !showConfigForm ? (
            <>
            {disabledByStatus && (
              <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                {WIRELESS_DISABLED_BY_STATUS_NOTE}
              </p>
            )}
            <dl className="wrap-anywhere grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Tipo</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {effectiveDeviceType === 'ACCESS_POINT' ? 'Access Point' : 'Estación (CPE)'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Habilitado</dt>
                <dd className="mt-1">
                  <Badge variant={config.enabled ? 'success' : 'neutral'}>
                    {config.enabled ? 'Sí' : 'No'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Intervalo</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{config.intervalSecs}s</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">IP de sondeo</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono text-xs">{config.ipAddress ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Último sondeo</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {config.lastPolledAt ? new Date(config.lastPolledAt).toLocaleString('es') : '—'}
                </dd>
              </div>
              {!isAP && config.linkCapacityKbps != null && (
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Cap. manual (respaldo)</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtKbps(config.linkCapacityKbps)}</dd>
                </div>
              )}
              {isAP && config.clientsProvisionedLimit !== null && (
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Límite clientes</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{config.clientsProvisionedLimit}</dd>
                </div>
              )}
              {config.provisionedLanSpeedMbps !== null && (
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Velocidad LAN provisionada</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{config.provisionedLanSpeedMbps} Mbps</dd>
                </div>
              )}
              {!isAP && config.parentApDeviceId && (
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">AP declarado</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">
                    {parentApName ?? config.parentApDeviceId}
                  </dd>
                </div>
              )}
            </dl>
            </>
          ) : null}

          {showConfigForm && (
            <div className="space-y-4">
              {configSaveError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm text-red-800 dark:text-red-400">
                  {configSaveError}
                </div>
              )}
              {configSaveSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 text-sm text-green-800 dark:text-green-400">
                  Configuración guardada.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Intervalo (segundos)"
                  type="number"
                  min={WIRELESS_INTERVAL_MIN_SECONDS}
                  max={INTERVAL_MAX_SECONDS}
                  value={configForm.intervalSecs}
                  onChange={(e) => {
                    setConfigForm((p) => ({ ...p, intervalSecs: e.target.value }));
                    setConfigFormErrors((p) => { const n = { ...p }; delete n.intervalSecs; return n; });
                  }}
                  error={configFormErrors.intervalSecs}
                  fullWidth
                />
                {/* "Sí" is not offered where the backend would answer 400 — a
                    retired or replaced unit cannot be polled — but the rest of
                    the form stays editable, so its settings can still be fixed. */}
                <div>
                  <Select
                    label="Habilitado"
                    value={canEnablePolling ? configForm.enabled : 'false'}
                    onChange={(e) => setConfigForm((p) => ({ ...p, enabled: e.target.value }))}
                    options={
                      canEnablePolling
                        ? [
                            { value: 'true', label: 'Sí' },
                            { value: 'false', label: 'No' },
                          ]
                        : [{ value: 'false', label: 'No' }]
                    }
                    disabled={!canEnablePolling}
                    fullWidth
                  />
                  {enableBlockedReason && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{enableBlockedReason}</p>
                  )}
                </div>
                {!(noConfig ? inferDeviceType(category) === 'ACCESS_POINT' : isAP) && (
                  // WLS-166: a live contract's plan overrides this value, so it
                  // only matters for links nobody pays for.
                  <Input
                    label="Capacidad manual (kbps)"
                    type="number"
                    value={configForm.linkCapacityKbps}
                    onChange={(e) => setConfigForm((p) => ({ ...p, linkCapacityKbps: e.target.value }))}
                    info="Normalmente se deja vacía: si la estación tiene un servicio contratado activo o pendiente, se usa la velocidad de su plan. Solo aplica a enlaces sin contrato, como backhauls. En kbps: 50 Mbps = 50000."
                    fullWidth
                  />
                )}
                {(noConfig ? inferDeviceType(category) === 'ACCESS_POINT' : isAP) && (
                  <Input
                    label="Límite de estaciones provisionadas"
                    type="number"
                    value={configForm.clientsProvisionedLimit}
                    onChange={(e) => setConfigForm((p) => ({ ...p, clientsProvisionedLimit: e.target.value }))}
                    fullWidth
                  />
                )}
                {!(noConfig ? inferDeviceType(category) === 'ACCESS_POINT' : isAP) && (
                  <Select
                    label="AP declarado"
                    value={configForm.parentApDeviceId}
                    onChange={(e) => setConfigForm((p) => ({ ...p, parentApDeviceId: e.target.value }))}
                    options={apDevices.map((d) => ({ value: d.id, label: d.name }))}
                    placeholder={apDevicesLoading ? 'Cargando...' : 'Sin declarar'}
                    disabled={apDevicesLoading}
                    info="El AP donde esta estación debería estar conectada. Alimenta la vista de «Estaciones Esperadas» en ese AP."
                    fullWidth
                  />
                )}
                {/* Only the standard Ethernet speeds are accepted (WLS-165), so this
                    is a pick-list rather than a number field. */}
                <Select
                  label="Velocidad LAN provisionada"
                  value={configForm.provisionedLanSpeedMbps}
                  onChange={(e) => setConfigForm((p) => ({ ...p, provisionedLanSpeedMbps: e.target.value }))}
                  options={lanSpeedOptions(configForm.provisionedLanSpeedMbps)}
                  info="Normalmente no hace falta fijarla: se completa sola con el primer sondeo. Fíjala solo para corregir una línea base capturada mientras el puerto ya estaba degradado."
                  fullWidth
                />
              </div>
            </div>
          )}
        </Card.Body>
        {showConfigForm && (
          <Card.Footer>
            <EditFormActions
              onCancel={() => setShowConfigForm(false)}
              onSave={handleSaveConfig}
              isSaving={configSaving}
              hideCancel
              saveLabel={noConfig ? 'Crear configuración' : 'Guardar Cambios'}
            />
          </Card.Footer>
        )}
      </Card>

      {config && (
        <>
          {/* Identity suggestions — a read-only diff between what AirOS last
              reported about its own hostname/MAC and what's on file here.
              Never auto-written; each row is its own accept/dismiss. */}
          {!identitySuggestionsLoading && visibleSuggestions.length > 0 && (
            <Card>
              <Card.Header>
                <SectionTitle info="El último sondeo reportó estos valores distintos a los registrados en el inventario. Nada se cambia solo: acepta o descarta cada sugerencia.">
                  Sugerencias de Identidad
                  <span className="ml-2 text-sm font-normal text-amber-600 dark:text-amber-400">
                    ({visibleSuggestions.length})
                  </span>
                </SectionTitle>
              </Card.Header>
              <Card.Body>
                <div className="space-y-2">
                  {visibleSuggestions.map((s) => {
                    const key = suggestionKey(s);
                    return (
                      <div
                        key={key}
                        className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                      >
                        <div className="min-w-0 text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {s.field === 'name' ? 'Nombre' : 'Dirección MAC'}:
                          </span>{' '}
                          <span className="text-gray-500 dark:text-gray-400 line-through wrap-anywhere">
                            {s.currentValue ?? '—'}
                          </span>{' '}
                          <span className="text-gray-400 dark:text-gray-500">→</span>{' '}
                          <span className="text-gray-900 dark:text-gray-100 font-medium wrap-anywhere">
                            {s.suggestedValue}
                          </span>
                        </div>
                        {canWrite && (
                          <div className="flex items-center gap-2 shrink-0">
                            <IconButton
                              icon={<CheckIcon />}
                              label="Aplicar"
                              variant="primary"
                              onClick={() => handleAcceptSuggestion(s)}
                              isLoading={acceptingSuggestionKey === key}
                              disabled={acceptingSuggestionKey !== null}
                            />
                            <IconButton
                              icon={<CloseIcon />}
                              label="Descartar"
                              onClick={() => handleDismissSuggestion(s)}
                              disabled={acceptingSuggestionKey !== null}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Live throughput — pushed by the poller over SSE, so it moves on
              its own while the snapshot below stays where "Actualizar" left it. */}
          <WirelessThroughputCard deviceId={deviceId} intervalSecs={config.intervalSecs} />

          {/* On-demand check for a failing link. The backend refuses a vendor
              it cannot read, so there is nothing to offer for one. */}
          {!unsupportedVendorReason && <LinkDiagnosisCard deviceId={deviceId} canWrite={canWrite} />}

          {/* Latest snapshot */}
          <Card>
            <Card.Header>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Métricas Actuales</h2>
                  {status && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {effectiveDeviceType === 'ACCESS_POINT' ? 'Access Point' : 'Estación'} ·{' '}
                      Método: {COLLECTION_METHOD_LABELS[status.collectionMethod] ?? status.collectionMethod}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <IconButton icon={<RefreshIcon />} label="Actualizar" onClick={fetchStatus} disabled={statusLoading || isRebooting} />
                  <IconButton
                    icon={<PollIcon />}
                    label={unsupportedVendorReason ?? 'Sondear ahora'}
                    variant="primary"
                    onClick={handlePollNow}
                    isLoading={polling}
                    disabled={isRebooting || unsupportedVendorReason !== null}
                  />
                  {canWrite && (
                    <IconButton
                      icon={<PowerIcon />}
                      label={rebootBlockedReason ?? 'Reiniciar equipo'}
                      variant="danger"
                      onClick={() => { setRebootError(null); setShowRebootModal(true); }}
                      disabled={isRebooting || rebootBlockedReason !== null}
                    />
                  )}
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {isRebooting && (
                <div className="mb-4 p-3 rounded-md text-sm bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
                  Reiniciando… el equipo estará fuera de línea alrededor de 2 minutos.
                  Las métricas se actualizarán solas al terminar.
                </div>
              )}
              {rebootError && (
                <div className="mb-4 p-3 rounded-md text-sm bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400">
                  {rebootError}
                </div>
              )}
              {statusLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner message="Cargando métricas..." />
                </div>
              ) : statusError && !isRebooting ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">{statusError}</p>
              ) : metrics ? (
                <>
                  {pollMsg && (
                    <div className="mb-4 p-3 rounded-md text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                      {pollMsg}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Recopilado: {new Date(status!.collectedAt).toLocaleString('es')}
                  </p>

                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Señal</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">SSID</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100 break-all">{metrics.ssid ?? '—'}</dd>
                    </div>
                    {!isAP && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Señal RX (del AP)</dt>
                        <dd className="mt-1">
                          {metrics.signalRxDbm !== null ? (
                            <Badge variant={signalBadgeVariant(metrics.signalRxDbm)}>
                              {metrics.signalRxDbm} dBm
                            </Badge>
                          ) : '—'}
                        </dd>
                      </div>
                    )}
                    {!isAP && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Señal TX (al AP)</dt>
                        <dd className="mt-1">
                          {metrics.signalTxDbm !== null ? (
                            <Badge variant={signalBadgeVariant(metrics.signalTxDbm)}>
                              {metrics.signalTxDbm} dBm
                            </Badge>
                          ) : '—'}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Piso de ruido</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.noiseFloorDbm, 'dBm', 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">SNR</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.snrDb, 'dB', 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">CCQ</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.ccqPercent, '%', 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Frecuencia</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {metrics.frequencyMhz !== null ? `${metrics.frequencyMhz} MHz` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Ancho de canal</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {metrics.channelWidthMhz !== null ? `${metrics.channelWidthMhz} MHz` : '—'}
                      </dd>
                    </div>
                    {!isAP && metrics.distanceM !== null && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Distancia al AP</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtDistance(metrics.distanceM)}</dd>
                      </div>
                    )}
                    {!isAP && metrics.remoteApName && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">AP Remoto</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">
                          {metrics.remoteApName}
                          {metrics.remoteApMac ? ` (${metrics.remoteApMac})` : ''}
                        </dd>
                      </div>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Rendimiento</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Throughput TX</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtBps(metrics.throughputTxBps)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Throughput RX</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtBps(metrics.throughputRxBps)}</dd>
                    </div>
                    {metrics.latencyMs !== null && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Latencia</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">{metrics.latencyMs} ms</dd>
                      </div>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sistema</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">CPU</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.cpuLoadPercent, '%', 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Memoria</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.memoryUsedPercent, '%', 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Uptime</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtUptime(metrics.uptimeSeconds)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Firmware</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100 text-xs">{metrics.firmwareVersion ?? '—'}</dd>
                    </div>
                    {metrics.lanStatus && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">LAN</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">
                          {metrics.lanStatus}
                          {metrics.lanSpeedMbps !== null ? ` / ${metrics.lanSpeedMbps} Mbps` : ''}
                          {metrics.lanDuplex ? ` ${metrics.lanDuplex}` : ''}
                        </dd>
                      </div>
                    )}
                    {isAP && metrics.clientsConnected !== null && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Estaciones conectadas</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">
                          {metrics.clientsConnected}
                        </dd>
                      </div>
                    )}
                  </div>
                </>
              ) : isRebooting ? null : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Sin datos disponibles. Haga clic en &quot;Sondear Ahora&quot; para obtener métricas.
                </p>
              )}
            </Card.Body>
          </Card>

          {/* Active alerts */}
          <Card>
            <Card.Header>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Alertas Activas
                  {alerts.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-red-600 dark:text-red-400">
                      ({alerts.length})
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  {canWrite && alerts.length > 0 && (
                    <IconButton
                      icon={<ClearIcon />}
                      label="Limpiar todas las alertas"
                      onClick={() => setShowClearAllModal(true)}
                      disabled={clearingAlertId !== null}
                    />
                  )}
                  <IconButton icon={<RefreshIcon />} label="Actualizar" onClick={fetchAlerts} disabled={alertsLoading} />
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {alertsError && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">{alertsError}</p>
              )}
              {alertsNotice && (
                <p className="mb-3 text-sm text-green-700 dark:text-green-400">{alertsNotice}</p>
              )}
              {alertsLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner message="Cargando alertas..." />
                </div>
              ) : alerts.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Sin alertas activas.</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert: WirelessAlertDTO) => (
                    <div
                      key={alert.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Badge variant={alertSeverityVariant(alert.severity)} className="mr-2">
                            {alert.severity}
                          </Badge>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 wrap-anywhere">
                            {alert.message}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {new Date(alert.triggeredAt).toLocaleString('es')}
                          </span>
                          {canWrite && (
                            <IconButton
                              icon={<ClearIcon />}
                              label="Limpiar alerta"
                              onClick={() => handleClearAlert(alert.id)}
                              isLoading={clearingAlertId === alert.id}
                              disabled={clearingAlertId !== null}
                            />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Métrica: <code className="font-mono">{alert.metric}</code> — valor: {alert.lastValue}, umbral: {alert.threshold}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Connected stations (AP only) — the raw live list, which already
              covers both declared and undeclared clients: it's whatever the
              AP's last poll actually saw. */}
          {isAP && status && (
            <Card>
              <Card.Header>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionTitle info={status.clients.length > 0 ? 'Haz clic en una fila para ver los detalles del CPE remoto.' : undefined}>
                    Estaciones Conectadas
                    {status.clients.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                        ({status.clients.length})
                      </span>
                    )}
                  </SectionTitle>
                  {expectedClients && expectedClients.missingCount > 0 && (
                    <Badge variant="danger">
                      {expectedClients.missingCount} desconectada{expectedClients.missingCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
              </Card.Header>
              <Card.Body>
                {status.clients.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Sin estaciones conectadas.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400">
                          <th className="pb-2 pr-3 font-medium">CPE</th>
                          <th className="pb-2 pr-3 font-medium">IP</th>
                          <th className="pb-2 pr-3 font-medium">Señal → AP</th>
                          <th className="pb-2 pr-3 font-medium">Señal AP →</th>
                          <th className="pb-2 pr-3 font-medium">Distancia</th>
                          <th className="pb-2 pr-3 font-medium">Score DL/UL</th>
                          <th className="pb-2 pr-3 font-medium">Uptime</th>
                          <th className="pb-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {status.clients.map((client: WirelessClientDTO) => (
                          <ClientRow key={client.macAddress} client={client} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Disconnected stations (AP only) — declared via parentApDeviceId
              on the STATION side, but missing from the live list above. Only
              shown once at least one station declares this AP as its parent. */}
          {isAP && expectedClients && expectedClients.expected.length > 0 && (
            <Card>
              <Card.Header>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Estaciones Desconectadas
                    {expectedClients.missingCount > 0 && (
                      <span className="ml-2 text-sm font-normal text-red-600 dark:text-red-400">
                        ({expectedClients.missingCount})
                      </span>
                    )}
                  </h2>
                  <IconButton icon={<RefreshIcon />} label="Actualizar" onClick={fetchExpectedClients} disabled={expectedClientsLoading} />
                </div>
              </Card.Header>
              <Card.Body>
                {expectedClientsError ? (
                  <p className="text-red-600 dark:text-red-400 text-sm">{expectedClientsError}</p>
                ) : expectedClients.missingCount === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Todas las estaciones que declaran este AP están conectadas.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[400px]">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400">
                          <th className="pb-2 pr-3 font-medium">Estación</th>
                          <th className="pb-2 font-medium">MAC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expectedClients.expected.filter((e) => !e.connected).map((e) => (
                          <tr key={e.deviceId} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2 pr-3">
                              <Link href={`/devices/${e.deviceId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                {e.deviceName}
                              </Link>
                            </td>
                            <td className="py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                              {e.macAddress ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
