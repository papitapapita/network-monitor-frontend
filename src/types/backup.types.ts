/**
 * Nightly configuration backups of access points, routers and switches
 * (BACKEND_API.md, Device Backups). The routes answer the DTO directly, with
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
  /** Newest first; the newest 30 are kept. */
  backups: ConfigBackupDTO[];
}

export interface BackUpNowResultDTO {
  /** SAVED: a new version (201); UNCHANGED: the device still holds the latest (200). */
  outcome: 'SAVED' | 'UNCHANGED';
  backup: ConfigBackupDTO;
}

export interface BackupDiffLine {
  kind: 'context' | 'added' | 'removed';
  text: string;
}

export interface BackupDiffHunk {
  /** 1-based; the line before when fromLines is 0. */
  fromStart: number;
  fromLines: number;
  toStart: number;
  toLines: number;
  lines: BackupDiffLine[];
}

/** Secrets show as `name=********`; download the file for the real values (BKP-053). */
export interface BackupDiffDTO {
  from: ConfigBackupDTO;
  to: ConfigBackupDTO;
  identical: boolean;
  /** Lines only in `to`. */
  added: number;
  /** Lines only in `from`. */
  removed: number;
  hunks: BackupDiffHunk[];
}

export interface BackupFile {
  blob: Blob;
  fileName: string;
}
