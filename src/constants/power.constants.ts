import type { BadgeVariant } from '@/components/ui';
import type { PoeMode, PoePortMatchKind, PoeStatus, PoeSwitchOs } from '@/types/power.types';

export const POE_SWITCH_OS_LABELS: Record<PoeSwitchOs, string> = {
  ROUTEROS: 'RouterOS',
  SWOS: 'SwOS',
};

/** For the device-model form: '' is "not a PoE switch" (`poeSwitchOs: null`). */
export const POE_SWITCH_OS_OPTIONS = [
  { value: '', label: 'No es un switch PoE' },
  { value: 'ROUTEROS', label: 'Switch PoE con RouterOS (p. ej. hEX PoE)' },
  { value: 'SWOS', label: 'Switch PoE con SwOS (p. ej. CSS106)' },
];

export const POE_STATUS: Record<PoeStatus, { label: string; variant: BadgeVariant }> = {
  POWERED: { label: 'Alimentando', variant: 'success' },
  NO_LOAD: { label: 'Sin carga', variant: 'warning' },
  OFF: { label: 'Apagado', variant: 'neutral' },
  FAULT: { label: 'Falla', variant: 'danger' },
  UNKNOWN: { label: 'Desconocido', variant: 'neutral' },
};

export const POE_MODE_LABELS: Record<PoeMode, string> = {
  OFF: 'Apagado',
  AUTO: 'Automático',
  FORCED_ON: 'Forzado',
  UNKNOWN: 'Desconocido',
};

export const POE_MATCH: Record<PoePortMatchKind, { label: string; hint: string; variant: BadgeVariant }> = {
  MATCHED: { label: 'Identificado', hint: 'Un equipo de este sitio tiene esa IP.', variant: 'success' },
  MATCHED_OTHER_LOCATION: {
    label: 'Otro sitio',
    hint: 'El equipo con esa IP está registrado en otra ubicación, o en ninguna: corrige una de las dos.',
    variant: 'warning',
  },
  UNMATCHED: { label: 'Sin identificar', hint: 'La etiqueta no tiene una IP, o ningún equipo la tiene.', variant: 'neutral' },
  DUPLICATE: { label: 'IP repetida', hint: 'La misma IP rotula más de un puerto del sitio: corrige las etiquetas.', variant: 'danger' },
};

/** The backend's reasons, word for word (power-control), in Spanish. */
const REASONS: Array<[string, string]> = [
  ['The switch has no IP address', 'El switch no tiene dirección IP.'],
  ['The switch has no username and password saved', 'El switch no tiene usuario y contraseña guardados en Credenciales.'],
  ['reading PoE ports through an agent is not supported yet', 'Está detrás de un agente, y todavía no se leen puertos PoE a través de un agente.'],
  ['This server is off site and no agent reaches the switch', 'El servidor está fuera del sitio y ningún agente alcanza el switch.'],
  ['The device has no IP address', 'El equipo no tiene dirección IP.'],
  ['The device has no location, so no switch is looked at', 'El equipo no tiene ubicación, así que no se busca switch.'],
  ['There is no PoE switch at the device location', 'No hay un switch PoE en la ubicación del equipo.'],
  ['No PoE port at the device location is labelled with its IP', 'Ningún puerto PoE de su ubicación está rotulado con su IP.'],
  ['No port found, but a switch at the site could not be read', 'No se encontró el puerto, pero un switch del sitio no se pudo leer.'],
  ['More than one port is labelled with the device IP', 'Más de un puerto está rotulado con la IP del equipo.'],
];

/** A reason in Spanish; one the backend words otherwise (a refused login, a timeout) comes back as it is. */
export function poeReason(raw: string | null | undefined): string {
  if (!raw) return '';
  return REASONS.find(([en]) => raw.includes(en))?.[1] ?? raw;
}
