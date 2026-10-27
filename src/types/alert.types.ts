import { BulkReportBuckets } from './common.types';
import { TicketStatus } from './ticket.types';

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
  /**
   * The upstream device's alert this outage is part of (NOT-240..247): set
   * on a device_unreachable alert behind a failed AP or switch, which is
   * then never notified on its own. Null on its own, or once detached.
   */
  causedByAlertId: string | null;
  /** Only on `GET /api/alerts/:id`: every device attached to this alert; [] for an ordinary one. */
  affectedDevices?: AffectedDeviceDTO[];
}

/** A device that went down behind a root alert, with how it is doing now. */
export interface AffectedDeviceDTO {
  deviceId: string;
  name: string;
  ipAddress: string | null;
  /** UP once the device answered again. */
  status: 'DOWN' | 'UP';
  /** The nearest affected device between it and the root, as the Telegram message groups them. */
  viaDeviceId: string | null;
  /** Null when it hangs straight off the root. */
  viaDeviceName: string | null;
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

/** Only the list carries `deviceName`; `GET /api/alerts/:id` returns an AlertDTO with `affectedDevices`. */
export interface AlertListItemDTO extends AlertDTO {
  /** The device's current name, so a renamed device's old alerts show the new one. */
  deviceName: string;
  /** This alert's own live ticket (OPEN, ASSIGNED or IN_PROGRESS) — not another alert's on the same device. */
  ticket: { id: string; code: number; status: TicketStatus } | null;
  /** An open alert with no ticket of its own: offer "Crear ticket" (NOT-206). Always false once resolved. */
  ticketSuggested: boolean;
  /** How many devices went down behind this one (NOT-243). */
  affectedCount: number;
}

export interface AlertListResponse {
  alerts: AlertListItemDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface ListAlertsQuery {
  deviceId?: string;
  status?: AlertStatus;
  severity?: AlertSeverity;
  limit?: number;
  offset?: number;
}
