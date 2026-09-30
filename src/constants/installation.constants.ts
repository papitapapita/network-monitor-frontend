import type { InstallationDTO } from '../types/installation.types';

type RouteRequirement = (installation: InstallationDTO) => boolean;

/**
 * Which part of the install each section of the app belongs to. A module that
 * is off has no routes at all (404), and the network scan is refused on an
 * install whose server is not on the monitored network (DEV-171).
 */
const ROUTE_REQUIREMENTS: [prefix: string, requirement: RouteRequirement][] = [
  ['/customers', (i) => i.modules.customers],
  ['/service-plans', (i) => i.modules.customers],
  ['/bills', (i) => i.modules.billing],
  ['/collection-accounts', (i) => i.modules.billing],
  ['/quotations', (i) => i.modules.quoting],
  ['/tickets', (i) => i.modules.tickets],
  ['/jornada', (i) => i.modules.tickets],
  ['/calendario', (i) => i.modules.tickets],
  ['/technicians', (i) => i.modules.tickets],
  ['/network-scan', (i) => i.serverOnSite],
];

/** Whether a path — a list or anything under it — exists on this install. */
export function isRouteAvailable(path: string, installation: InstallationDTO): boolean {
  const match = ROUTE_REQUIREMENTS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? match[1](installation) : true;
}
