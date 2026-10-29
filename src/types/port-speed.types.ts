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
  // MON-198: counters and fibre module, all null / [] on PORT_MISSING.
  /** FCS + alignment errors since the counters were last reset; null when the router does not count them. */
  rxErrors: number | null;
  /** Times the link went down, as read now. */
  linkDowns: number | null;
  /** What the last scheduled check added; null when it could not tell (first check, counter reset). */
  errorsAdded: number | null;
  linkDownsAdded: number | null;
  /** Null on a port with no fibre module. */
  sfp: SfpReadingDTO | null;
  /** Problems open on the port, from the scheduled check. */
  issues: PortIssue[];
}

/** MON-193 … MON-195. */
export type PortIssue =
  | 'ERRORS' // errors added on 2 checks in a row
  | 'FLAPPING' // flapLinkDowns or more link-downs in one check
  | 'SFP_RX_LOW'; // fibre receive power under minSfpRxPowerDbm

export interface SfpReadingDTO {
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
  temperatureC: number | null;
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
