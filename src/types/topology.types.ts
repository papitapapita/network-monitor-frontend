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

/** A PoE switch that could not be read: its POE suggestions are missing. */
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
  /** WIRELESS: a station's radio names its AP. POE: a switch port is labelled with the device's IP. */
  source: 'WIRELESS' | 'POE';
  /** WIRELESS only; IP is the less certain match. */
  matchedBy: 'MAC' | 'IP' | null;
  /** WIRELESS only: when the radio reported it. */
  observedAt: string | null;
  /** POE only: the switch port, e.g. "ether3". */
  port: string | null;
}

export interface UpstreamSuggestionsDTO {
  /** At most one per device, sorted by device IP. */
  suggestions: UpstreamSuggestionDTO[];
  total: number;
  unreadSwitches: UnreadSwitchDTO[];
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
