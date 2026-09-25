import { BulkReportBuckets } from './common.types';

export type WirelessDeviceType = 'STATION' | 'ACCESS_POINT';
export type WirelessCollectionMethod = 'snmp' | 'http_api' | 'mixed';
export type WirelessAlertSeverity = 'WARNING' | 'CRITICAL';

export interface WirelessMetricsDTO {
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  noiseFloorDbm: number | null;
  snrDb: number | null;
  ccqPercent: number | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
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

export interface WirelessAlertBulkClearResult extends BulkReportBuckets {
  cleared: WirelessAlertDTO[];
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

/**
 * A single live throughput reading, as carried by the two SSE streams. It is a
 * narrower view of what `WirelessStatusDTO` already holds, plus the freshness
 * fields — the stream pushes on the poller's cadence, not on request, so a
 * reading can be minutes old and the consumer has to be able to say so.
 */
export interface WirelessThroughputDTO {
  deviceId: string;
  deviceType: WirelessDeviceType;
  /** When the radio was read, not when we asked. */
  collectedAt: string;
  /** Age of the reading in seconds; never negative. */
  ageSeconds: number;
  /** True past 2 × the device's `intervalSecs`, or when it has no config. */
  stale: boolean;
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  /** Null if either leg is null. */
  throughputTotalBps: number | null;
  /** The provisioned plan. STATION-only — always null for an AP. */
  linkCapacityKbps: number | null;
  /** 2dp. Null without a capacity, so always null for an AP. */
  utilisationPercent: number | null;
}

/** The fleet stream's opening frame — every device that has ever been polled. */
export interface WirelessThroughputSnapshot {
  devices: WirelessThroughputDTO[];
  total: number;
}

export interface WirelessConfigDTO {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  enabled: boolean;
  intervalSecs: number;
  deviceType: WirelessDeviceType;
  linkCapacityKbps: number | null;
  clientsProvisionedLimit: number | null;
  /** Either device type. Usually left unset — see the note on Create/Update. */
  provisionedLanSpeedMbps: number | null;
  /** STATION only — the ACCESS_POINT device this CPE is declared to sit on. */
  parentApDeviceId: string | null;
  lastPolledAt: string | null;
}

// deviceType is not part of the request — the backend derives it from the
// device's category (WIRELESS_CPE → STATION, ACCESS_POINT → ACCESS_POINT) and
// returns the resolved value on WirelessConfigDTO.
export interface CreateWirelessConfigDTO {
  ipAddress?: string | null;
  intervalSecs?: number;
  enabled?: boolean;
  linkCapacityKbps?: number | null;
  clientsProvisionedLimit?: number | null;
  /**
   * The negotiated Ethernet speed this device's LAN port is expected to run
   * at. Normally left unset — it auto-fills itself from the first poll that
   * reports a speed and no baseline exists yet. Set it explicitly only to
   * correct a baseline captured while the port was already degraded.
   */
  provisionedLanSpeedMbps?: number | null;
  /**
   * STATION only — declares which AP device this CPE is meant to sit on,
   * separate from whatever the radio's last poll actually reported. Drives
   * `GET /wireless/clients/expected` on the AP side.
   */
  parentApDeviceId?: string | null;
}

export interface UpdateWirelessConfigDTO {
  ipAddress?: string | null;
  intervalSecs?: number;
  enabled?: boolean;
  linkCapacityKbps?: number | null;
  clientsProvisionedLimit?: number | null;
  provisionedLanSpeedMbps?: number | null;
  parentApDeviceId?: string | null;
}

export interface WirelessExpectedClientEntry {
  deviceId: string;
  deviceName: string;
  /** From device-inventory, not from any poll. */
  macAddress: string | null;
  connected: boolean;
  /** Live stats when connected, else null. */
  client: WirelessClientDTO | null;
}

/** The AP-side view of "who's supposed to be here and isn't". */
export interface WirelessExpectedClientsResponse {
  apDeviceId: string;
  /** From the latest snapshot; null if the AP has never been polled. */
  collectedAt: string | null;
  expected: WirelessExpectedClientEntry[];
  missingCount: number;
  /** Live clients matching no declared CPE. */
  unexpectedConnected: WirelessClientDTO[];
}

export interface WirelessIdentitySuggestion {
  field: 'name' | 'macAddress';
  /** From device-inventory. */
  currentValue: string | null;
  /** From the latest AirOS poll. */
  suggestedValue: string;
}

/**
 * Read-only diff between what AirOS last reported about its own
 * hostname/MAC and what's on file in device-inventory. Never auto-written —
 * accepting a suggestion means calling `updateDevice` with the suggested
 * value. Serial number is never compared; AirOS does not expose one.
 */
export interface WirelessIdentitySuggestionsResponse {
  deviceId: string;
  /** False if the device has never been polled. */
  polled: boolean;
  collectedAt: string | null;
  suggestions: WirelessIdentitySuggestion[];
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

export interface WirelessRebootResult {
  deviceId: string;
  requestedAt: string;
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
