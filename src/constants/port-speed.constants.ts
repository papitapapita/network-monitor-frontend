import type { BadgeVariant } from '@/components/ui';
import type { PortIssue, PortSpeedVerdict, SfpReadingDTO } from '@/types/port-speed.types';
import type { DeviceModelResponseDTO, DeviceResponseDTO } from '@/types/device.types';

/**
 * Whether the device is one of the company MikroTiks the backend reads for
 * port speeds, system, neighbours and audit (MON-140): live, company-owned,
 * active or commissioning, vendor `mikrotik`, and a router, routerboard or
 * switch by model or a gateway or aggregation switch by category. SwOS
 * switches are left out by the backend and cannot be told apart here; they
 * answer 404, which the screens say.
 */
export function isCompanyMikrotik(
  device: Pick<DeviceResponseDTO, 'ownerType' | 'status' | 'category' | 'deletedAt'> | null | undefined,
  model: Pick<DeviceModelResponseDTO, 'vendorSlug' | 'deviceType'> | null | undefined
): boolean {
  if (!device || !model || device.deletedAt) return false;
  return (
    device.ownerType === 'COMPANY' &&
    (device.status === 'ACTIVE' || device.status === 'COMMISSIONING') &&
    model.vendorSlug === 'mikrotik' &&
    (['ROUTERBOARD', 'ROUTER', 'SWITCH'].includes(model.deviceType) ||
      device.category === 'GATEWAY' ||
      device.category === 'AGGREGATION_SWITCH')
  );
}

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

/** MON-193 … MON-195: open on the port until the scheduled check closes it. */
export const PORT_ISSUE: Record<PortIssue, { label: string; hint: string }> = {
  ERRORS: {
    label: 'Suma errores (cable o conector)',
    hint: 'Sumó errores de recepción en dos revisiones seguidas: suele ser un cable, un conector o un puerto dañado.',
  },
  FLAPPING: { label: 'Se cae y vuelve', hint: 'El enlace se cayó varias veces en una misma revisión de 10 minutos.' },
  SFP_RX_LOW: { label: 'Potencia de fibra baja', hint: 'El módulo recibe por la fibra menos potencia que el mínimo configurado.' },
};

const fmtDecimal = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 });

/** "Rx -7,2 dBm · Tx -2,1 dBm · 41 °C", leaving out what the module did not say. */
export function fmtSfp(sfp: SfpReadingDTO): string {
  return [
    sfp.rxPowerDbm != null && `Rx ${fmtDecimal(sfp.rxPowerDbm)} dBm`,
    sfp.txPowerDbm != null && `Tx ${fmtDecimal(sfp.txPowerDbm)} dBm`,
    sfp.temperatureC != null && `${fmtDecimal(sfp.temperatureC)} °C`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The backend's `reason` and `error` for a MikroTik read (port speeds, system,
 * neighbours, bridge and ARP tables), in Spanish, with what fixes it. Unknown
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
  if (raw === 'The agent must be updated to read this from routers') {
    return 'El agente debe actualizarse (0.11.0 o posterior) para leer esto de los routers.';
  }
  if (raw === 'The router is not behind an agent') return 'El router no está detrás de un agente. Asígnale el agente de su sitio.';
  if (raw === 'The router did not answer') return 'El router no respondió.';
  if (raw === 'The router did not answer its bridge host table') return 'El router no entregó su tabla de hosts del bridge.';
  if (raw === 'The router did not answer its ARP table or DHCP leases') return 'El router no entregó su tabla ARP ni sus concesiones DHCP.';
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

/** The same translation, named for the MikroTik reads that are not about port speeds. */
export const translateRouterReason = translatePortSpeedReason;
