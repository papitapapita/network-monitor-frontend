import { QuietHoursMode } from '@/types/notification-policy.types';

export const ALERT_DELAY_MINUTES_MIN = 0;

/** The three-option control BACKEND_API.md suggests for NOT-170. */
export const QUIET_HOURS_MODE_OPTIONS: { value: QuietHoursMode; label: string }[] = [
  { value: 'INHERIT', label: 'Horario de la red' },
  { value: 'CUSTOM', label: 'Horario propio' },
  { value: 'ALWAYS_NOTIFY', label: 'Notificar siempre' },
];

export const QUIET_HOURS_MODE_LABELS: Record<QuietHoursMode, string> = Object.fromEntries(
  QUIET_HOURS_MODE_OPTIONS.map((o) => [o.value, o.label])
) as Record<QuietHoursMode, string>;

/** `22:00–07:00`, or null when there is no window. */
export function formatQuietHours(start: string | null, end: string | null): string | null {
  return start && end ? `${start}–${end}` : null;
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Both-or-neither, each a zero-padded 24-hour `HH:mm`, and never equal — the
 * same three rules the backend's `QuietHours` value object enforces
 * (business-rules/notifications.md, NOT-171). A `start > end` window is valid:
 * it wraps past midnight.
 */
export function validateQuietHours(start: string, end: string): string | null {
  const hasStart = start.trim() !== '';
  const hasEnd = end.trim() !== '';
  if (!hasStart && !hasEnd) return null;
  if (hasStart !== hasEnd) {
    return 'Debes indicar hora de inicio y fin, o dejar ambas vacías';
  }
  if (!TIME_REGEX.test(start) || !TIME_REGEX.test(end)) {
    return 'La hora debe tener el formato HH:mm (24 horas)';
  }
  if (start === end) {
    return 'La hora de inicio y fin no pueden ser iguales';
  }
  return null;
}

/** Validates the per-device alert-delay override. Empty clears it back to the system default. */
export function validateAlertDelayMinutes(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) return 'El retraso debe ser un número entero de minutos';
  if (minutes < ALERT_DELAY_MINUTES_MIN) return `Debe ser al menos ${ALERT_DELAY_MINUTES_MIN}`;
  return null;
}
