'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { HARDWARE_CHANGES_QUERY_KEY } from '@/hooks/useHardwareChanges';
import {
  WirelessConfigDTO,
  WirelessStatusDTO,
  WirelessClientDTO,
  WirelessDeviceType,
  CreateWirelessConfigDTO,
  WirelessExpectedClientsResponse,
  WirelessIdentitySuggestion,
} from '@/types/wireless.types';
import { DeviceCategory, DeviceStatus, DeviceResponseDTO } from '@/types/device.types';
import { Card, Input, Select, Switch, LoadingSpinner, Badge, ConfirmModal, IconButton, EditFormActions, EditToggleButton, SectionTitle, PlusIcon } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { useInstallation } from '@/hooks/useInstallation';
import { usePermissions } from '@/hooks/usePermissions';
import {
  WIRELESS_INTERVAL_MIN_SECONDS,
  INTERVAL_MAX_SECONDS,
  validateIntervalSeconds,
  fmtInterval,
} from '@/constants/polling.constants';
import { IntervalInput } from './IntervalInput';
import { IpLink } from './IpLink';
import {
  HardwareChangeCard,
  MissingModelNote,
  isHardwareChange,
  type HardwarePatch,
  type ReplacePrefill,
} from '@/components/wireless/HardwareChangeCard';
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
  IDENTITY_SUGGESTIONS_ANCHOR,
} from '@/constants/wireless.constants';
import { LinkDiagnosisCard } from '@/components/wireless/LinkDiagnosisCard';
import { WirelessKeyField } from '@/components/wireless/WirelessKeyField';
import { upstreamLinkError } from '@/constants/topology.constants';
import { agentPollFailure } from '@/constants/agent.constants';

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

