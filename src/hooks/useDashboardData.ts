import { useState, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import { DeviceStatus, AlertDTO } from '@/types/device.types';

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

export interface DashboardStats {
  total: number;
  byStatus: { status: DeviceStatus; count: number }[];
  recent: RecentDevice[];
  connectivity: ConnectivityStats;
}

interface UseDashboardDataResult {
  stats: DashboardStats | null;
  alerts: AlertDTO[];
  deviceNames: Record<string, string>;
  isLoading: boolean;
  error: string | null;
}

export function useDashboardData(): UseDashboardDataResult {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
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
        setError(recentResult.error || 'Error al cargar el panel');
        setIsLoading(false);
        return;
      }

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

      const alertsResult = await apiService.listAlerts({ limit: 5 });
      if (alertsResult.success && alertsResult.data) {
        const openAlerts = alertsResult.data.alerts.filter((a) => a.status === 'OPEN').slice(0, 5);
        setAlerts(openAlerts);

        const uniqueIds = [...new Set(openAlerts.map((a) => a.deviceId))];
        const nameEntries = await Promise.all(
          uniqueIds.map(async (id) => {
            const res = await apiService.getDevice(id);
            return [id, res.success && res.data ? res.data.name : id] as [string, string];
          })
        );
        setDeviceNames(Object.fromEntries(nameEntries));
      }

      setIsLoading(false);
    }

    load();
  }, []);

  return { stats, alerts, deviceNames, isLoading, error };
}
