import type { SseState } from '../services/sse';

export const PING_DEFAULT_COUNT = 4;
export const PING_MAX_COUNT = 100;

/** The "from" picker's value for the server itself. */
export const PING_FROM_SERVER = 'server';

/** Which field a refusal belongs under; `null` shows it above the output. */
export type PingErrorField = 'ip' | 'count' | 'from' | null;

export function translatePingError(state: Extract<SseState, { status: 'error' }>): {
  field: PingErrorField;
  message: string;
} {
  switch (state.httpStatus) {
    case 400:
      if (/^ip\b/i.test(state.error)) return { field: 'ip', message: 'Escribe una dirección IPv4 o IPv6 válida.' };
      if (/count/i.test(state.error)) return { field: 'count', message: `Entre 1 y ${PING_MAX_COUNT} pings.` };
      if (/agent/i.test(state.error)) return { field: 'from', message: 'Elige un agente válido.' };
      return { field: null, message: state.error };
    case 404:
      return /agent not found/i.test(state.error)
        ? { field: 'from', message: 'Ese agente ya no existe. Elige otro de la lista.' }
        : { field: null, message: 'El servidor no tiene la herramienta de ping. Puede que necesite actualizarse.' };
    case 409:
      return /too many/i.test(state.error)
        ? { field: null, message: 'Hay demasiados pings en curso. Inténtalo de nuevo en un momento.' }
        : { field: 'from', message: 'Este servidor no está en la red del ISP: elige un agente desde el cual hacer ping.' };
    case 403:
      return { field: null, message: 'No tienes permisos para hacer ping.' };
    case 401:
      return { field: null, message: 'Sesión expirada. Inicia sesión nuevamente.' };
    case 429:
      return { field: null, message: 'Demasiadas solicitudes. Inténtalo de nuevo en unos segundos.' };
    case undefined:
      return { field: null, message: 'Se perdió la conexión antes de terminar.' };
    default:
      return {
        field: null,
        message: state.httpStatus >= 500 ? 'No se pudo iniciar el ping. Inténtalo de nuevo en un momento.' : state.error,
      };
  }
}

/** Agent problems come in English from the backend; the common ones get Spanish words. */
export function translatePingDetail(detail: string | null): string {
  if (!detail) return 'No se pudo enviar el ping';
  if (/not connected/i.test(detail)) return 'El agente no está conectado';
  if (/must be updated/i.test(detail)) return 'El agente debe actualizarse para hacer ping';
  if (/did not answer in time/i.test(detail)) return 'El agente no respondió a tiempo';
  return detail;
}

export const fmtPingMs = (ms: number | null): string =>
  ms === null ? '—' : ms < 10 ? ms.toFixed(1) : String(Math.round(ms));
