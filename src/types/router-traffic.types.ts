/**
 * Live per-interface traffic of the main routers (MON-060 … MON-066), from
 * `GET /api/routers/traffic/stream`. A main router is any active device with
 * `category: 'GATEWAY'`; nothing here is stored by the backend.
 */

export interface RouterInterfaceTrafficDTO {
  /** 'ether1-wan' */
  name: string;
  /** RouterOS's own type: 'ether', 'sfp-sfpplus', 'bridge', 'vlan', … */
  type: string;
  /** Link up. */
  running: boolean;
  rxBps: number;
  txBps: number;
}

export interface RouterTrafficDTO {
  deviceId: string;
  deviceName: string;
  /** ISO time of the last read; null until the first one finishes. */
  at: string | null;
  /** Why there are no rates — `interfaces` is then []. English, see `translateRouterTrafficError`. */
  error: string | null;
  interfaces: RouterInterfaceTrafficDTO[];
}

export interface RouterTrafficSnapshotDTO {
  /** How often a router's frame arrives — 2. */
  intervalSeconds: number;
  /** Every main router, readable or not. */
  routers: RouterTrafficDTO[];
}
