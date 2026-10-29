import type { DeviceCategory, DeviceStatus } from './device.types';

/**
 * The network map (BACKEND_API.md, Topology): every device can record the
 * device it hangs off (`DeviceResponseDTO.upstreamDeviceId`), and following
 * the links up ends at a root. Wrapped in `{ success, data }`.
 */

/**
 * DEV-186. DOWN: down and nothing above it is — where the fault is.
 * UNREACHABLE: down behind a device that is down too — probably cut off.
 * UNKNOWN: not monitored, never polled, or behind an agent not reporting.
 */
export type TopologyReachability = 'UP' | 'DOWN' | 'UNREACHABLE' | 'UNKNOWN';

export interface TopologyNodeDTO {
  /** The device's UUID. */
  id: string;
  name: string;
  status: DeviceStatus;
  category: DeviceCategory | null;
  ipAddress: string | null;
  locationId: string | null;
  locationName: string | null;
  /** Always another node in the same response, or null for a root. */
  upstreamDeviceId: string | null;
  reachability: TopologyReachability;
  /** ISO 8601, only while DOWN or UNREACHABLE. */
  downSince: string | null;
  /** Devices directly below this one. */
  childCount: number;
}

export interface TopologyDTO {
  /** Every live ACTIVE/COMMISSIONING device, plus any device another hangs off. Sorted by IP. */
  nodes: TopologyNodeDTO[];
  total: number;
}

/**
 * A PoE switch that could not be read: its POE suggestions are missing. A
 * MikroTik that could not be read has the same shape (`unreadRouters`).
 */
export interface UnreadSwitchDTO {
  deviceId: string;
  name: string;
  reason: string;
}

/**
 * An upstream the network proposes for a device (DEV-190..195). Nothing is
 * linked until an operator accepts it. When `currentUpstreamDeviceId` is
 * set, it is a change rather than a first link.
 */
export interface UpstreamSuggestionDTO {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  locationName: string | null;
  currentUpstreamDeviceId: string | null;
  currentUpstreamDeviceName: string | null;
  suggestedUpstreamDeviceId: string;
  suggestedUpstreamDeviceName: string;
  /**
   * WIRELESS: a station's radio names its AP. POE: a switch port is labelled
   * with the device's IP. ROUTER_NEIGHBOR: a MikroTik port hears only this
   * device over its cable (DEV-196, DEV-197).
   */
  source: 'WIRELESS' | 'POE' | 'ROUTER_NEIGHBOR';
  /** WIRELESS only; IP is the less certain match. */
  matchedBy: 'MAC' | 'IP' | null;
  /** WIRELESS only: when the radio reported it. */
  observedAt: string | null;
  /** POE: the switch port, e.g. "ether3"; ROUTER_NEIGHBOR: the router port, e.g. "ether2 AP 32". */
  port: string | null;
}

export interface UpstreamSuggestionsDTO {
  /** At most one per device, sorted by device IP. */
  suggestions: UpstreamSuggestionDTO[];
  total: number;
  unreadSwitches: UnreadSwitchDTO[];
  /** MikroTiks whose neighbour table could not be read: ROUTER_NEIGHBOR suggestions may be missing. */
  unreadRouters: UnreadSwitchDTO[];
}

export interface UpstreamLinkDTO {
  deviceId: string;
  upstreamDeviceId: string;
}

export interface UpstreamLinkResultDTO extends UpstreamLinkDTO {
  /** UNCHANGED: it already hung there. */
  outcome: 'LINKED' | 'UNCHANGED' | 'FAILED';
  /** FAILED only: the same messages as the link rules. */
  error: string | null;
}

export interface AcceptUpstreamLinksResultDTO {
  /** In request order. */
  results: UpstreamLinkResultDTO[];
  linked: number;
  failed: number;
}

/** One entry of a MikroTik's neighbour table (MNDP/CDP/LLDP), matched with inventory. */
export interface RouterNeighborDTO {
  macAddress: string | null;
  ipAddress: string | null;
  /** The neighbour's own name. */
  identity: string | null;
  /** AirOS: the model, e.g. "LiteBeam M5"; MikroTik: "MikroTik". */
  platform: string | null;
  /** MikroTik: e.g. "RB960PGS". */
  board: string | null;
  version: string | null;
  /** The neighbour's interface: "br0", "ath0", "bridge-lan/ether4". */
  remoteInterface: string | null;
  /** Heard through an AP over its own radio, not cabled to the port. */
  wireless: boolean;
  /** The inventory device with that MAC, else that IP. */
  knownDeviceId: string | null;
  knownDeviceName: string | null;
}

export interface RouterPortNeighborsDTO {
  /** "ether2 AP 32". */
  port: string;
  /** The port's comment on the router now. */
  comment: string | null;
  /** The port toward the gateway: it hears the whole flat network. */
  uplink: boolean;
  neighbors: RouterNeighborDTO[];
  /** The inventory name of the one device clearly cabled here; null when unclear, on the uplink, or already in the comment. */
  suggestedComment: string | null;
}

/** `GET /topology/routers/:deviceId/neighbors` (DEV-198): read now, nothing written. */
export interface RouterNeighborsDTO {
  deviceId: string;
  deviceName: string;
  /** Why the router could not be read; `ports` is then []. */
  reason: string | null;
  /** Ethernet ports in router order, then any other interface something was heard on. */
  ports: RouterPortNeighborsDTO[];
}

/** A router whose bridge host table carries one of the device's MACs. */
export interface NetworkSightingDTO {
  routerDeviceId: string;
  routerName: string;
  /** "ether2". */
  port: string;
  portComment: string | null;
  /** Which of the device's MACs was learned there. */
  macAddress: string;
  /** No other router that sees it sits behind this port. */
  closest: boolean;
}

/** `GET /topology/:deviceId/location` (DEV-199): which router port the device sits behind, read now. */
export interface DeviceNetworkLocationDTO {
  deviceId: string;
  deviceName: string;
  /** The MACs looked for. */
  macAddresses: string[];
  /** The one closest sighting; null when not seen now, or when it cannot be told. */
  location: NetworkSightingDTO | null;
  sightings: NetworkSightingDTO[];
  unreadRouters: UnreadSwitchDTO[];
}

/** DEV-219: a device in service whose IP a router gives to another MAC. */
export interface AddressMismatchDTO {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  /** On file plus the radio's / RouterBOARD's reported MAC. */
  macAddressesOnFile: string[];
  /** The MAC the routers give for that IP. */
  seenMacAddress: string;
  /** OTHER_DEVICE: another device in inventory has that MAC. */
  kind: 'OTHER_DEVICE' | 'UNKNOWN_MAC';
  otherDeviceId: string | null;
  otherDeviceName: string | null;
  seenBy: { routerDeviceId: string; routerName: string }[];
}

export interface AddressMismatchesDTO {
  mismatches: AddressMismatchDTO[];
  unreadRouters: UnreadSwitchDTO[];
}