interface Props {
  deviceId: string;
  category: DeviceCategory | null;
  deviceIpAddress: string | null;
  /**
   * Of the device's model. Picks how the backend polls the radio — and so
   * which credentials it needs — or whether it can at all. Null while unknown.
   */
  vendorSlug: string | null;
  /** The on-site agent it sits behind, if any. Off site, only it can read the radio on demand (WLS-029). */
  deviceAgentId: string | null;
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
  /**
   * Open the page's «Reemplazar equipo» / «Intercambiar hardware» modals from
   * a hardware-change suggestion. Absent when the operator may not, or the
   * unit was already replaced — the card then only explains.
   */
  onReplaceHardware?: (prefill: ReplacePrefill) => void;
  onSwapHardware?: (otherDeviceId: string) => void;
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

// The backend derives the radio mode from the device's category and returns it
// on the config; this mirrors that rule so the form can be laid out before the
// config exists.
function inferDeviceType(category: DeviceCategory | null): WirelessDeviceType {
  return category === 'ACCESS_POINT' ? 'ACCESS_POINT' : 'STATION';
}

// A rebooted AirOS antenna stays offline ~1–2 min; polls fail meanwhile, so we
// mute the "no snapshot" errors for this long instead of showing them as faults.
const REBOOT_WINDOW_MS = 120_000;

const SUGGESTION_FIELD_LABELS: Record<WirelessIdentitySuggestion['field'], string> = {
  name: 'Nombre',
  macAddress: 'Dirección MAC',
  serialNumber: 'Serie',
  upstreamDeviceId: 'Depende de (AP)',
  deviceModel: 'Modelo',
};

// A station that declares this AP as its parent but is missing from the AP's
// live list. Same columns as ClientRow so it sits in the same table, but
// dimmed, flagged and linked to the station's own device page.
function DisconnectedStationRow({ station }: { station: WirelessExpectedClientsResponse['expected'][number] }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700 bg-red-50/60 dark:bg-red-900/10">
      <td className="py-2 pr-3 border-l-2 border-red-500 pl-2">
        <Link href={`/devices/${station.deviceId}`} className="font-mono text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
          {station.deviceName}
        </Link>
        <div className="font-mono text-xs text-gray-400 dark:text-gray-500">{station.macAddress ?? 'Sin MAC registrada'}</div>
      </td>
      <td className="py-2 pr-3" colSpan={6}>
        <Badge variant="danger">Desconectada</Badge>
      </td>
      <td className="py-2" />
    </tr>
  );
}

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
          {client.ipAddress ? (
            <IpLink ip={client.ipAddress} />
          ) : (
            <span className="font-mono text-xs text-gray-600 dark:text-gray-400">—</span>
          )}
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
  deviceAgentId,
  deviceStatus,
  deviceDeletedAt,
  deviceReplacedAt,
  onDeviceUpdated,
  onReplaceHardware,
  onSwapHardware,
}: Props) {
  const permissions = usePermissions();
  // WLS-029: an install whose server is off site talks to no device itself:
  // reboot and diagnosis answer 409 for every device, and a poll is read
  // through the device's agent or not at all. An on-site server (the
  // default) keeps all three working for every device.
  const { serverOnSite } = useInstallation();
  const serverCannotReach = !serverOnSite;
  const canPollFromHere = serverOnSite || deviceAgentId !== null;
  const [config, setConfig] = useState<WirelessConfigDTO | null>(null);
  const [noConfig, setNoConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const { showError, showSuccess, showFormErrors } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<WirelessStatusDTO | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

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
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configFormErrors, setConfigFormErrors] = useState<Record<string, string>>({});
  const [configSaveError, setConfigSaveError] = useState<string | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);


  const [expectedClients, setExpectedClients] = useState<WirelessExpectedClientsResponse | null>(null);
  const [expectedClientsLoading, setExpectedClientsLoading] = useState(false);
  const [expectedClientsError, setExpectedClientsError] = useState<string | null>(null);

  const [identitySuggestions, setIdentitySuggestions] = useState<WirelessIdentitySuggestion[]>([]);
  const [identitySuggestionsLoading, setIdentitySuggestionsLoading] = useState(false);
  // Suggestions carry no id of their own — key on field + value so a dismissal
  // survives a refetch that returns the same still-unresolved suggestion.
  const [dismissedSuggestionKeys, setDismissedSuggestionKeys] = useState<Set<string>>(new Set());
  const [acceptingSuggestionKey, setAcceptingSuggestionKey] = useState<string | null>(null);
  // A reported model missing from the catalog is added inline before it can be
  // accepted. Its id is kept by reported name so the suggestion is usable at
  // once, without waiting on the backend to re-match it.
  const [createdModelIds, setCreatedModelIds] = useState<Record<string, string>>({});

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

  // `fetchConfig` is keyed on the device id alone, so name the status as its own
  // dependency: a retirement or a commissioning flips `enabled` server-side, and
  // the toggle would otherwise keep showing what this tab last wrote.
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig, deviceStatus]);

  useEffect(() => {
    if (config) {
      fetchStatus();
      fetchIdentitySuggestions();
      if (config.deviceType === 'ACCESS_POINT' || category === 'ACCESS_POINT') {
        fetchExpectedClients();
      }
    }
  }, [config, category, fetchStatus, fetchIdentitySuggestions, fetchExpectedClients]);

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
    } else {
      // An agent that gave no reading recorded nothing; say why in Spanish.
      const message = agentPollFailure(result.status, result.error) ?? result.error ?? 'Error al sondear el equipo';
      setPollMsg(`Error: ${message}`);
      showError(message);
    }
    setPolling(false);
  };

  const handleSaveConfig = async () => {
    const errors = validateWirelessConfigForm(configForm);
    setConfigFormErrors(errors);
    if (showFormErrors(errors)) return;

    setConfigSaving(true);
    setConfigSaveError(null);

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
      showSuccess('Configuración inalámbrica guardada.');
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
      setNoConfig(true);
      setExpectedClients(null);
      setIdentitySuggestions([]);
      showSuccess('Configuración inalámbrica eliminada.');
    } else {
      showError(result.error || 'No se pudo eliminar la configuración inalámbrica');
    }
  };

  // A model missing from the catalog has no value, so its reported name keys it.
  const suggestionKey = (s: WirelessIdentitySuggestion) => `${s.field}:${s.suggestedValue ?? s.suggestedLabel}`;

  /** The catalog id a suggestion points at — including a model just added for it here. */
  const suggestedValueOf = (s: WirelessIdentitySuggestion) =>
    s.suggestedValue ?? (s.field === 'deviceModel' && s.suggestedLabel ? createdModelIds[s.suggestedLabel] ?? null : null);

  /** Never auto-written — accepting is the operator's own `PATCH`, made explicit through this button. */
  const handleAcceptSuggestion = async (s: WirelessIdentitySuggestion) => {
    const value = suggestedValueOf(s);
    if (value === null) return;
    const key = suggestionKey(s);
    setAcceptingSuggestionKey(key);
    // Every field, the AP included since it became the device's upstream, is a device PATCH.
    // Only the model is named differently on the device.
    const field = s.field === 'deviceModel' ? 'deviceModelId' : s.field;
    const result = await apiService.updateDevice(deviceId, { [field]: value });
    setAcceptingSuggestionKey(null);
    if (result.success && result.data) {
      showSuccess('Sugerencia aplicada.');
      onDeviceUpdated(result.data);
      fetchIdentitySuggestions();
      queryClient.invalidateQueries({ queryKey: HARDWARE_CHANGES_QUERY_KEY });
    } else {
      showError(upstreamLinkError(result.error) ?? (result.error || 'No se pudo aplicar la sugerencia'));
    }
  };

  const handleDismissSuggestion = (...dismissed: WirelessIdentitySuggestion[]) => {
    setDismissedSuggestionKeys((prev) => {
      const next = new Set(prev);
      for (const s of dismissed) next.add(suggestionKey(s));
      return next;
    });
  };


  /** The card's «Solo corregir la MAC» — the same PATCH as a row's accept. */
  const handleHardwareUpdate = async (patch: HardwarePatch) => {
    const result = await apiService.updateDevice(deviceId, patch);
    if (result.success && result.data) {
      showSuccess('Sugerencia aplicada.');
      onDeviceUpdated(result.data);
      fetchIdentitySuggestions();
      queryClient.invalidateQueries({ queryKey: HARDWARE_CHANGES_QUERY_KEY });
    } else {
      showError(result.error || 'No se pudo aplicar la sugerencia');
    }
  };

  const visibleSuggestions = identitySuggestions.filter((s) => !dismissedSuggestionKeys.has(suggestionKey(s)));
  const hardwareSuggestions = visibleSuggestions.filter(isHardwareChange);
  const fieldSuggestions = visibleSuggestions.filter((s) => !isHardwareChange(s));
  const showSuggestions = !identitySuggestionsLoading && visibleSuggestions.length > 0;

  // The parent-AP alert (on /alerts/:id) links to this card by hash,
  // but the card only mounts once the suggestions fetch lands, after the
  // browser's own anchor jump has come and gone.
  useEffect(() => {
    if (!showSuggestions || window.location.hash !== `#${IDENTITY_SUGGESTIONS_ANCHOR}`) return;
    document.getElementById(IDENTITY_SUGGESTIONS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showSuggestions]);

  const metrics = status?.metrics;
  const isAP = config?.deviceType === 'ACCESS_POINT' || category === 'ACCESS_POINT';
  const effectiveDeviceType = config?.deviceType ?? inferDeviceType(category);

  const isRebooting = rebootingUntil !== null;
  const canWrite = permissions.canWrite;

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
  // The Wi-Fi key is AirOS only (WLS-222) and seeing it is the reveal
  // permission; an unknown vendor shows it and lets the backend decide. It
  // reaches the radio like a poll does (WLS-225), so off site via the agent.
  const showWirelessKey = permissions.canRevealCredentials && (collector ? collector.radioSettings : !vendorSlug);
  const wirelessKeyBlockedReason = !canPollFromHere
    ? 'El servidor no está en la red monitoreada y este equipo no tiene agente: asígnale uno en «Detalles» (Sondeado por).'
    : !config?.ipAddress
      ? 'El equipo no tiene IP configurada en el monitoreo inalámbrico.'
      : hasHttpCreds === false
        ? 'Configura credenciales HTTP en la pestaña Credenciales.'
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

      {/* How the radio is doing comes first; how it is set up, after. */}
      {config && (
        <>
          {/* On-demand check for a failing link. The backend refuses a vendor
              it cannot read, so there is nothing to offer for one. */}
          {!unsupportedVendorReason && !serverCannotReach && <LinkDiagnosisCard deviceId={deviceId} canWrite={canWrite} />}

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
                  {canWrite && canPollFromHere && (
                    <IconButton
                      icon={<PollIcon />}
                      label={unsupportedVendorReason ?? 'Sondear ahora'}
                      variant="primary"
                      onClick={handlePollNow}
                      isLoading={polling}
                      disabled={isRebooting || unsupportedVendorReason !== null}
                    />
                  )}
                  {canWrite && !serverCannotReach && (
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
              {serverCannotReach && (
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  {deviceAgentId
                    ? 'El servidor no está en la red monitoreada: el sondeo se hace a través del agente del equipo, y el reinicio y el diagnóstico no están disponibles desde aquí.'
                    : 'El servidor no está en la red monitoreada, así que el sondeo manual, el reinicio y el diagnóstico no están disponibles desde aquí.'}
                </p>
              )}
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
                    <div className="mb-4 p-3 rounded-md text-sm bg-brand-50 dark:bg-brand-900/20 text-brand-800 dark:text-brand-300">
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
                    {showWirelessKey && <WirelessKeyField deviceId={deviceId} blockedReason={wirelessKeyBlockedReason} />}
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
                  Sin datos disponibles.{' '}
                  {!canPollFromHere
                    ? 'Sin un agente, nadie lee este equipo: asígnale uno en «Detalles» (Sondeado por).'
                    : canWrite
                      ? <>Haga clic en &quot;Sondear Ahora&quot; para obtener métricas.</>
                      : 'Las métricas aparecerán tras el próximo sondeo programado.'}
                </p>
              )}
            </Card.Body>
          </Card>

          {/* Stations (AP only) — the live list from the AP's last poll,
              which covers both declared and undeclared clients, followed by
              the declared stations (those whose upstream is this AP)
              that are missing from it, dimmed and flagged. */}
          {isAP && (status || (expectedClients && expectedClients.missingCount > 0)) && (() => {
            const connected = status?.clients ?? [];
            const disconnected = expectedClients?.expected.filter((e) => !e.connected) ?? [];
            return (
              <Card>
                <Card.Header>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SectionTitle info={connected.length > 0 ? 'Haz clic en una fila para ver los detalles del CPE remoto.' : undefined}>
                      Estaciones
                      {connected.length > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                          ({connected.length} conectada{connected.length === 1 ? '' : 's'})
                        </span>
                      )}
                    </SectionTitle>
                    <div className="flex items-center gap-2">
                      {disconnected.length > 0 && (
                        <Badge variant="danger">
                          {disconnected.length} desconectada{disconnected.length === 1 ? '' : 's'}
                        </Badge>
                      )}
                      {expectedClients && expectedClients.expected.length > 0 && (
                        <IconButton icon={<RefreshIcon />} label="Actualizar estaciones desconectadas" onClick={fetchExpectedClients} disabled={expectedClientsLoading} />
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Card.Body>
                  {connected.length === 0 && disconnected.length === 0 ? (
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
                          {connected.map((client: WirelessClientDTO) => (
                            <ClientRow key={client.macAddress} client={client} />
                          ))}
                          {disconnected.map((e) => (
                            <DisconnectedStationRow key={e.deviceId} station={e} />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {expectedClientsError && (
                    <p className="mt-3 text-red-600 dark:text-red-400 text-sm">{expectedClientsError}</p>
                  )}
                </Card.Body>
              </Card>
            );
          })()}

          {/* Identity suggestions — a read-only diff between what AirOS last
              reported about its own hostname/MAC/model, or the AP it's talking
              to, and what's on file here. A different box gets its own card;
              every other field is its own accept/dismiss row. */}
          {showSuggestions && (
            <div id={IDENTITY_SUGGESTIONS_ANCHOR} className="scroll-mt-4 space-y-6">
              {hardwareSuggestions.length > 0 && (
                <HardwareChangeCard
                  suggestions={hardwareSuggestions}
                  vendorSlug={vendorSlug}
                  canWrite={canWrite}
                  onReplace={onReplaceHardware}
                  onSwap={onSwapHardware}
                  onUpdate={handleHardwareUpdate}
                  onDismiss={() => handleDismissSuggestion(...hardwareSuggestions)}
                  onModelCreated={fetchIdentitySuggestions}
                />
              )}
              {fieldSuggestions.length > 0 && (
              <Card>
                <Card.Header>
                  <SectionTitle info="El último sondeo reportó estos valores distintos a los registrados. Nada se cambia solo: acepta o descarta cada sugerencia. Solo «Depende de» vacío se completa por sí mismo, cuando la MAC del AP reportada coincide exactamente con un equipo del inventario.">
                    Sugerencias de Identidad
                    <span className="ml-2 text-sm font-normal text-amber-600 dark:text-amber-400">
                      ({fieldSuggestions.length})
                    </span>
                  </SectionTitle>
                </Card.Header>
                <Card.Body>
                  <div className="space-y-2">
                    {fieldSuggestions.map((s) => {
                      const key = suggestionKey(s);
                      const missingModel = s.field === 'deviceModel' && suggestedValueOf(s) === null;
                      return (
                        <div
                          key={key}
                          className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                        >
                          <div className="min-w-0 text-sm">
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {SUGGESTION_FIELD_LABELS[s.field]}:
                            </span>{' '}
                            <span className="text-gray-500 dark:text-gray-400 line-through wrap-anywhere">
                              {s.currentLabel ?? s.currentValue ?? '—'}
                            </span>{' '}
                            <span className="text-gray-400 dark:text-gray-500">→</span>{' '}
                            <span className="text-gray-900 dark:text-gray-100 font-medium wrap-anywhere">
                              {s.suggestedLabel ?? s.suggestedValue}
                            </span>
                            {s.field === 'deviceModel' && s.suggestedValue === null && s.suggestedLabel &&
                              suggestedValueOf(s) === null && (
                                <MissingModelNote
                                  reportedName={s.suggestedLabel}
                                  vendorSlug={vendorSlug}
                                  canWrite={canWrite}
                                  onCreated={(m) => {
                                    setCreatedModelIds((prev) => ({ ...prev, [s.suggestedLabel!]: m.id }));
                                    fetchIdentitySuggestions();
                                  }}
                                />
                              )}
                          </div>
                          {canWrite && (
                            <div className="flex items-center gap-2 shrink-0">
                              <IconButton
                                icon={<CheckIcon />}
                                label="Aplicar"
                                variant="primary"
                                onClick={() => handleAcceptSuggestion(s)}
                                isLoading={acceptingSuggestionKey === key}
                                disabled={acceptingSuggestionKey !== null || missingModel}
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
            </div>
          )}

        </>
      )}

      {/* Config card — alone at the top until a config exists. */}
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
                {noConfig && !showConfigForm ? (
                  // Creating is offered only once the credentials its collector
                  // logs in with are saved; until then the body says what's missing.
                  hasCollectorCreds === true && !unsupportedVendorReason && permissions.canWrite && (
                    <IconButton
                      icon={<PlusIcon />}
                      label="Crear sondeo inalámbrico"
                      variant="primary"
                      onClick={() => { setShowConfigForm(true); setConfigSaveError(null); }}
                    />
                  )
                ) : (
                  <EditToggleButton
                    isEditing={showConfigForm}
                    onEdit={() => { setShowConfigForm(true); setConfigSaveError(null); }}
                    onCancel={() => setShowConfigForm(false)}
                  />
                )}
                {!noConfig && !showConfigForm && permissions.isAdmin && (
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
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtInterval(config.intervalSecs)}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">IP de sondeo</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100 font-mono text-xs">
                  {config.ipAddress || deviceIpAddress ? <IpLink ip={config.ipAddress || deviceIpAddress || ''} /> : '—'}
                </dd>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <IntervalInput
                  label="Intervalo"
                  value={configForm.intervalSecs}
                  onChange={(seconds) => {
                    setConfigForm((p) => ({ ...p, intervalSecs: seconds }));
                    setConfigFormErrors((p) => { const n = { ...p }; delete n.intervalSecs; return n; });
                  }}
                  error={configFormErrors.intervalSecs}
                />
                {/* Locked off where the backend would answer 400 — a retired
                    or replaced unit cannot be polled — but the rest of the form
                    stays editable, so its settings can still be fixed. */}
                <div className="flex items-center md:pt-6">
                  <Switch
                    id="wireless-polling-enabled"
                    label="Sondeo inalámbrico habilitado"
                    description={enableBlockedReason ?? undefined}
                    checked={canEnablePolling && configForm.enabled === 'true'}
                    onChange={(e) => setConfigForm((p) => ({ ...p, enabled: String(e.target.checked) }))}
                    disabled={!canEnablePolling}
                  />
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

    </div>
  );
}
