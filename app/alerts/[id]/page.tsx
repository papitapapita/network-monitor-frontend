'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import {
  AlertDTO,
  AlertSeverity,
  AlertStatus,
  isDeviceUnreachable,
  isWirelessAlert,
} from '@/types/alert.types';
import { Badge, Button, Card, LoadingSpinner } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import type { BadgeVariant } from '@/components/ui';

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  WARNING: 'Advertencia',
  CRITICAL: 'Crítico',
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
};

function getSeverityVariant(severity: AlertSeverity): BadgeVariant {
  return severity === 'CRITICAL' ? 'danger' : 'warning';
}

function getStatusVariant(status: AlertStatus): BadgeVariant {
  return status === 'OPEN' ? 'danger' : 'success';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(secs: number | null): string {
  if (secs === null) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Alerts recorded before `description` existed come back with an empty string. */
function describe(alert: AlertDTO): string {
  return alert.description || alert.type;
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-gray-100">{value ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</dd>
    </div>
  );
}

export default function AlertDetailPage() {
  const router = useRouter();
  const params = useParams();
  const alertId = params.id as string;
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [alert, setAlert] = useState<AlertDTO | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await apiService.getAlert(alertId);
    if (result.success && result.data) {
      setAlert(result.data);
      const devResult = await apiService.getDevice(result.data.deviceId);
      setDeviceName(devResult.success && devResult.data ? devResult.data.name : null);
    } else {
      setError(result.error || 'Error al cargar la alerta');
    }

    setIsLoading(false);
  }, [alertId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = async () => {
    setIsRefreshing(true);
    const result = await apiService.getAlert(alertId);
    if (result.success && result.data) {
      setAlert(result.data);
    } else {
      setError(result.error || 'Error al actualizar la alerta');
    }
    setIsRefreshing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await apiService.deleteAlert(alertId);
    setIsDeleting(false);
    if (result.success) {
      router.push('/alerts');
    } else {
      setError(result.error || 'Error al eliminar la alerta');
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" message="Cargando alerta..." />
      </div>
    );
  }

  if (error && !alert) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400 mb-4">{error}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/alerts')}>Volver a Alertas</Button>
            <Button onClick={fetchData}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!alert) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar alerta"
        message={`¿Eliminar la alerta "${describe(alert)}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/alerts')}>
            ← Alertas
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{describe(alert)}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getSeverityVariant(alert.severity)}>{SEVERITY_LABELS[alert.severity]}</Badge>
              <Badge variant={getStatusVariant(alert.status)}>{STATUS_LABELS[alert.status]}</Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">{alert.source}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={refresh} isLoading={isRefreshing}>
            Actualizar
          </Button>
          {isAdmin && (
            <Button
              variant="danger"
              size="sm"
              disabled={alert.status === 'OPEN'}
              title={alert.status === 'OPEN' ? 'Solo se pueden eliminar alertas resueltas' : 'Eliminar alerta'}
              onClick={() => setShowDeleteModal(true)}
            >
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-6">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Details card */}
      <Card className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Información general</h2>
        <dl className="wrap-anywhere grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
          <DetailField label="Tipo" value={<span className="font-mono text-xs break-all">{alert.type}</span>} />
          <DetailField
            label="Dispositivo"
            value={
              <Link href={`/devices/${alert.deviceId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                {deviceName ?? alert.deviceId}
              </Link>
            }
          />
          <DetailField label="Duración" value={formatDuration(alert.durationSecs)} />
          <DetailField label="Inicio" value={formatDate(alert.startedAt)} />
          <DetailField label="Resolución" value={formatDate(alert.resolvedAt)} />
          <DetailField label="Notificada" value={formatDate(alert.notifiedAt)} />
          <DetailField label="Recuperación notificada" value={formatDate(alert.recoveryNotifiedAt)} />
        </dl>
      </Card>

      {/* Type-specific details */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Detalles</h2>
        {/* Older alerts were recorded before `details` was populated. */}
        {Object.keys(alert.details).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Sin detalles adicionales.</p>
        ) : isDeviceUnreachable(alert) ? (
          <dl className="wrap-anywhere grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Fallos consecutivos</dt>
              <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                {formatDetailValue(alert.details.consecutiveFailures)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Dirección IP</dt>
              <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                {formatDetailValue(alert.details.ipAddress)}
              </dd>
            </div>
          </dl>
        ) : isWirelessAlert(alert) ? (
          <dl className="wrap-anywhere grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Métrica</dt>
              <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                {formatDetailValue(alert.details.metric)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Severidad</dt>
              <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                {formatDetailValue(alert.details.severity)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Umbral</dt>
              <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                {formatDetailValue(alert.details.threshold)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Valor actual</dt>
              <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
                {formatDetailValue(alert.details.currentValue)}
              </dd>
            </div>
          </dl>
        ) : (
          // Unknown producer — `details` is a free-form bag, so fall back to key/value.
          <dl className="wrap-anywhere grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {Object.entries(alert.details).map(([key, value]) => (
              <div key={key}>
                <dt className="font-medium text-gray-500 dark:text-gray-400 break-all">{key}</dt>
                <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100 break-all">
                  {formatDetailValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  );
}
