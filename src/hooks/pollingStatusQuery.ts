import { apiService } from '@/services/api.service';
import type { PollingStatusDTO } from '@/types/polling.types';

/**
 * Every monitored device's polling status, keyed by device, from one request
 * (`GET /api/devices/polling/statuses`). Devices with polling turned off are
 * left out; a never-polled one comes back `UNKNOWN`, as the API counts it.
 */
export async function fetchPollingStatuses(): Promise<Record<string, PollingStatusDTO>> {
  const result = await apiService.getPollingStatuses();
  if (!result.success || !result.data) throw new Error(result.error || 'Error al cargar el estado de sondeo');
  return Object.fromEntries(result.data.filter((s) => s.pollingEnabled).map((s) => [s.deviceId, s]));
}
