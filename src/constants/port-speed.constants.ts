import type { BadgeVariant } from '@/components/ui';
import type { PortSpeedVerdict } from '@/types/port-speed.types';

/** The only speeds `PUT …/expected` accepts, in Mbps. */
export const EXPECTED_SPEEDS_MBPS = [10, 100, 1000, 2500, 5000, 10000, 25000, 40000, 100000] as const;

/** 100 → "100 Mbps", 1000 → "1 Gbps", 2500 → "2,5 Gbps". */
export function fmtMbps(mbps: number): string {
  if (mbps < 1000) return `${mbps} Mbps`;
  return `${(mbps / 1000).toLocaleString('es')} Gbps`;
}

/** '' is "no expected speed" (`expectedMbps: null`). */
export const EXPECTED_SPEED_OPTIONS = [
  { value: '', label: 'Sin definir' },
  ...EXPECTED_SPEEDS_MBPS.map((s) => ({ value: String(s), label: fmtMbps(s) })),
];

export const PORT_VERDICT: Record<PortSpeedVerdict, { label: string; hint: string; variant: BadgeVariant }> = {
  OK: { label: 'Correcto', hint: 'Enlazó a la velocidad esperada o más, en full dúplex.', variant: 'success' },
  SLOW: {
    label: 'Lento',
    hint: 'Enlazó por debajo de la velocidad esperada, o en half dúplex. Suele ser un cable dañado.',
    variant: 'danger',
  },
  NO_LINK: { label: 'Sin enlace', hint: 'No hay nada conectado al puerto, o el enlace está caído.', variant: 'neutral' },
  UNKNOWN: { label: 'Sin velocidad', hint: 'Tiene enlace, pero el router no informó su velocidad.', variant: 'neutral' },
  NO_EXPECTATION: {
    label: 'Sin velocidad esperada',
    hint: 'Nadie definió a qué velocidad debería enlazar, así que no se evalúa.',
    variant: 'neutral',
  },
  PORT_MISSING: {
    label: 'Puerto inexistente',
    hint: 'El router no tiene un puerto activo con ese nombre: quita la velocidad esperada, o vuelve a nombrar el puerto como estaba.',
    variant: 'draft',
  },
};

/**
 * The backend's `reason` and `error`, in Spanish, with what fixes it. Unknown
 * strings (a refused login, a timeout) pass through as they are.
 */
export function translatePortSpeedReason(raw: string | null | undefined): string {
  if (!raw) return '';
  if (raw === 'The router has no IP address') return 'El router no tiene dirección IP. Asígnale una en el dispositivo.';
  if (raw === 'The router has no username and password saved') {
    return 'El router no tiene usuario y contraseña guardados. Agrégalos en sus credenciales.';
  }
  if (raw === 'This server is off site and no agent reaches the router') {
    return 'El servidor está fuera del sitio y ningún agente alcanza el router. Asígnalo al agente de su sitio.';
  }
  if (raw === 'The agent must be updated to read port speeds') {
    return 'El agente debe actualizarse (0.10.0 o posterior) para leer la velocidad de los puertos.';
  }
  if (raw === 'The agent is not connected' || raw === 'The agent disconnected') return 'El agente del router no está conectado.';
  if (raw === 'The agent did not answer in time') return 'El agente no respondió a tiempo.';
  if (raw.startsWith('RouterOS API error:')) {
    return `El router rechazó la conexión por la API de RouterOS: revisa el usuario, la contraseña y que el servicio API esté activo en el puerto de sus credenciales. (${raw.slice('RouterOS API error:'.length).trim()})`;
  }
  return raw;
}

/** `409 The router cannot be read: <reason>` and `502 The router did not answer: <error>` from accept-current. */
export function translateAcceptCurrentError(raw: string | undefined): string {
  if (!raw) return 'No se pudieron aceptar las velocidades actuales';
  for (const [prefix, es] of [
    ['The router cannot be read:', 'No se puede leer el router:'],
    ['The router did not answer:', 'El router no respondió, y no se cambió nada:'],
  ] as const) {
    if (raw.startsWith(prefix)) return `${es} ${translatePortSpeedReason(raw.slice(prefix.length).trim())}`;
  }
  if (raw === 'Router not found') return 'Este equipo ya no es un router MikroTik de la empresa.';
  return raw;
}
