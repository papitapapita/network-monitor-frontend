import type { AlertDTO, AlertSeverity } from '@/types/alert.types';
import type { DeviceResponseDTO, DeviceStatus } from '@/types/device.types';
import type { PollingStatusDTO } from '@/types/polling.types';
import type { TicketDTO, TicketPriority } from '@/types/ticket.types';
import { isDeviceUnreachable } from '@/types/alert.types';
import { todayISODate } from '@/constants/ticket.constants';

/**
 * Pure derivations for the dashboard. Everything here is computed from four
 * list reads plus the (cached) per-device polling statuses, so the page costs a
 * bounded number of requests however many widgets it shows.
 */

export const ALERT_WINDOW_DAYS = 14;

// ------------------------------------------------------------------
// Connectivity
// ------------------------------------------------------------------

export interface ConnectivitySummary {
  online: number;
  offline: number;
  unknown: number;
  unmonitored: number;
  /** Monitored devices whose status could not be read — shown, never folded into "unknown". */
  unread: number;
  monitored: number;
}

export function summarizeConnectivity(
  devices: DeviceResponseDTO[],
  statuses: Record<string, PollingStatusDTO>,
  unread: number
): ConnectivitySummary {
  const summary: ConnectivitySummary = { online: 0, offline: 0, unknown: 0, unmonitored: 0, unread, monitored: 0 };
  for (const d of devices) {
    if (!d.monitoringEnabled) {
      summary.unmonitored++;
      continue;
    }
    summary.monitored++;
    const status = statuses[d.id]?.currentStatus;
    if (status === 'ONLINE') summary.online++;
    else if (status === 'OFFLINE') summary.offline++;
    // No reading at all is UNKNOWN too, unless the read itself failed (counted in `unread`).
    else summary.unknown++;
  }
  summary.unknown = Math.max(0, summary.unknown - unread);
  return summary;
}

// ------------------------------------------------------------------
// Problems: what needs the operator right now
// ------------------------------------------------------------------

export interface Problem {
  key: string;
  kind: 'down' | 'alert';
  severity: AlertSeverity;
  deviceId: string;
  deviceName: string;
  locationName: string | null;
  title: string;
  detail: string | null;
  /** ISO instant the problem started, when known. */
  since: string | null;
}

const isOpen = (a: AlertDTO) => a.status === 'OPEN';

export function buildProblems(
  devices: DeviceResponseDTO[],
  statuses: Record<string, PollingStatusDTO>,
  alerts: AlertDTO[],
  locationNames: Record<string, string>
): Problem[] {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const openAlerts = alerts.filter(isOpen);
  const location = (d: DeviceResponseDTO | undefined) =>
    d?.locationId ? locationNames[d.locationId] ?? null : null;

  const problems: Problem[] = [];
  const downIds = new Set<string>();

  for (const d of devices) {
    const status = statuses[d.id];
    if (status?.currentStatus !== 'OFFLINE') continue;
    downIds.add(d.id);
    // The open unreachable alert is the only record of when the outage began.
    const alert = openAlerts.find((a) => a.deviceId === d.id && isDeviceUnreachable(a));
    const failures = status.consecutiveFailures;
    problems.push({
      key: `down:${d.id}`,
      kind: 'down',
      severity: 'CRITICAL',
      deviceId: d.id,
      deviceName: d.name,
      locationName: location(d),
      title: 'Sin respuesta',
      detail: [d.ipAddress, failures > 0 ? `${failures} sondeo${failures === 1 ? '' : 's'} fallido${failures === 1 ? '' : 's'}` : null]
        .filter(Boolean)
        .join(' · ') || null,
      since: alert?.startedAt ?? null,
    });
  }

  for (const a of openAlerts) {
    // Already listed as down — the alert would only repeat it.
    if (isDeviceUnreachable(a) && downIds.has(a.deviceId)) continue;
    const d = byId.get(a.deviceId);
    problems.push({
      key: `alert:${a.id}`,
      kind: 'alert',
      severity: a.severity,
      deviceId: a.deviceId,
      deviceName: d?.name ?? 'Dispositivo eliminado',
      locationName: location(d),
      title: a.description || a.type,
      detail: a.source || null,
      since: a.startedAt,
    });
  }

  const rank = (s: AlertSeverity) => (s === 'CRITICAL' ? 0 : 1);
  return problems.sort((x, y) => {
    if (rank(x.severity) !== rank(y.severity)) return rank(x.severity) - rank(y.severity);
    // Longest-running first: the oldest problem is the one being ignored.
    return (x.since ?? '9999').localeCompare(y.since ?? '9999');
  });
}

// ------------------------------------------------------------------
// Alert history
// ------------------------------------------------------------------

