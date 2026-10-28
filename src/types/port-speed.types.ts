/**
 * MikroTik port speeds (BACKEND_API.md, Port Speeds, MON-140 … MON-150):
 * which speed each Ethernet port linked at, judged against the speed an
 * operator says it should run at. Read live; only the expectations are stored.
 */

/** MON-143. */
export type PortSpeedVerdict =
  | 'OK' // linked at or above the expected speed, full duplex
  | 'SLOW' // linked below the expected speed, or at half duplex
  | 'NO_LINK'
  | 'UNKNOWN' // linked and expected, but the router gave no rate
  | 'NO_EXPECTATION'
  | 'PORT_MISSING'; // an expected speed is set, but the router has no enabled port by that name

export interface RouterPortDTO {
  /** "ether2", "sfp-sfpplus1". */
  name: string;
  /** The interface comment on the router. */
  comment: string | null;
  /** Null only on PORT_MISSING. */
  linked: boolean | null;
  /** Null with no link. */
  rateMbps: number | null;
  /** Null when the router did not say. */
  fullDuplex: boolean | null;
  expectedMbps: number | null;
  /** MON-149: a lost link counts as slow. False without an expected speed. */
  alertOnNoLink: boolean;
  verdict: PortSpeedVerdict;
}

export interface RouterPortSpeedsDTO {
  deviceId: string;
  /** The device's name in the app. */
  name: string;
  /** The router's own name (/system identity). */
  identity: string | null;
  ipAddress: string | null;
  /** False: not tried, see reason. */
  readable: boolean;
  reason: string | null;
  /** Tried and failed; ports is then []. */
  error: string | null;
  /** The router's enabled ports in its order, then PORT_MISSING rows. */
  ports: RouterPortDTO[];
}

export interface PortSpeedsListDTO {
  checkedAt: string;
  routers: RouterPortSpeedsDTO[];
}

export interface RouterPortSpeedsReadDTO {
  checkedAt: string;
  router: RouterPortSpeedsDTO;
}

export interface SetExpectedPortSpeedPayload {
  portName: string;
  /** Null clears it. */
  expectedMbps: number | null;
  /** Omitted keeps it; a new port starts false. */
  alertOnNoLink?: boolean;
}

export interface ExpectedPortSpeedDTO {
  deviceId: string;
  portName: string;
  expectedMbps: number | null;
  alertOnNoLink: boolean;
}
