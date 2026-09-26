import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { fetchPollingStatuses, invalidatePollingStatuses } from '@/hooks/pollingStatusQuery';
import { useFleetThroughput } from '@/hooks/useWirelessThroughput';

/** Every panel refreshes on this cadence; the throughput stream is live on its own. */
const REFRESH_MS = 60_000;

/** Session-long samples of fleet traffic — about 20 min at one sample per 10 s. */
const THROUGHPUT_HISTORY_POINTS = 120;
const THROUGHPUT_SAMPLE_MS = 10_000;

export interface ThroughputPoint {
  t: number;
  bps: number;
}

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
    queryFn: async () => unwrap(await apiService.listDevices({ limit: 300 }), 'Error al cargar dispositivos'),
    refetchInterval: REFRESH_MS,
  });

  const devices = useMemo(() => devicesQuery.data?.devices ?? [], [devicesQuery.data]);
  const monitoredIds = devices.filter((d) => d.monitoringEnabled).map((d) => d.id).join(',');

  const statusQuery = useQuery({
    queryKey: ['dashboard', 'pollingStatuses', monitoredIds],
    queryFn: () => fetchPollingStatuses(queryClient, devices),
    enabled: devicesQuery.isSuccess,
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

  const locationNames = useMemo(
    () => Object.fromEntries((locationsQuery.data?.locations ?? []).map((l) => [l.id, l.name])),
    [locationsQuery.data]
  );

  const fleet = useFleetThroughput();
  const throughputHistory = useThroughputHistory(fleet.entries);

  const refresh = async () => {
    await invalidatePollingStatuses(queryClient);
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
    statuses: statusQuery.data?.byId ?? {},
    alertsQuery,
    alerts: alertsQuery.data?.alerts ?? [],
    ticketsQuery,
    tickets: ticketsQuery.data?.tickets ?? [],
    locationNames,
    fleet,
    throughputHistory,
    refresh,
    isRefreshing:
      devicesQuery.isFetching || statusQuery.isFetching || alertsQuery.isFetching || ticketsQuery.isFetching,
    lastRefreshed: updatedAt > 0 ? new Date(updatedAt) : null,
  };
}

/**
 * Fleet traffic over the time the dashboard has been open. The stream only
 * pushes current readings, so the history is built here — sampled on a fixed
 * tick so a burst of frames from many radios does not crowd the line.
 *
 * Station traffic also crosses its AP, so when any AP reports, only APs are
 * summed; otherwise the stations are all there is.
 */
function useThroughputHistory(entries: ReturnType<typeof useFleetThroughput>['entries']) {
  const [history, setHistory] = useState<ThroughputPoint[]>([]);
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    const sample = () => {
      const readings = [...entriesRef.current.values()].map((e) => e.reading).filter((r) => !r.stale);
      if (readings.length === 0) return;
      const aps = readings.filter((r) => r.deviceType === 'ACCESS_POINT');
      const bps = (aps.length > 0 ? aps : readings).reduce((sum, r) => sum + (r.throughputTotalBps ?? 0), 0);
      setHistory((prev) => [...prev, { t: Date.now(), bps }].slice(-THROUGHPUT_HISTORY_POINTS));
    };
    const first = setTimeout(sample, 1_500);
    const timer = setInterval(sample, THROUGHPUT_SAMPLE_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  return history;
}
