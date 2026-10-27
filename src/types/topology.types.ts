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
