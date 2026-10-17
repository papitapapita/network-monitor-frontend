import type { SseState } from '../services/sse';
import type { BadgeVariant } from '../components/ui';
import type {
  NetworkSweepOutcome,
  NetworkSweepResultDTO,
  NetworkSweepSkipReason,
} from '../types/network-sweep.types';

/** Down first: after an outage, what did not answer is the news. */
export const SWEEP_OUTCOME_ORDER: Record<NetworkSweepOutcome, number> = {
  DOWN: 0,
  ERROR: 1,
  UP: 2,
  SKIPPED: 3,
};

/** ERROR reads as "unknown": the device was never asked, so it is not down. */
export const SWEEP_OUTCOME_LABELS: Record<NetworkSweepOutcome, string> = {
  UP: 'Responde',
  DOWN: 'Sin respuesta',
  ERROR: 'Desconocido',
  SKIPPED: 'Omitido',
};

export const SWEEP_OUTCOME_BADGES: Record<NetworkSweepOutcome, BadgeVariant> = {
  UP: 'success',
  DOWN: 'danger',
  ERROR: 'warning',
  SKIPPED: 'neutral',
};

export const SWEEP_SKIP_REASON_LABELS: Record<NetworkSweepSkipReason, string> = {
  MONITORING_DISABLED: 'Monitoreo desactivado',
  NO_IP_ADDRESS: 'Sin dirección IP',
  NOT_ON_MONITORED_NETWORK: 'Fuera de la red del servidor y sin agente',
};

export const skipReasonLabel = (reason: NetworkSweepSkipReason | null): string =>
  reason ? SWEEP_SKIP_REASON_LABELS[reason] ?? reason : 'Sin motivo';

/** The `detail` of an ERROR from a device behind an agent, documented in BACKEND_API.md. */
const AGENT_DETAILS: Record<string, (agent: string) => string> = {
  'The agent is not connected': (agent) => `Agente ${agent} desconectado`,
  'The agent must be updated to sweep the network': (agent) =>
    `El agente ${agent} debe actualizarse (0.7.0 o posterior) para barrer la red`,
  'The agent did not answer in time': (agent) => `El agente ${agent} no respondió a tiempo`,
};

/** Why a device could not be pinged; unknown text passes through as is. */
export function translateSweepDetail(result: Pick<NetworkSweepResultDTO, 'agentName' | 'detail'>): string {
  const detail = result.detail ?? 'No se pudo hacer ping';
  const agentLine = result.agentName ? AGENT_DETAILS[detail] : undefined;
  return agentLine ? agentLine(result.agentName!) : detail;
}

/** One line for every device an agent could not ask, instead of one row each. */
export interface AgentFailureGroup {
  key: string;
  agentName: string;
  message: string;
  devices: NetworkSweepResultDTO[];
}

/**
 * ERROR results behind an agent, grouped by agent and cause. The rest of the
 * ERRORs (the server's own ping failing) stay in the list, one row each.
 */
export function groupAgentFailures(results: NetworkSweepResultDTO[]): {
  groups: AgentFailureGroup[];
  rest: NetworkSweepResultDTO[];
} {
  const byKey = new Map<string, AgentFailureGroup>();
  const rest: NetworkSweepResultDTO[] = [];
  for (const r of results) {
    if (r.outcome !== 'ERROR' || !r.agentName) {
      rest.push(r);
      continue;
    }
    const key = `${r.agentName}\u0000${r.detail ?? ''}`;
    const group = byKey.get(key);
    if (group) group.devices.push(r);
    else byKey.set(key, { key, agentName: r.agentName, message: translateSweepDetail(r), devices: [r] });
  }
  const groups = [...byKey.values()].sort((a, b) => b.devices.length - a.devices.length);
  return { groups, rest };
}

export const devicesNotChecked = (count: number): string =>
  count === 1 ? '1 equipo sin revisar' : `${count} equipos sin revisar`;

/** A refusal before the stream opened, or the stream ending before `sweep-done`. */
export function translateSweepError(state: Extract<SseState, { status: 'error' }>): string {
  switch (state.httpStatus) {
    case 409:
      return 'Ya hay un barrido en curso. Inténtalo de nuevo en unos segundos.';
    case 403:
      return 'No tienes permisos para barrer la red.';
    case 401:
      return 'Sesión expirada. Inicia sesión nuevamente.';
    case 429:
      return 'Demasiadas solicitudes. Inténtalo de nuevo en unos segundos.';
    case 400:
      return `El filtro no es válido: ${state.error}`;
    case undefined:
      return 'El barrido se interrumpió antes de terminar. Puedes iniciarlo de nuevo.';
    default:
      return state.httpStatus >= 500
        ? 'No se pudo iniciar el barrido. Inténtalo de nuevo en un momento.'
        : state.error;
  }
}

export const fmtLatency = (ms: number | null): string =>
  ms === null ? '—' : ms < 1 ? '<1 ms' : `${Math.round(ms)} ms`;

export const fmtClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