export interface AlertDay {
  /** 'YYYY-MM-DD' in the operator's timezone. */
  day: string;
  critical: number;
  warning: number;
}

function localDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function windowStart(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (ALERT_WINDOW_DAYS - 1));
  return start;
}

export function alertsByDay(alerts: AlertDTO[], now = new Date()): AlertDay[] {
  const start = windowStart(now);
  const days: AlertDay[] = [];
  const index = new Map<string, AlertDay>();
  for (let i = 0; i < ALERT_WINDOW_DAYS; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const entry = { day: localDayKey(date), critical: 0, warning: 0 };
    days.push(entry);
    index.set(entry.day, entry);
  }
  for (const a of alerts) {
    const entry = index.get(localDayKey(new Date(a.startedAt)));
    if (!entry) continue;
    if (a.severity === 'CRITICAL') entry.critical++;
    else entry.warning++;
  }
  return days;
}

export interface RankedDevice {
  deviceId: string;
  name: string;
  value: number;
}

/** Devices that raised the most alerts inside the window. */
export function noisiestDevices(
  alerts: AlertDTO[],
  devices: DeviceResponseDTO[],
  limit = 6,
  now = new Date()
): RankedDevice[] {
  const since = windowStart(now).toISOString();
  const names = new Map(devices.map((d) => [d.id, d.name]));
  const counts = new Map<string, number>();
  for (const a of alerts) {
    if (a.startedAt < since) continue;
    counts.set(a.deviceId, (counts.get(a.deviceId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([deviceId, value]) => ({ deviceId, name: names.get(deviceId) ?? 'Dispositivo eliminado', value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Mean time to resolve, over alerts resolved inside the window. */
export function meanResolveSeconds(alerts: AlertDTO[], now = new Date()): number | null {
  const since = windowStart(now).toISOString();
  const durations = alerts
    .filter((a) => a.startedAt >= since && a.durationSecs != null && a.status === 'RESOLVED')
    .map((a) => a.durationSecs as number);
  if (durations.length === 0) return null;
  return durations.reduce((s, v) => s + v, 0) / durations.length;
}

// ------------------------------------------------------------------
// Latency
// ------------------------------------------------------------------

export interface LatencyRow {
  deviceId: string;
  name: string;
  /** Null when the last ping failed. */
  latencyMs: number | null;
}

/** The last ping of each monitored device, slowest (and silent) first. */
export function latencyRows(
  devices: DeviceResponseDTO[],
  statuses: Record<string, PollingStatusDTO>,
  limit = 8
): LatencyRow[] {
  const rows: LatencyRow[] = [];
  for (const d of devices) {
    const last = statuses[d.id]?.lastResult;
    if (!last) continue;
    rows.push({ deviceId: d.id, name: d.name, latencyMs: last.status === 'SUCCESS' ? last.metrics?.latencyMs ?? null : null });
  }
  return rows
    .sort((a, b) => (b.latencyMs ?? Infinity) - (a.latencyMs ?? Infinity))
    .slice(0, limit);
}

// ------------------------------------------------------------------
// Tickets
// ------------------------------------------------------------------

export interface TicketSummary {
  open: number;
  unassigned: number;
  byPriority: Record<TicketPriority, number>;
  today: TicketDTO[];
  /** Scheduled before today and still open. */
  overdue: number;
}

export function summarizeTickets(tickets: TicketDTO[]): TicketSummary {
  const today = todayISODate();
  const byPriority: Record<TicketPriority, number> = { URGENT: 0, HIGH: 0, NORMAL: 0, LOW: 0 };
  let unassigned = 0;
  let overdue = 0;
  for (const t of tickets) {
    byPriority[t.priority]++;
    if (!t.technicianId) unassigned++;
    if (t.scheduledFor && t.scheduledFor < today) overdue++;
  }
  return {
    open: tickets.length,
    unassigned,
    byPriority,
    overdue,
    today: tickets
      .filter((t) => t.scheduledFor === today)
      .sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99')),
  };
}

// ------------------------------------------------------------------
// Inventory
// ------------------------------------------------------------------

export function countByStatus(devices: DeviceResponseDTO[]): Record<DeviceStatus, number> {
  const counts = {} as Record<DeviceStatus, number>;
  for (const d of devices) counts[d.status] = (counts[d.status] ?? 0) + 1;
  return counts;
}

// ------------------------------------------------------------------
// Formatting
// ------------------------------------------------------------------

/** "3 d 4 h" / "2 h 10 min" / "5 min" — a duration, not an age. */
export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(seconds / 86_400);
  const h = Math.round((seconds % 86_400) / 3600);
  return h > 0 ? `${d} d ${h} h` : `${d} d`;
}
