/** The system default when a device carries no override (BACKEND_API.md: `DEVICE_DOWN_ALERT_DELAY_MINUTES`). */
export const DEFAULT_ALERT_DELAY_MINUTES = 60;

export const ALERT_DELAY_MINUTES_MIN = 0;

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
