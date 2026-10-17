import type { DeviceCategory } from './device.types';

/**
 * An on-demand ping of every in-service device (MON-080 … MON-084), from
 * `GET /api/network/sweep/stream`. A snapshot only: the backend stores none of
 * it and no device status, ping history or alert changes because of it.
 */

/** ERROR means the device could not be pinged at all — not that it is down. */
export type NetworkSweepOutcome = 'UP' | 'DOWN' | 'ERROR' | 'SKIPPED';

export type NetworkSweepSkipReason =
  | 'MONITORING_DISABLED'
  | 'NO_IP_ADDRESS'
  /** The server is off site and the device has no agent. */
  | 'NOT_ON_MONITORED_NETWORK';

export interface NetworkSweepFilters {
  locationId?: string;
  category?: DeviceCategory;
}

export interface NetworkSweepStartDTO {
  startedAt: string;
  /** Every device that will get a result, skipped ones included. */
  total: number;
  /** How many of them are actually pinged — the progress bar's length. */
  toPing: number;
  filters: { locationId?: string; category?: string };
}

export interface NetworkSweepResultDTO {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  category: DeviceCategory | null;
  locationId: string | null;
  locationName: string | null;
  /** The on-site agent that pinged it; null when the server did. */
  agentName: string | null;
  outcome: NetworkSweepOutcome;
  /** UP only. */
  latencyMs: number | null;
  /** Pings sent: 1–3; 0 when skipped. */
  attempts: number;
  /** SKIPPED only. */
  reason: NetworkSweepSkipReason | null;
  /** English: why it was skipped, or why it could not be pinged. See `translateSweepDetail`. */
  detail: string | null;
  at: string;
}

export interface NetworkSweepSummaryDTO {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  total: number;
  up: number;
  down: number;
  error: number;
  skipped: number;
  /** Always false: a stopped sweep sends no summary. */
  cancelled: false;
}
