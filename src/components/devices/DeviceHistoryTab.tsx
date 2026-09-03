'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api.service';
import { AlertDTO, AlertSeverity } from '@/types/alert.types';
import { DeviceResponseDTO } from '@/types/device.types';
import { Card, Badge, LoadingSpinner, type BadgeVariant } from '@/components/ui';

interface Props {
  device: DeviceResponseDTO;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  dotVariant: BadgeVariant;
  title: React.ReactNode;
  subtitle?: string;
  status?: { label: string; variant: BadgeVariant };
}

function severityVariant(severity: AlertSeverity): BadgeVariant {
  return severity === 'CRITICAL' ? 'danger' : 'warning';
}

function fmtDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins > 0 ? `${hours}h ${remMins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

function alertToEntry(alert: AlertDTO): HistoryEntry {
  const isOpen = alert.status === 'OPEN';
  const duration = fmtDuration(alert.durationSecs);
  return {
    id: alert.id,
    timestamp: alert.startedAt,
    dotVariant: isOpen ? severityVariant(alert.severity) : 'neutral',
    title: alert.description,
    subtitle: alert.source,
    status: isOpen
      ? { label: 'Activa', variant: severityVariant(alert.severity) }
      : { label: duration ? `Resuelta · duró ${duration}` : 'Resuelta', variant: 'neutral' },
  };
}

/**
 * A colored dot instead of a full icon set — cheap to render, and severity
 * reads fine from color alone once it sits next to a description.
 */
function EntryDot({ variant }: { variant: BadgeVariant }) {
  const colors: Record<BadgeVariant, string> = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-400 dark:bg-gray-500',
    draft: 'bg-amber-500',
    active: 'bg-emerald-500',
  };
  return <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${colors[variant]}`} />;
}

/**
 * Replacement lineage and the device's alert history (connectivity drops from
 * polling, threshold breaches from wireless) in one read-only timeline — the
 * two used to live in different places (a banner at the top of the page, and
 * an active-only list on the Inalámbrico tab), which made "when did this last
 * go down" a multi-tab question.
 */
export function DeviceHistoryTab({ device }: Props) {
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiService.listAlerts({ deviceId: device.id, limit: 30 });
    if (result.success && result.data) {
      setAlerts(result.data.alerts);
    } else {
      setError(result.error || 'Error al cargar el historial de alertas');
    }
    setLoading(false);
  }, [device.id]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const lineageEntries: HistoryEntry[] = [];
  if (device.replacesDeviceId) {
    lineageEntries.push({
      id: 'lineage-replaces',
      timestamp: device.replacedAt ?? device.createdAt,
      dotVariant: 'info',
      title: (
        <>
          Sustituyó a{' '}
          <Link href={`/devices/${device.replacesDeviceId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
            la unidad anterior
          </Link>
        </>
      ),
      subtitle: 'Reemplazo de equipo',
    });
  }
  if (device.replacedByDeviceId) {
    lineageEntries.push({
      id: 'lineage-replaced-by',
      timestamp: device.replacedAt ?? device.updatedAt,
      dotVariant: 'info',
      title: (
        <>
          Esta unidad fue reemplazada por{' '}
          <Link href={`/devices/${device.replacedByDeviceId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
            el equipo actual
          </Link>
        </>
      ),
      subtitle: 'Reemplazo de equipo',
    });
  }

  const entries = [...lineageEntries, ...alerts.map(alertToEntry)].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Card>
      <Card.Header>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Historial</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Alertas de conectividad e inalámbricas, y reemplazos de equipo.
        </p>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner message="Cargando historial..." />
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Sin eventos registrados.</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <EntryDot variant={entry.dotVariant} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.title}</span>
                    {entry.status && <Badge variant={entry.status.variant}>{entry.status.label}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {entry.subtitle ? `${entry.subtitle} · ` : ''}
                    {new Date(entry.timestamp).toLocaleString('es')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}
