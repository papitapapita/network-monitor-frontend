export interface NetworkScanRequest {
  segment: string;
}

export interface DiscoveredHost {
  ipAddress: string;
  latencyMs: number;
  macAddress: string | null;
  manufacturer: string | null;
}

export interface NetworkScanResult {
  segment: string;
  scannedCount: number;
  responsiveCount: number;
  discoveredHosts: DiscoveredHost[];
}
