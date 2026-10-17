/**
 * The stream's per-router `error`, in Spanish, with what fixes it. Unknown
 * strings pass through: a new backend reason is still worth showing as is.
 */
export function translateRouterTrafficError(error: string): string {
  if (error === 'Live traffic is read from MikroTik routers only') {
    return 'El tráfico en vivo solo se lee de routers MikroTik.';
  }
  if (error === 'The router has no IP address') {
    return 'El router no tiene dirección IP. Asígnale una en el dispositivo.';
  }
  if (error === 'The router has no username and password saved') {
    return 'El router no tiene usuario y contraseña guardados. Agrégalos en sus credenciales.';
  }
  if (error === 'The router is not behind an agent') {
    return 'El router no está asignado a un agente. Asígnalo al agente de su sitio.';
  }
  if (error === 'The agent must be updated to read router traffic') {
    return 'El agente debe actualizarse (0.6.0 o posterior) para leer el tráfico del router.';
  }
  if (error === 'The agent is not connected' || error === 'The agent disconnected') {
    return 'El agente del router no está conectado.';
  }
  if (error === 'The agent did not answer in time') {
    return 'El agente no respondió a tiempo.';
  }
  if (error.startsWith('RouterOS API error:')) {
    return `El router rechazó la conexión por la API de RouterOS: revisa el usuario, la contraseña y que el servicio API esté activo en el puerto de sus credenciales. (${error.slice('RouterOS API error:'.length).trim()})`;
  }
  return error;
}

/** How many readings each interface's chart keeps — two minutes at the stream's 2 s. */
export const ROUTER_TRAFFIC_HISTORY = 60;

/**
 * Names that mark the router's own way out to its provider. RouterOS reports
 * RX/TX from the router's side, so only on such a port is RX what the
 * customers download; on every other one (the LAN bridge, the ports towards
 * the towers) the customers' download leaves the router as TX.
 */
const UPLINK_NAME = /wan|isp|internet|uplink|upstream|pppoe-out|lte/i;

export function isUplinkInterface(name: string): boolean {
  return UPLINK_NAME.test(name);
}

/** An interface's rates as the customers see them: what they download and what they upload. */
export function customerRates(iface: { name: string; rxBps: number; txBps: number }): {
  downBps: number;
  upBps: number;
} {
  return isUplinkInterface(iface.name)
    ? { downBps: iface.rxBps, upBps: iface.txBps }
    : { downBps: iface.txBps, upBps: iface.rxBps };
}

/**
 * What one router carries, read off its busiest running interface. Summing
 * every interface would count the same bytes two or three times — a bridge and
 * its member ports, the WAN and the LAN each carry them — so the busiest one
 * stands in for the router.
 */
export function routerTotals<T extends { name: string; running: boolean; rxBps: number; txBps: number }>(
  interfaces: T[]
): { iface: T; downBps: number; upBps: number } | null {
  let busiest: T | null = null;
  for (const i of interfaces) {
    if (!i.running) continue;
    if (!busiest || i.rxBps + i.txBps > busiest.rxBps + busiest.txBps) busiest = i;
  }
  return busiest ? { iface: busiest, ...customerRates(busiest) } : null;
}

/** Download first: it is the number an ISP watches, and the one the charts fill. */
export const TRAFFIC_SERIES: [
  { key: 'downBps'; label: string; color: string },
  { key: 'upBps'; label: string; color: string },
] = [
  { key: 'downBps', label: 'Bajada', color: 'var(--viz-series)' },
  { key: 'upBps', label: 'Subida', color: 'var(--viz-series-2)' },
];
