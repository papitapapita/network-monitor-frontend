import type { SseState } from '@/services/sse';
import type { BadgeVariant } from '@/components/ui';
import type { DeviceCategory, DeviceStatus } from '@/types/device.types';
import {
  DEVICE_STATUS_LABELS,
  RETIRED_STATUSES,
  isWirelessCategory,
} from '@/constants/device.constants';

/**
 * Whether the backend will accept `enabled: true` on this device's wireless
 * config. It refuses for a device that cannot be polled at all — retired,
 * deleted, replaced, or in a category that holds no radio — while `enabled:
 * false` is never blocked and every other field stays editable.
 */
export function canEnableWirelessPolling(
  status: DeviceStatus | '' | null | undefined,
  category: DeviceCategory | null | undefined,
  device?: { deletedAt: string | null; replacedAt: string | null }
): boolean {
  if (!isWirelessCategory(category)) return false;
  if (device?.deletedAt || device?.replacedAt) return false;
  return !(RETIRED_STATUSES as string[]).includes(status ?? '');
}

/** Why wireless polling cannot be turned on, phrased for the operator — null when it can. */
export function wirelessEnableBlockedReason(
  status: DeviceStatus | '' | null | undefined,
  category: DeviceCategory | null | undefined,
  device?: { deletedAt: string | null; replacedAt: string | null }
): string | null {
  if (!isWirelessCategory(category)) {
    return 'Solo los CPE inalámbricos y los puntos de acceso pueden sondearse por radio.';
  }
  if (device?.replacedAt) {
    return 'Este equipo fue reemplazado, así que ya no se sondea. El sondeo continúa en la unidad que lo sustituyó.';
  }
  if (device?.deletedAt) {
    return 'Este dispositivo está en la papelera. Restáuralo antes de reanudar el sondeo.';
  }
  if ((RETIRED_STATUSES as string[]).includes(status ?? '')) {
    const label = DEVICE_STATUS_LABELS[status as DeviceStatus] ?? status;
    return `El sondeo inalámbrico no puede habilitarse en un equipo retirado; este está en «${label}». Cámbialo a «Comisionamiento» o «Activo» en la pestaña «Detalles» para reanudarlo.`;
  }
  return null;
}

/**
 * Retiring a device disables its wireless config on the backend's side — the
 * settings survive, only `enabled` flips — and only a move to COMMISSIONING
 * turns it back on. Restoring from the recycle bin does not, and neither does
 * going straight from a retired status to ACTIVE: after either, the operator
 * resumes polling explicitly.
 */
export const WIRELESS_DISABLED_BY_STATUS_NOTE =
  'El sondeo inalámbrico se deshabilitó porque el equipo pasó a un estado retirado. El intervalo y la capacidad se conservaron: vuelve a habilitarlo aquí cuando el equipo regrese al servicio.';

/**
 * The ICMP switches do not touch wireless: a device paused in the UI keeps
 * collecting radio snapshots. Stopping that is a separate, explicit write —
 * this config's own `enabled`.
 */
export const WIRELESS_INDEPENDENT_OF_ICMP_NOTE =
  'Pausar el monitoreo ICMP del dispositivo no detiene el sondeo inalámbrico: se controla aquí, por separado.';

/** Bits per second, as the radios report throughput. */
export function fmtBps(val: number | null | undefined): string {
  if (val == null) return '—';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} Mbps`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} Kbps`;
  return `${val} bps`;
}

/** Kilobits per second, as provisioned capacities are entered. */
export function fmtKbps(val: number | null | undefined): string {
  if (val == null) return '—';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} Gbps`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} Mbps`;
  return `${val} Kbps`;
}

/**
 * "hace 12 s" / "hace 3 min" — the age the stream reports, not a clock diff.
 * Coarsens as it grows: a reading from a radio that stopped answering last week
 * is "hace 14 d", not "hace 336 h 46 min".
 */
export function fmtAge(seconds: number): string {
  if (seconds < 60) return `hace ${Math.round(seconds)} s`;
  if (seconds < 3600) return `hace ${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 ? `hace ${hours} h ${minutes} min` : `hace ${hours} h`;
  }
  const days = Math.floor(seconds / 86_400);
  const hours = Math.round((seconds % 86_400) / 3600);
  return hours > 0 ? `hace ${days} d ${hours} h` : `hace ${days} d`;
}

/**
 * A link at 90% of its plan is saturated for the customer on it long before it
 * is "full", so the warning starts well below 100.
 */
export function utilisationVariant(percent: number | null): BadgeVariant {
  if (percent === null) return 'neutral';
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warning';
  return 'success';
}

export function utilisationBarClass(percent: number | null): string {
  if (percent === null) return 'bg-gray-300 dark:bg-gray-600';
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-green-500';
}

/**
 * The four refusals worth their own words. Everything else is the backend's
 * own message, which is already specific when it exists.
 */
export function translateStreamError(state: Extract<SseState, { status: 'error' }>): string {
  switch (state.httpStatus) {
    case 404:
      return 'Este equipo todavía no tiene lecturas: no ha sido sondeado ni una vez.';
    case 429:
      // 5 streams per user, 200 per server — the first is the one an operator
      // can act on, by closing a tab.
      return 'Demasiadas vistas en vivo abiertas (el límite es 5). Cierra alguna pestaña e inténtalo de nuevo.';
    case 401:
      return 'Sesión expirada. Inicia sesión nuevamente.';
    case 403:
      return 'No tienes permisos para ver estas métricas.';
    default:
      return state.error;
  }
}

/** Short label for the connection dot, so every live view says the same thing. */
export function streamStatusLabel(state: SseState): string {
  switch (state.status) {
    case 'connecting':
      return 'Conectando…';
    case 'live':
      return 'En vivo';
    case 'reconnecting':
      return 'Reconectando…';
    case 'error':
      return 'Sin conexión';
  }
}
