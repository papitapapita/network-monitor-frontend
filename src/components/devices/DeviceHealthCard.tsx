'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { DeviceResponseDTO } from '@/types/device.types';
import { Card, Badge, IconButton, SectionTitle, getPollingStatusBadgeVariant } from '@/components/ui';
import { fmtAge, fmtBps } from '@/constants/wireless.constants';
import { HealthTile, PingSummaryTiles, usePingSummary } from './PingSummary';

const CONNECTIVITY_LABELS: Record<string, string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Desconectado',
  UNKNOWN: 'Desconocido',
};

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

function signalTone(dbm: number | null): string {
  if (dbm === null) return '';
  if (dbm >= -65) return 'text-green-700 dark:text-green-400';
  if (dbm >= -75) return 'text-yellow-700 dark:text-yellow-400';
  return 'text-red-700 dark:text-red-400';
}

function fmtUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const ageOf = (iso: string) => fmtAge(Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000));

interface Props {
  device: DeviceResponseDTO;
  /** The radio is read only for a wireless model in a wireless category — the page already knows which. */
  showWireless: boolean;
  onOpenTab: (tab: 'polling' | 'wireless') => void;
}

/**
 * How the device is doing right now, before anything about how it is set up:
 * the ping verdict and its last day, and — for a radio — the latest snapshot
 * and its open alerts. Read-only; every number links to the tab that owns it.
 */
export function DeviceHealthCard({ device, showWireless, onOpenTab }: Props) {
  const monitored = device.monitoringEnabled && !!device.ipAddress;
  const ping = usePingSummary(device.id, monitored);

  const pollingQuery = useQuery({
    queryKey: ['devices', device.id, 'polling-status'],
    queryFn: async () => {
      const r = await apiService.getPollingStatus(device.id);
      // No config yet is an answer, not a failure: the card just shows "unknown".
      return r.success && r.data ? r.data : null;
    },
  });
  const wirelessQuery = useQuery({
    queryKey: ['devices', device.id, 'wireless-status'],
    queryFn: async () => {
      const r = await apiService.getWirelessStatus(device.id);
      return r.success && r.data ? r.data : null;
    },
    enabled: showWireless,
  });
  const pollingStatus = pollingQuery.data ?? null;
  const wireless = showWireless ? (wirelessQuery.data ?? null) : null;
  const loading = pollingQuery.isFetching || wirelessQuery.isFetching;

  const refresh = () => {
    pollingQuery.refetch();
    if (showWireless) wirelessQuery.refetch();
    ping.refresh();
  };

  // Same rule the polling tab applies: with polling off, a stored verdict is
  // only a leftover, so the card says "unknown" rather than repeat it.
  const pollingOff = !monitored || pollingStatus?.pollingEnabled === false;
  const connectivity = pollingOff ? 'UNKNOWN' : (pollingStatus?.currentStatus ?? 'UNKNOWN');
  const lastPolledAt = pollingStatus?.lastPolled ?? pollingStatus?.lastResult?.timestamp ?? null;

  const m = wireless?.metrics;
  const isAP = wireless?.deviceType === 'ACCESS_POINT';
  const alertCount = wireless?.activeAlerts.length ?? 0;

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <SectionTitle>Estado del Equipo</SectionTitle>
          <IconButton icon={<RefreshIcon />} label="Actualizar" onClick={refresh} disabled={loading || ping.loading} />
        </div>
      </Card.Header>
      <Card.Body>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <HealthTile
              label="Conectividad"
              hint={pollingOff ? 'Monitoreo deshabilitado' : lastPolledAt ? `Último sondeo ${ageOf(lastPolledAt)}` : undefined}
            >
              <Badge variant={getPollingStatusBadgeVariant(connectivity)}>{CONNECTIVITY_LABELS[connectivity]}</Badge>
            </HealthTile>
            <HealthTile
              label="Fallos consecutivos"
              hint={pollingStatus && !pollingOff ? `Se marca caído tras ${pollingStatus.failuresBeforeDown}` : undefined}
            >
              <span className={pollingStatus && pollingStatus.consecutiveFailures > 0 && !pollingOff ? 'text-red-700 dark:text-red-400' : ''}>
                {pollingStatus && !pollingOff ? pollingStatus.consecutiveFailures : '—'}
              </span>
            </HealthTile>
            {showWireless && (
              <HealthTile label="Alertas inalámbricas" hint={wireless ? undefined : 'Sin lectura del radio'}>
                <span className={alertCount > 0 ? 'text-red-700 dark:text-red-400' : ''}>{wireless ? alertCount : '—'}</span>
              </HealthTile>
            )}
          </div>

          {monitored && ping.summary && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ping</h3>
                <button
                  type="button"
                  onClick={() => onOpenTab('polling')}
                  className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Ver más →
                </button>
              </div>
              <PingSummaryTiles summary={ping.summary} />
            </div>
          )}

          {showWireless && m && wireless && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Radio
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                    {ageOf(wireless.collectedAt)}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => onOpenTab('wireless')}
                  className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Ver más →
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {isAP ? (
                  <HealthTile label="Estaciones conectadas">{m.clientsConnected ?? '—'}</HealthTile>
                ) : (
                  <HealthTile label="Señal RX">
                    <span className={signalTone(m.signalRxDbm)}>{m.signalRxDbm !== null ? `${m.signalRxDbm} dBm` : '—'}</span>
                  </HealthTile>
                )}
                <HealthTile label="SNR / CCQ">
                  {m.snrDb !== null ? `${m.snrDb.toFixed(0)} dB` : '—'}
                  <span className="text-gray-400 dark:text-gray-500"> · </span>
                  {m.ccqPercent !== null ? `${m.ccqPercent.toFixed(0)}%` : '—'}
                </HealthTile>
                <HealthTile label="Tráfico ↓ / ↑">
                  <span className="text-base">{fmtBps(m.throughputRxBps)} / {fmtBps(m.throughputTxBps)}</span>
                </HealthTile>
                <HealthTile
                  label="CPU / Memoria"
                  hint={m.uptimeSeconds !== null ? `Encendido hace ${fmtUptime(m.uptimeSeconds)}` : undefined}
                >
                  {m.cpuLoadPercent !== null ? `${m.cpuLoadPercent.toFixed(0)}%` : '—'}
                  <span className="text-gray-400 dark:text-gray-500"> · </span>
                  {m.memoryUsedPercent !== null ? `${m.memoryUsedPercent.toFixed(0)}%` : '—'}
                </HealthTile>
              </div>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
