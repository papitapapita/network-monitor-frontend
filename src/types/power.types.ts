/**
 * Storm power control, phase 1: read only (BACKEND_API.md, Power Control).
 * Each request reads the site's PoE switches live; nothing is stored and
 * nothing on a switch changes. Raw DTOs, no `{ success, data }` envelope.
 */

export type PoeSwitchOs = 'ROUTEROS' | 'SWOS';

/** What the port is set to. */
export type PoeMode = 'OFF' | 'AUTO' | 'FORCED_ON' | 'UNKNOWN';
/** What the port is doing now. */
export type PoeStatus = 'POWERED' | 'NO_LOAD' | 'OFF' | 'FAULT' | 'UNKNOWN';

/**
 * How the port's label names a device by IP. MATCHED_OTHER_LOCATION: the
 * device is recorded at another site, or none — one of the two is wrong.
 * DUPLICATE: the same IP labels more than one port at the site.
 */
export type PoePortMatchKind = 'MATCHED' | 'MATCHED_OTHER_LOCATION' | 'UNMATCHED' | 'DUPLICATE';

export interface PoePortDTO {
  /** "ether2" (RouterOS), "Port2" (SwOS). */
  port: string;
  /** As read from the switch. */
  label: string;
  mode: PoeMode;
  status: PoeStatus;
  powerWatts: number | null;
  voltage: number | null;
  match: {
    kind: PoePortMatchKind;
    /** The first IPv4 in the label. */
    ip: string | null;
    /** Set for MATCHED and MATCHED_OTHER_LOCATION. */
    deviceId: string | null;
    deviceName: string | null;
    deviceLocationName: string | null;
  };
}

export interface PoeSwitchDTO {
  deviceId: string;
  name: string;
  ipAddress: string | null;
  firmware: PoeSwitchOs;
  firmwareVersion: string | null;
  /** False: not tried, see `reason`. */
  readable: boolean;
  /** Why it was not tried (no IP, no login, off site). */
  reason: string | null;
  /** Tried and failed; `ports` is then empty. */
  error: string | null;
  /** PoE-out ports only. */
  ports: PoePortDTO[];
}

export interface SitePoePortsDTO {
  locationId: string;
  locationName: string;
  /** By name; [] when the site has none. */
  switches: PoeSwitchDTO[];
}

export interface PowerSourceDTO {
  deviceId: string;
  /**
   * FOUND: exactly one port. DUPLICATE: more than one, all in `sources`.
   * NONE: every switch at the site was read and none names it. UNKNOWN: none
   * found, but a switch in `unreadSwitches` could not be read.
   */
  kind: 'FOUND' | 'DUPLICATE' | 'NONE' | 'UNKNOWN';
  /** Null when FOUND. */
  reason: string | null;
  sources: {
    switchDeviceId: string;
    switchName: string;
    port: string;
    mode: PoeMode;
    status: PoeStatus;
    powerWatts: number | null;
  }[];
  unreadSwitches: { deviceId: string; name: string; reason: string }[];
}
