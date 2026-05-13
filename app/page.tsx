'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DeviceStatus } from '@/types/device.types';
import { Card, Badge, LoadingSpinner, getDeviceStatusBadgeVariant } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { useDashboardData } from '@/hooks/useDashboardData';

const STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: 'Activo',
  INVENTORY: 'Inventario',
  DAMAGED: 'Dañado',
};

const SEVERITY_LABELS: Record<string, string> = {
  WARNING: 'Advertencia',
  CRITICAL: 'Crítico',
};

function getSeverityVariant(severity: string): BadgeVariant {
  return severity === 'CRITICAL' ? 'danger' : 'warning';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const { stats, alerts, deviceNames, isLoading, error } = useDashboardData();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" message="Cargando panel..." />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{error || 'Error desconocido'}</p>
        </div>
      </div>
    );
  }

  const active = stats.byStatus.find((s) => s.status === 'ACTIVE')?.count ?? 0;
  const issues = stats.byStatus.find((s) => s.status === 'DAMAGED')?.count ?? 0;
  const inventory = stats.byStatus.find((s) => s.status === 'INVENTORY')?.count ?? 0;
/*  const monLabel = stats.connectivity.total === 1
    ? `1 dispositivo monitoreado`
    : `${stats.connectivity.total} dispositivos monitoreados`;*/

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Panel</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Resumen de infraestructura de red</p>
      </div>

      {/* Lifecycle stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total de Dispositivos"
          value={stats.total}
          colorClass="text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
          onClick={() => router.push('/devices')}
        />
        <StatCard
          label="Activos"
          value={active}
          colorClass="text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
          onClick={() => router.push('/devices?status=ACTIVE')}
        />
        <StatCard
          label="Requiere Atención"
          value={issues}
          colorClass={issues > 0
            ? 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
            : 'text-gray-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}
          onClick={() => router.push('/devices?status=MAINTENANCE')}
        />
        <StatCard
          label="Inventario"
          value={inventory}
          colorClass="text-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => router.push('/devices?status=INVENTORY')}
        />
      </div>

      {/* Connectivity stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="En línea"
          value={stats.connectivity.online}
          colorClass="text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
          onClick={() => router.push('/devices?connectivity=ONLINE')}
        />
        <StatCard
          label="Desconectado"
          value={stats.connectivity.offline}
          colorClass="text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
          onClick={() => router.push('/devices?connectivity=OFFLINE')}
        />
        <StatCard
          label="Desconocido"
          value={stats.connectivity.unknown}
          colorClass="text-gray-500 bg-gray-50 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={() => router.push('/devices?connectivity=UNKNOWN')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status breakdown */}
        <Card>
          <Card.Header>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Dispositivos por Estado</h2>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3">
              {stats.byStatus.map(({ status, count }) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-32 shrink-0">
                    <Badge variant={getDeviceStatusBadgeVariant(status)}>
                      {STATUS_LABELS[status]}
                    </Badge>
                  </div>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-400 dark:bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-6 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>

        {/* Recent devices */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Dispositivos Recientes</h2>
              <Link href="/devices" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                Ver todos →
              </Link>
            </div>
          </Card.Header>
          <Card.Body>
            {stats.recent.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">Sin dispositivos</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {stats.recent.map((device) => (
                  <li key={device.id}>
                    <Link
                      href={`/devices/${device.id}`}
                      className="flex items-center justify-between py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 -mx-2 px-2 rounded transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{device.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {device.ipAddress || 'Sin IP'}
                        </p>
                      </div>
                      <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
                        {STATUS_LABELS[device.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Recent open alerts */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Alertas Abiertas</h2>
            <Link href="/alerts" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              Ver todas →
            </Link>
          </div>
        </Card.Header>
        <Card.Body>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">Sin alertas abiertas</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href={`/devices/${alert.deviceId}`}
                    className="flex items-center justify-between py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={getSeverityVariant(alert.severity)}>
                        {SEVERITY_LABELS[alert.severity]}
                      </Badge>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {deviceNames[alert.deviceId] ?? alert.deviceId}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(alert.startedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  colorClass,
  onClick,
  className,
}: {
  label: string;
  value: number;
  colorClass: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg p-3 sm:p-5 text-left transition-colors cursor-pointer overflow-hidden ${colorClass}${className ? ` ${className}` : ''}`}
    >
      <p className="text-2xl sm:text-3xl font-bold">{value}</p>
      <p className="text-xs sm:text-sm font-medium mt-1 opacity-75 leading-tight">{label}</p>
    </button>
  );
}
