import { BulkReportBuckets } from './common.types';

export type AlertSeverity = 'WARNING' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'RESOLVED';

export interface AlertDTO {
  id: string;
  deviceId: string;
  severity: AlertSeverity;
  /** Human-readable origin, e.g. "Disponibilidad" or "Enlace inalámbrico". */
  source: string;
  /** Machine discriminator; at most one OPEN alert per (deviceId, type). */
  type: string;
  description: string;
  /** Producer-specific payload — shape varies by source, see the guards below. */
  details: Record<string, unknown>;
  status: AlertStatus;
  startedAt: string;
  resolvedAt: string | null;
  notifiedAt: string | null;
  recoveryNotifiedAt: string | null;
  durationSecs: number | null;
}

/** `details` payload of a `device_unreachable` alert. */
export interface DeviceUnreachableDetails {
  consecutiveFailures: number;
  ipAddress: string | null;
}

/** `details` payload of a `wireless:<metric>:<severity>` alert. */
export interface WirelessAlertDetails {
  metric: string;
  severity: AlertSeverity;
  threshold: number;
  currentValue: number;
}

export function isDeviceUnreachable(
  alert: AlertDTO
): alert is AlertDTO & { details: Record<string, unknown> & DeviceUnreachableDetails } {
  return alert.type === 'device_unreachable';
}

export function isWirelessAlert(
  alert: AlertDTO
): alert is AlertDTO & { details: Record<string, unknown> & WirelessAlertDetails } {
  return alert.type.startsWith('wireless:');
}

/**
 * Bulk clear takes either an explicit id list (any device) or one `deviceId`,
 * which clears every alert currently OPEN on it — never both, never neither.
 */
export type BulkClearAlertsRequest = { ids: string[] } | { deviceId: string };

export interface BulkClearAlertsResult extends BulkReportBuckets {
  cleared: AlertDTO[];
}

export interface BulkDeleteAlertsResult extends BulkReportBuckets {
  /** Ids actually removed. An alert still OPEN lands in `skipped`, not here. */
  deleted: string[];
}

export interface AlertListResponse {
  alerts: AlertDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface ListAlertsQuery {
  deviceId?: string;
  limit?: number;
  offset?: number;
}
