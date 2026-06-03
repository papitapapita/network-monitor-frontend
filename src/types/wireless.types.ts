export type WirelessDeviceType = 'STATION' | 'ACCESS_POINT';
export type WirelessCollectionMethod = 'snmp' | 'http_api' | 'mixed';
export type WirelessAlertSeverity = 'WARNING' | 'CRITICAL';

export interface WirelessMetricsDTO {
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  noiseFloorDbm: number | null;
  snrDb: number | null;
  ccqPercent: number | null;
  txRateMbps: number | null;
  rxRateMbps: number | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
  txPowerDbm: number | null;
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  throughputTxPps: number | null;
  throughputRxPps: number | null;
  lanStatus: string | null;
  lanSpeedMbps: number | null;
  lanDuplex: string | null;
  uptimeSeconds: number | null;
  cpuLoadPercent: number | null;
  memoryUsedPercent: number | null;
  firmwareVersion: string | null;
  deviceName: string | null;
  remoteApMac: string | null;
  remoteApName: string | null;
  distanceM: number | null;
  latencyMs: number | null;
  clientsConnected: number | null;
  clientsProvisioned: number | null;
}

export interface WirelessAlertDTO {
  id: string;
  deviceId: string;
  metric: string;
  severity: WirelessAlertSeverity;
  threshold: number;
  lastValue: number;
  message: string;
  triggeredAt: string;
  clearedAt: string | null;
  isActive: boolean;
}

export interface WirelessClientDTO {
  macAddress: string;
  ipAddress: string | null;
  signalRxDbm: number | null;
  noiseFloorDbm: number | null;
  distanceM: number | null;
  uptimeSeconds: number | null;
  txLatencyMs: number | null;
  dlLinkScore: number | null;
  ulLinkScore: number | null;
  dlCapacityKbps: number | null;
  ulCapacityKbps: number | null;
  dlCinr: number | null;
  ulCinr: number | null;
  txBytesTotal: string | null;
  rxBytesTotal: string | null;
  txPps: number | null;
  rxPps: number | null;
  remoteHostname: string | null;
  remotePlatform: string | null;
  remoteVersion: string | null;
  remoteCpuLoad: number | null;
  remoteTotalRam: number | null;
  remoteFreeRam: number | null;
  remoteSignal: number | null;
  remoteNoiseFloor: number | null;
  remoteTxPower: number | null;
  remoteTxThroughputKbps: number | null;
  remoteRxThroughputKbps: number | null;
  remoteIpAddresses: string[];
}

export interface WirelessStatusDTO {
  deviceId: string;
  deviceType: WirelessDeviceType;
  collectedAt: string;
  collectionMethod: WirelessCollectionMethod;
  metrics: WirelessMetricsDTO;
  activeAlerts: WirelessAlertDTO[];
  clients: WirelessClientDTO[];
}

export interface WirelessConfigDTO {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  enabled: boolean;
  intervalSecs: number;
  deviceType: WirelessDeviceType;
  linkCapacityBps: number | null;
  clientsProvisionedLimit: number | null;
  lastPolledAt: string | null;
}

export interface CreateWirelessConfigDTO {
  deviceType: WirelessDeviceType;
  ipAddress?: string | null;
  intervalSecs?: number;
  enabled?: boolean;
  linkCapacityBps?: number | null;
  clientsProvisionedLimit?: number | null;
}

export interface UpdateWirelessConfigDTO {
  ipAddress?: string | null;
  intervalSecs?: number;
  enabled?: boolean;
  linkCapacityBps?: number | null;
  clientsProvisionedLimit?: number | null;
}

export interface WirelessClientsResponse {
  deviceId: string;
  collectedAt: string;
  clients: WirelessClientDTO[];
}

export interface WirelessPollResult {
  deviceId: string;
  collectedAt: string;
  metricsCollected: boolean;
  alertsTriggered: number;
  alertsCleared: number;
  collectionMethod: string;
  skipped?: boolean;
}

export interface WirelessHistoryResponse {
  snapshots: WirelessStatusDTO[];
  total: number;
}

export interface WirelessAlertHistoryQuery {
  from?: string;
  to?: string;
  limit?: number;
}

export interface WirelessHistoryQuery {
  from: string;
  to: string;
  limit?: number;
}
