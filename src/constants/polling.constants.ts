/** No polling of any kind may be scheduled less than once a day. */
export const INTERVAL_MAX_SECONDS = 24 * 60 * 60;

/** Bounds for device connectivity polling. */
export const POLLING_INTERVAL_MIN_SECONDS = 5;

/** Wireless monitoring is heavier per poll, so it floors higher. */
export const WIRELESS_INTERVAL_MIN_SECONDS = 60;

export const FAILURES_BEFORE_DOWN_MIN = 1;
export const FAILURES_BEFORE_DOWN_MAX = 100;

/**
 * Validates a polling interval entered as free text. Returns an error message,
 * or null when the value is acceptable (an empty value defers to the backend default).
 */
export function validateIntervalSeconds(
  raw: string,
  { min, max }: { min: number; max?: number }
): string | null {
  const value = raw.trim();
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isInteger(seconds)) return 'El intervalo debe ser un número entero de segundos';
  if (seconds < min) return `El intervalo debe ser de al menos ${fmtInterval(min)}`;
  if (max !== undefined && seconds > max) {
    return `El intervalo no puede superar ${fmtInterval(max)}`;
  }
  return null;
}

/** Units an interval can be entered in, largest first. */
export const INTERVAL_UNITS = [
  { value: '3600', label: 'horas', short: 'h' },
  { value: '60', label: 'minutos', short: 'min' },
  { value: '1', label: 'segundos', short: 's' },
] as const;

/** The largest unit that divides the interval exactly, so 21600 reads as 6 horas, 90 as 90 segundos. */
export function intervalUnitFor(seconds: number): number {
  const unit = INTERVAL_UNITS.find((u) => seconds > 0 && seconds % Number(u.value) === 0);
  return Number(unit?.value ?? 1);
}

/** Exact, unlike fmtDuration: 5400 → "1 h 30 min", 90 → "1 min 30 s", 21600 → "6 h". */
export function fmtInterval(seconds: number): string {
  let rest = Math.round(seconds);
  const parts: string[] = [];
  for (const unit of INTERVAL_UNITS) {
    const size = Number(unit.value);
    const amount = Math.floor(rest / size);
    if (amount > 0) parts.push(`${amount} ${unit.short}`);
    rest -= amount * size;
  }
  return parts.length ? parts.join(' ') : '0 s';
}

/** Validates a consecutive-failure threshold. Returns an error message, or null when acceptable. */
export function validateFailuresBeforeDown(value: number | string): string | null {
  const raw = typeof value === 'string' ? value.trim() : value;
  if (raw === '') return null;
  const failures = Number(raw);
  if (!Number.isInteger(failures)) return 'Los fallos antes de caída deben ser un número entero';
  if (failures < FAILURES_BEFORE_DOWN_MIN) {
    return `Debe ser al menos ${FAILURES_BEFORE_DOWN_MIN}`;
  }
  if (failures > FAILURES_BEFORE_DOWN_MAX) {
    return `No puede superar ${FAILURES_BEFORE_DOWN_MAX}`;
  }
  return null;
}
