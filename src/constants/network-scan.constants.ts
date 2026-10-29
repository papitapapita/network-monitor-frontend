import type { DiscoveredDeviceDTO } from '../types/network-scan.types';

/** The scan form's and the discovery settings' "Servidor" option — the API's `null`. */
export const SCAN_FROM_SERVER = '__server__';

/** The widest block one scan takes: 1 024 host addresses. */
export const SCAN_MIN_PREFIX = 22;
/** The scheduled sweep also refuses anything narrower than /30. */
export const DISCOVERY_MAX_PREFIX = 30;
export const DISCOVERY_MAX_SEGMENTS = 16;
export const DISCOVERY_MIN_HOURS = 1;
export const DISCOVERY_MAX_HOURS = 168;

/** An IPv4 CIDR block whose prefix lies within [minPrefix, maxPrefix]. */
export function isValidCidr(value: string, minPrefix = SCAN_MIN_PREFIX, maxPrefix = 32): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(value.trim());
  if (!match) return false;
  if (match.slice(1, 5).some((p) => Number(p) > 255)) return false;
  const prefix = Number(match[5]);
  return prefix >= minPrefix && prefix <= maxPrefix;
}

/**
 * The scan's refusals arrive in English (DEV-214); the agent's own reason
 * after "could not scan:" is kept as is when it isn't one of the known ones.
 */
export function translateScanError(status: number | undefined, error: string | undefined): string {
  const raw = error ?? '';
  switch (status) {
    case 400:
      if (/too large/i.test(raw)) return 'El bloque es demasiado grande: como máximo un /22 (1 024 direcciones).';
      if (/invalid cidr/i.test(raw)) return 'Ingresa un bloque CIDR válido, ej. 192.168.1.0/24.';
      if (/agentId/i.test(raw)) return 'Elige un agente válido.';
      return raw || 'Solicitud inválida';
    case 404:
      return 'Ese agente ya no existe o fue revocado. Elige otro de la lista.';
    case 409:
      return 'Este servidor no está en la red monitoreada: elige un agente desde el cual escanear.';
    case 502: {
      const reason = raw.replace(/^the agent could not scan:\s*/i, '');
      if (/not connected/i.test(reason)) return 'El agente no está conectado.';
      if (/must be updated/i.test(reason)) return 'Hay que actualizar el agente (0.9.0 o posterior) para escanear la red.';
      if (/did not answer/i.test(reason)) return 'El agente no respondió a tiempo.';
      return `El agente no pudo escanear: ${reason}`;
    }
    default:
      return raw || 'Error al escanear la red';
  }
}

export const DISCOVERED_SOURCE_LABELS: Record<DiscoveredDeviceDTO['source'], string> = {
  SCAN: 'Escaneo',
  AP_STATION: 'Estación de AP',
  ROUTER_NEIGHBOR: 'Vecino de router',
  ROUTER_ARP: 'ARP / DHCP de router',
};
