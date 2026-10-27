/**
 * Nightly configuration backup of the company's antennas, routerboards and
 * switches, one copy per device (BACKEND_API.md, Device Backups). The routes answer the DTO directly, with
 * no `{ success, data }` envelope.
 */

/** AirOS `system.cfg` (`.cfg`) or a RouterOS `/export show-sensitive` (`.rsc`). */
export type BackupFormat = 'AIROS_CFG' | 'ROUTEROS_EXPORT';

export type BackupTrigger = 'SCHEDULED' | 'MANUAL';

export type BackupOutcome = 'SAVED' | 'UNCHANGED' | 'FAILED';

export interface ConfigBackupDTO {
  id: string;
  deviceId: string;
  format: BackupFormat;
  sizeBytes: number;
  trigger: BackupTrigger;
  /** When this configuration was first saved. */
  takenAt: string;
  /** The last time the device still held it. */
  lastCheckedAt: string;
}

export interface DeviceBackupStateDTO {
  lastAttemptAt: string | null;
  lastOutcome: BackupOutcome | null;
  /** Only while the last attempt failed. */
  lastError: string | null;
  lastSuccessAt: string | null;
  /** First failure of the current streak. */
  failingSince: string | null;
  consecutiveFailures: number;
}

export interface DeviceBackupsDTO {
  deviceId: string;
  /** Null: never attempted. */
  state: DeviceBackupStateDTO | null;
  /** The kept copy, or []: only the latest configuration is kept (BKP-030). */
  backups: ConfigBackupDTO[];
}

export interface BackUpNowResultDTO {
  /** SAVED: changed (or first) and replaced the copy (201); UNCHANGED: the device still holds it (200). */
  outcome: 'SAVED' | 'UNCHANGED';
  backup: ConfigBackupDTO;
}

export interface BackupFile {
  blob: Blob;
  fileName: string;
}
