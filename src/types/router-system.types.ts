/**
 * What each company MikroTik says about itself (BACKEND_API.md, Router
 * System, MON-160 … MON-186): its own name, hardware, versions and health,
 * read on a schedule and kept; and what is worth fixing on it. The routers
 * are the same ones Port Speeds covers.
 */

/** Every field is null when the router did not say: a CHR has no RouterBOARD, many boards no sensors. */
export interface RouterSystemReading {
  /** The name the router gives itself. */
  identity: string | null;
  /** RouterBOARD model, e.g. "RB4011iGS+". */
  model: string | null;
  serialNumber: string | null;
  /** Factory MAC of ether1. */
  macAddress: string | null;
  boardName: string | null;
  /** "7.15.3". */
  routerOsVersion: string | null;
  /** RouterBOARD firmware installed. */
  currentFirmware: string | null;
  /** Firmware the installed RouterOS brings. */
  upgradeFirmware: string | null;
  uptimeSeconds: number | null;
  /** 0–100. */
  cpuLoadPercent: number | null;
  freeMemoryBytes: number | null;
  totalMemoryBytes: number | null;
  freeHddBytes: number | null;
  totalHddBytes: number | null;
  /** Volts. */
  voltage: number | null;
  temperatureC: number | null;
}

/** MON-173: problems an alert is open for. */
export type RouterHealthIssue = 'CPU' | 'MEMORY' | 'DISK' | 'TEMPERATURE' | 'VOLTAGE';

export interface RouterSystemDTO {
  deviceId: string;
  /** The name in the app. */
  name: string;
  ipAddress: string | null;
  /** False: never read, `reason` says why. */
  readable: boolean;
  reason: string | null;
  /** The last good reading; null until one. */
  system: RouterSystemReading | null;
  /** When `system` was read. */
  readAt: string | null;
  /** The last attempt. */
  attemptedAt: string | null;
  /** The last attempt's error, null when it worked. */
  lastError: string | null;
  /** MON-175: when the router last started. */
  bootedAt: string | null;
  healthIssues: RouterHealthIssue[];
}

export interface RouterSystemListDTO {
  /** By name. */
  routers: RouterSystemDTO[];
}

export interface RouterSystemReadDTO {
  router: RouterSystemDTO;
}

/** MON-172, MON-196. */
export interface RouterHealthThresholdsValues {
  /** Whole, 50–99. */
  cpuPercent: number;
  /** Whole, 1–50. */
  minFreeMemoryPercent: number;
  /** Whole, 1–50. */
  minFreeDiskPercent: number;
  /** Whole, 40–110. */
  maxTemperatureC: number;
  /** 5–60, or null for no voltage alert. */
  minVoltage: number | null;
  /** Whole, 1–100: link-downs in one check that make a port flap. */
  flapLinkDowns: number;
  /** -40–0, or null for no fibre power alert. */
  minSfpRxPowerDbm: number | null;
}

export interface RouterHealthThresholdsDTO {
  thresholds: RouterHealthThresholdsValues;
  defaults: RouterHealthThresholdsValues;
}

/** MON-181 … MON-185, in this order on each router. */
export type RouterAuditFindingCode =
  | 'FIRMWARE_BEHIND'
  | 'PLAINTEXT_SERVICE'
  | 'UNRESTRICTED_SERVICE'
  | 'ADMIN_USER'
  | 'DISCOVERY_ON_ALL_INTERFACES';

export interface RouterAuditFinding {
  code: RouterAuditFindingCode;
  /** The service for *_SERVICE findings, e.g. "telnet". */
  service: string | null;
  /** Its port, e.g. 23. */
  port: number | null;
}

export type RouterAuditPart = 'SERVICES' | 'USERS' | 'DISCOVERY';

export interface RouterAuditDTO {
  deviceId: string;
  name: string;
  ipAddress: string | null;
  /** False: never read, `reason` says why. */
  readable: boolean;
  reason: string | null;
  /** The reading judged; null: never read. */
  readAt: string | null;
  lastError: string | null;
  routerOsVersion: string | null;
  currentFirmware: string | null;
  upgradeFirmware: string | null;
  findings: RouterAuditFinding[];
  /** What the router did not let the app read, so was not checked. */
  unchecked: RouterAuditPart[];
}

export interface RouterAuditListDTO {
  /** Oldest RouterOS first, unknown versions last, ties by name. */
  routers: RouterAuditDTO[];
}
