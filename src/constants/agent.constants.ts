import { AgentDTO, AgentStatus, AgentUpdateOutcome } from '../types/agent.types';
import type { BadgeVariant } from '@/components/ui';

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  PENDING: 'Pendiente',
  ACTIVE: 'Activo',
  REVOKED: 'Revocado',
};

/** Matches the backend's `AgentName` bounds. */
export const AGENT_NAME_MAX_LENGTH = 60;

/** Named in the install steps when the server has no installer to offer. */
export const WINDOWS_INSTALLER_FILE = 'nms-agent-setup-<versión>.exe';
export const LINUX_INSTALLER_FILE = 'nms-agent-<versión>-linux-x64.tar.gz';

/**
 * What the operator should read off an agent at a glance. Offline and an
 * expired key are states the backend does not name in `status` — an offline
 * agent is still ACTIVE, an expired one still PENDING — but they are what
 * decides the next action, so they win the badge.
 */
export type AgentCondition = 'ONLINE' | 'OFFLINE' | 'NEVER_CONNECTED' | 'PENDING' | 'KEY_EXPIRED' | 'REVOKED';

export function agentCondition(agent: AgentDTO, now: number = Date.now()): AgentCondition {
  if (agent.status === 'REVOKED') return 'REVOKED';
  if (agent.status === 'PENDING') {
    return agent.pairingExpiresAt && Date.parse(agent.pairingExpiresAt) <= now ? 'KEY_EXPIRED' : 'PENDING';
  }
  if (agent.offlineSince) return 'OFFLINE';
  // Paired, but the service has not opened its connection yet — normal for
  // the first seconds after install, and not yet "offline" (that takes 5 min).
  if (!agent.lastSeenAt) return 'NEVER_CONNECTED';
  return 'ONLINE';
}

export const AGENT_CONDITION_LABELS: Record<AgentCondition, string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Sin conexión',
  NEVER_CONNECTED: 'Emparejado, sin conectar',
  PENDING: 'Esperando instalación',
  KEY_EXPIRED: 'Clave vencida',
  REVOKED: 'Revocado',
};

export const AGENT_CONDITION_VARIANTS: Record<AgentCondition, BadgeVariant> = {
  ONLINE: 'success',
  OFFLINE: 'danger',
  NEVER_CONNECTED: 'info',
  PENDING: 'draft',
  KEY_EXPIRED: 'warning',
  REVOKED: 'neutral',
};

export const formatAgentDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('es') : '—';

/** "hace 3 min" — how long ago the agent last reported. */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/** "adelantado 2 min" / "atrasado 45 s" — positive offset means the PC clock runs ahead. */
export function formatClockOffset(ms: number): string {
  const direction = ms >= 0 ? 'adelantado' : 'atrasado';
  const seconds = Math.round(Math.abs(ms) / 1000);
  const amount = seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
  return `${direction} ${amount}`;
}

/** Where a device is polled from, for pickers and summaries. */
export const SERVER_POLLER_LABEL = 'Servidor (sin agente)';

/**
 * The agent endpoints give each status one meaning, so the Spanish message is
 * chosen by status rather than by matching the English prose, which the
 * backend is free to reword.
 */
export function translateAgentError(
  action: 'create' | 'rekey' | 'revoke' | 'get' | 'assign',
  status: number | undefined,
  error: string | undefined
): string {
  if (status === 503) {
    return 'El servidor no tiene configurada su dirección pública para agentes (AGENT_PUBLIC_URL), así que no puede emitir claves de emparejamiento. Pídele al proveedor que la configure.';
  }
  if (status === 404) {
    return action === 'assign'
      ? 'El agente de destino ya no existe.'
      : 'El agente ya no existe.';
  }
  if (status === 409) {
    if (action === 'create') return 'Ya existe un agente con ese nombre (los revocados también cuentan). Elige otro.';
    if (action === 'rekey') return 'Solo se puede emitir una clave nueva a un agente pendiente. Este agente ya se emparejó o fue revocado.';
    if (action === 'revoke') return 'Este agente ya estaba revocado.';
  }
  if (status === 400 && action === 'assign' && error && /revoked/i.test(error)) {
    return 'No se pueden asignar dispositivos a un agente revocado.';
  }
  return error || 'Error al comunicarse con el servidor';
}

/** Shown where a new pairing key would be issued, on an install without AGENT_PUBLIC_URL (the backend answers 503). */
export const PAIRING_UNAVAILABLE_MESSAGE =
  'Esta instalación no puede emitir claves de emparejamiento: falta configurar la dirección pública del servidor para agentes (AGENT_PUBLIC_URL).';

/** "3 h 12 min" — how long an outage lasted. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return 'menos de 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} d ${hours % 24} h` : `${days} d`;
}

/**
 * Why a manual poll through the device's agent gave no reading (MON-022,
 * WLS-029), or null when the failure is not the agent's. The ping and the
 * wireless poll word these alike ("poll it" / "read it"), so one translator
 * serves both; nothing was recorded in any of these cases.
 */
export function agentPollFailure(status: number | undefined, error: string | undefined): string | null {
  const reason = error?.split(' — ').slice(1).join(' — ') ?? '';
  if (!reason.startsWith('its on-site agent')) return null;
  if (status === 409 && reason.endsWith('is not connected')) {
    return 'El agente de este equipo no está conectado, así que no puede sondearlo ahora. Revisa el agente.';
  }
  if (status === 409 && reason.includes('must be updated')) {
    return 'El agente de este equipo es anterior a la versión 0.3.0 y no sondea a pedido. Actualízalo (reinstalándolo una vez si es la 0.1.0).';
  }
  if (status === 504) return 'El agente no respondió a tiempo (25 s). Inténtalo de nuevo.';
  if (status === 502) {
    const detail = reason.split(/could not (?:poll|read) it: /)[1];
    return `El agente no pudo sondear el equipo${detail ? `: ${detail}` : '.'}`;
  }
  return null;
}

export const AGENT_UPDATE_OUTCOME_LABELS: Record<AgentUpdateOutcome, string> = {
  INSTALLED: 'Instalada',
  ROLLED_BACK: 'Revertida',
  REJECTED: 'Rechazada',
};
