// ============================================================
// Wireless alert thresholds (WLS-200..202)
// ============================================================

export interface SeverityThresholdsDTO {
  warning: number;
  critical: number;
}

/** The limits the wireless alert rules open at. */
export interface AlertThresholdsDTO {
  signalDbm: SeverityThresholdsDTO; // whole, −100…−40; warning above critical. Rx and Tx
  snrDb: SeverityThresholdsDTO; // whole, 1…60; warning above critical
  ccqPercent: SeverityThresholdsDTO; // whole, 1…95; warning above critical. M-series only
  latencyMs: SeverityThresholdsDTO; // whole, 1…10000; warning BELOW critical
  cpuPercent: number; // whole, 10…99
  memoryPercent: number; // whole, 10…99
  clockDriftSeconds: number; // whole, 10…86400
  saturationPercent: number; // whole, 10…100 — share of link capacity
  clientDropPercent: number; // whole, 10…90 — share of an AP's clients lost between polls
  minCapacityMbps: Record<string, number>; // channel width (MHz) → floor; whole, 1…10000
  maxDistanceKm: Record<string, number>; // channel width (MHz) → maximum; 0.1…200, decimals allowed
}

/** `GET`/`PUT /api/wireless/alert-thresholds`. */
export interface InstallAlertThresholdsDTO {
  thresholds: AlertThresholdsDTO; // what the install alerts at
  defaults: AlertThresholdsDTO; // for a "restore defaults" button
}

/** `GET`/`PUT /api/devices/:id/wireless/alert-thresholds`. */
export interface DeviceAlertThresholdsDTO {
  deviceId: string;
  overrides: Partial<AlertThresholdsDTO>; // {} when the device follows the install
  install: AlertThresholdsDTO; // the install's set, to show what is inherited
  effective: AlertThresholdsDTO; // what this device actually alerts at
}
