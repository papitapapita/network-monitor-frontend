'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { DeviceStatus } from '@/types/device.types';
import { Card, Badge, LoadingSpinner, getDeviceStatusBadgeVariant, getPollingStatusBadgeVariant } from '@/components/ui';

const STATUS_LABELS: Record<DeviceStatus, string> = {
  ACTIVE: 'Active',
  INVENTORY: 'Inventory',
  MAINTENANCE: 'Maintenance',
  DAMAGED: 'Damaged',
  DECOMMISSIONED: 'Decommissioned',
};

const ALL_STATUSES: DeviceStatus[] = ['ACTIVE', 'INVENTORY', 'MAINTENANCE', 'DAMAGED', 'DECOMMISSIONED'];

interface RecentDevice {
  id: string;
  name: string;
  status: DeviceStatus;
  ipAddress: string | null;
}

interface ConnectivityStats {
  total: number;
  online: number;
  offline: number;
  unknown: number;
}

interface Stats {
  total: number;
  byStatus: { status: DeviceStatus; count: number }[];
  recent: RecentDevice[];
  connectivity: ConnectivityStats;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      const [recentResult, ...statusResults] = await Promise.all([
        apiService.listDevices({ limit: 6 }),
        ...ALL_STATUSES.map((s) => apiService.listDevices({ limit: 1, status: s })),
      ]);

      if (!recentResult.success || !recentResult.data) {
        setError(recentResult.error || 'Failed to load dashboard');
        setIsLoading(false);
        return;
      }

      // Fetch monitoring-enabled devices and their connectivity status
      const monResult = await apiService.listDevices({ monitoringEnabled: true, limit: 200 });
      const connectivity: ConnectivityStats = { total: 0, online: 0, offline: 0, unknown: 0 };

      if (monResult.success && monResult.data) {
        const monDevices = monResult.data.devices;
        connectivity.total = monDevices.length;

        const pollingResults = await Promise.all(
          monDevices.map((d) => apiService.getPollingStatus(d.id))
        );

        pollingResults.forEach((r) => {
          if (r.success && r.data) {
            if (r.data.currentStatus === 'ONLINE') connectivity.online++;
            else if (r.data.currentStatus === 'OFFLINE') connectivity.offline++;
            else connectivity.unknown++;
          } else {
            connectivity.unknown++;
          }
        });
      }

      setStats({
        total: recentResult.data.total,
        byStatus: ALL_STATUSES.map((status, i) => ({
          status,
          count: statusResults[i].success ? (statusResults[i].data?.total ?? 0) : 0,
        })),
        recent: recentResult.data.devices.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          ipAddress: d.ipAddress,
        })),
        connectivity,
      });

      setIsLoading(false);
    }

    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" message="Loading dashboard..." />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const active = stats.byStatus.find((s) => s.status === 'ACTIVE')?.count ?? 0;
  const issues =
    (stats.byStatus.find((s) => s.status === 'MAINTENANCE')?.count ?? 0) +
    (stats.byStatus.find((s) => s.status === 'DAMAGED')?.count ?? 0);
  const inventory = stats.byStatus.find((s) => s.status === 'INVENTORY')?.count ?? 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Network infrastructure overview</p>
      </div>

      {/* Device lifecycle stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Devices" value={stats.total} colorClass="text-blue-600 bg-blue-50" />
        <StatCard label="Active" value={active} colorClass="text-green-600 bg-green-50" />
        <StatCard
          label="Needs Attention"
          value={issues}
          colorClass={issues > 0 ? 'text-red-600 bg-red-50' : 'text-gray-500 bg-gray-50'}
        />
        <StatCard label="Inventory" value={inventory} colorClass="text-gray-600 bg-gray-50" />
      </div>

      {/* Connectivity stat cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Connectivity — {stats.connectivity.total} monitored device{stats.connectivity.total !== 1 ? 's' : ''}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/devices?connectivity=ONLINE')}
            className="rounded-lg p-5 bg-green-50 text-left hover:bg-green-100 transition-colors"
          >
            <p className="text-3xl font-bold text-green-600">{stats.connectivity.online}</p>
            <p className="text-sm font-medium text-green-600 mt-1 opacity-75">Online</p>
          </button>
          <button
            onClick={() => router.push('/devices?connectivity=OFFLINE')}
            className="rounded-lg p-5 bg-red-50 text-left hover:bg-red-100 transition-colors"
          >
            <p className="text-3xl font-bold text-red-600">{stats.connectivity.offline}</p>
            <p className="text-sm font-medium text-red-600 mt-1 opacity-75">Offline</p>
          </button>
          <button
            onClick={() => router.push('/devices?connectivity=UNKNOWN')}
            className="rounded-lg p-5 bg-gray-50 text-left hover:bg-gray-100 transition-colors"
          >
            <p className="text-3xl font-bold text-gray-500">{stats.connectivity.unknown}</p>
            <p className="text-sm font-medium text-gray-500 mt-1 opacity-75">Unknown</p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <Card>
          <Card.Header>
            <h2 className="font-semibold text-gray-900">Devices by Status</h2>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3">
              {stats.byStatus.map(({ status, count }) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <Badge variant={getDeviceStatusBadgeVariant(status)}>
                      {STATUS_LABELS[status]}
                    </Badge>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-400 h-1.5 rounded-full transition-all"
                      style={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>

        {/* Recent devices */}
        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent Devices</h2>
              <Link href="/devices" className="text-sm text-blue-600 hover:text-blue-700">
                View all →
              </Link>
            </div>
          </Card.Header>
          <Card.Body>
            {stats.recent.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No devices yet</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {stats.recent.map((device) => (
                  <li key={device.id}>
                    <Link
                      href={`/devices/${device.id}`}
                      className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{device.name}</p>
                        <p className="text-xs text-gray-400">{device.ipAddress || 'No IP'}</p>
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
    </div>
  );
}

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className={`rounded-lg p-5 ${colorClass}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-1 opacity-75">{label}</p>
    </div>
  );
}
