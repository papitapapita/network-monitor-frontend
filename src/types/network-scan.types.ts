export interface NetworkScanRequest {
  segment: string;
  /** Scan from this agent's PC (agent 0.9.0+, DEV-214); absent or null = from the server. */
  agentId?: string | null;
}

export interface DiscoveredHost {
  ipAddress: string;
  latencyMs: number;
  macAddress: string | null;
  manufacturer: string | null;
  /** The inventory device this host is — matched by MAC, then IP (DEV-201). */
  knownDeviceId: string | null;
  /** Its suggestion at `/network/discovered`; null when known or seen without a MAC. */
  discoveredDeviceId: string | null;
  /** First seen by this scan. */
  isNew: boolean;
}

export interface NetworkScanResult {
  segment: string;
  /** The agent that scanned it; null = the server. */
  agentId: string | null;
  scannedCount: number;
  responsiveCount: number;
  /** Hosts this scan found for the first time. */
  newCount: number;
  discoveredHosts: DiscoveredHost[];
}

/**
 * A host the network shows that inventory lacks (DEV-200 … DEV-209), from a
 * scan or from a polled AP's station list.
 */
export interface DiscoveredDeviceDTO {
  id: string;
  /** Upper case, colons — the suggestion's identity. */
  macAddress: string;
  /** Where it was seen last. */
  ipAddress: string | null;
  manufacturer: string | null;
  /** What saw it last. */
  source: 'SCAN' | 'AP_STATION';
  /** The CIDR a scan last saw it on; null if only APs saw it. */
  segment: string | null;
  /** AP_STATION: the radio's own name. */
  hostname: string | null;
  /** AP_STATION: the AirOS platform, e.g. "LiteBeam 5AC Gen2". */
  model: string | null;
  accessPointId: string | null;
  /** List only; null once the AP is deleted. */
  accessPointName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Set on the ignored list only. */
  ignoredAt: string | null;
}

/** `GET /network/discovered/:id/prefill`: starting values for the create form. Null = no guess. */
export interface DiscoveredDevicePrefillDTO {
  name: string | null;
  macAddress: string;
  ipAddress: string | null;
  deviceModelId: string | null;
  deviceModelName: string | null;
  category: 'WIRELESS_CPE' | null;
  upstreamDeviceId: string | null;
  /** Present only with an upstream: that AP's agent (null = this server). Absent = keep the default. */
  agentId?: string | null;
}

export interface DiscoverySegmentDTO {
  /** IPv4 CIDR, /22 to /30; stored as its network address. */
  cidr: string;
  /** The probe agent that sweeps it; null = this server. */
  agentId: string | null;
}

/** The scheduled network scan (DEV-210 … DEV-213). */
export interface DiscoverySettingsDTO {
  enabled: boolean;
  /** Whole hours, 1–168. */
  intervalHours: number;
  /** At most 16. */
  segments: DiscoverySegmentDTO[];
  /** When the last scheduled run started; read only. */
  lastRunAt: string | null;
}

export type SaveDiscoverySettingsDTO = Omit<DiscoverySettingsDTO, 'lastRunAt'>;
