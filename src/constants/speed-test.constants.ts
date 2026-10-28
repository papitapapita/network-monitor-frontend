import type { SseState } from '../services/sse';
import type { SpeedTestPhase } from '../types/speed-test.types';

export const SPEED_TEST_PAGE_SIZE = 20;

export const SPEED_TEST_PHASE_LABELS: Record<SpeedTestPhase, string> = {
  LATENCY: 'Midiendo latencia…',
  DOWNLOAD: 'Midiendo descarga…',
  UPLOAD: 'Midiendo subida…',
};

export function translateSpeedTestError(state: Extract<SseState, { status: 'error' }>): string {
  switch (state.httpStatus) {
    case 409:
      // The other 409 is an off-site server, where the page is not reachable at all.
      return /already running/i.test(state.error)
        ? 'Ya hay un test de velocidad en curso. Inténtalo de nuevo en unos segundos.'
        : 'Este servidor no está en la red del ISP, así que su test de velocidad no la mediría.';
    case 403:
      return 'No tienes permisos para correr el test de velocidad.';
    case 401:
      return 'Sesión expirada. Inicia sesión nuevamente.';
    case 429:
      return 'Demasiadas solicitudes. Inténtalo de nuevo en unos segundos.';
    case undefined:
      return 'El test se interrumpió antes de terminar y no se guardó. Puedes correrlo de nuevo.';
    default:
      return state.httpStatus >= 500
        ? 'No se pudo iniciar el test. Inténtalo de nuevo en un momento.'
        : state.error;
  }
}

export const fmtMbps = (mbps: number | null): string =>
  mbps === null ? '—' : mbps < 10 ? mbps.toFixed(1) : String(Math.round(mbps));

export const fmtMs = (ms: number | null): string =>
  ms === null ? '—' : ms < 10 ? ms.toFixed(1) : String(Math.round(ms));

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
