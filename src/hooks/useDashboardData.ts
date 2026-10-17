import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { fetchPollingStatuses } from '@/hooks/pollingStatusQuery';
import { fetchAllDevices } from '@/hooks/useCatalogs';
import { useFleetThroughput } from '@/hooks/useWirelessThroughput';

/** Every panel refreshes on this cadence; the throughput stream is live on its own. */
const REFRESH_MS = 60_000;

function unwrap<T>(result: { success: boolean; data?: T; error?: string }, fallback: string): T {
  if (!result.success || !result.data) throw new Error(result.error || fallback);
  return result.data;
}

/**
 * The dashboard's reads. Each is its own query so a slow or failing one only
 * blanks its own panels — the old page waited on all of them and showed an
 * error for everything when any one failed.
 */
export function useDashboardData() {
  const queryClient = useQueryClient();

  const devicesQuery = useQuery({
    queryKey: ['dashboard', 'devices'],
    // Every page: the counts are fleet-wide, and one page silently capped them.
    queryFn: fetchAllDevices,
    refetchInterval: REFRESH_MS,
  });

  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);

  const statusQuery = useQuery({
    queryKey: ['dashboard', 'pollingStatuses'],
    queryFn: fetchPollingStatuses,
    refetchInterval: REFRESH_MS,
  });

  const alertsQuery = useQuery({
    queryKey: ['dashboard', 'alerts'],
    // Newest first; 300 covers the 14-day window on any normal fortnight.
    queryFn: async () => unwrap(await apiService.listAlerts({ limit: 300 }), 'Error al cargar alertas'),
    refetchInterval: REFRESH_MS,
  });

  const ticketsQuery = useQuery({
    queryKey: ['dashboard', 'tickets'],
    queryFn: async () =>
      unwrap(await apiService.listTickets({ openOnly: true, limit: 100 }), 'Error al cargar tickets'),
    refetchInterval: REFRESH_MS,
  });

  const locationsQuery = useQuery({
    queryKey: ['dashboard', 'locations'],
    queryFn: async () => unwrap(await apiService.listLocations({ limit: 100 }), 'Error al cargar ubicaciones'),
    staleTime: 5 * 60_000,
  });

  // Alerts outlive their device; one whose device was removed is nothing to act
  // on. Held back until the device list is in, since that is what says which
  // devices are live.
  const alerts = useMemo(() => {
    if (!devicesQuery.isSuccess) return [];
    const live = new Set(devices.map((d) => d.id));
    return (alertsQuery.data?.alerts ?? []).filter((a) => live.has(a.deviceId));
  }, [devicesQuery.isSuccess, devices, alertsQuery.data]);

  const locationNames = useMemo(
    () => Object.fromEntries((locationsQuery.data?.locations ?? []).map((l) => [l.id, l.name])),
    [locationsQuery.data]
  );

  const fleet = useFleetThroughput();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const updatedAt = Math.max(
    devicesQuery.dataUpdatedAt,
    alertsQuery.dataUpdatedAt,
    ticketsQuery.dataUpdatedAt,
    statusQuery.dataUpdatedAt
  );

  return {
    devicesQuery,
    devices,
    statusQuery,
    statuses: statusQuery.data ?? {},
    alertsQuery,
    alerts,
    ticketsQuery,
    tickets: ticketsQuery.data?.tickets ?? [],
    locationNames,
    fleet,
    refresh,
    isRefreshing:
      devicesQuery.isFetching || statusQuery.isFetching || alertsQuery.isFetching || ticketsQuery.isFetching,
    lastRefreshed: updatedAt > 0 ? new Date(updatedAt) : null,
  };
}
