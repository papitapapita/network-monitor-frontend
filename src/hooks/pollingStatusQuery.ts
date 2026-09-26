import type { QueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import type { DeviceResponseDTO } from '@/types/device.types';
import type { PollingStatusDTO } from '@/types/polling.types';

/**
 * How long a device's polling status is reused before it is asked for again.
 * There is no bulk endpoint, so every monitored device costs one request
 * against the backend's 100/min read budget for that route — without this,
 * each page, sort, filter change or dashboard refresh re-spends it and the
 * tail comes back 429.
 */
const POLLING_STATUS_STALE_MS = 30_000;

/** Shared by the device list and the dashboard, so one reading serves both. */
export const POLLING_STATUS_KEY = 'pollingStatus';

export interface PollingStatusBatch {
  byId: Record<string, PollingStatusDTO>;
  /**
   * Monitored devices with no polling record yet (the endpoint 404s). The API
   * counts a never-polled device as UNKNOWN, so callers should too.
   */
  unpolled: string[];
  /** Monitored devices whose status could not be fetched (usually a 429). */
  failed: number;
}

/** Fetches (or reuses) the polling status of every monitored device in `devices`. */
export async function fetchPollingStatuses(
  queryClient: QueryClient,
  devices: DeviceResponseDTO[]
): Promise<PollingStatusBatch> {
  const monitored = devices.filter((d) => d.monitoringEnabled);
  if (monitored.length === 0) return { byId: {}, unpolled: [], failed: 0 };

  const results = await Promise.allSettled(
    monitored.map((d) =>
      queryClient.fetchQuery({
        queryKey: [POLLING_STATUS_KEY, d.id],
        queryFn: async (): Promise<PollingStatusDTO | null> => {
          const result = await apiService.getPollingStatus(d.id);
          if (result.status === 404) return null;
          // Thrown rather than returned so a refusal is never cached as a reading.
          if (!result.success || !result.data) throw new Error(result.error || 'polling status');
          return result.data;
        },
        staleTime: POLLING_STATUS_STALE_MS,
        retry: false,
      })
    )
  );

  const byId: Record<string, PollingStatusDTO> = {};
  const unpolled: string[] = [];
  let failed = 0;
  monitored.forEach((d, i) => {
    const r = results[i];
    if (r.status === 'rejected') failed++;
    else if (r.value === null) unpolled.push(d.id);
    else byId[d.id] = r.value;
  });
  return { byId, unpolled, failed };
}

/** Marks every cached reading stale, so an explicit refresh shows current ones. */
export function invalidatePollingStatuses(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: [POLLING_STATUS_KEY], refetchType: 'none' });
}
