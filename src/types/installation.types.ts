/**
 * What this install runs (INS-009). Fixed when the backend starts, so it is
 * read once per session and never polled.
 */
export interface InstallationDTO {
  modules: {
    customers: boolean;
    billing: boolean;
    quoting: boolean;
    tickets: boolean;
    enforcement: boolean;
  };
  /** false: the server talks to no device (MON-023) — no manual ping, wireless poll, reboot, diagnosis or network scan for any of them, and a device with no agent stays UNKNOWN. */
  serverOnSite: boolean;
  /** false: creating an agent or a new key answers 503. */
  agentPairingAvailable: boolean;
  /** false: there is no installer folder; the installer routes answer 503. */
  installersAvailable: boolean;
}

export type InstallerPlatform = 'windows' | 'linux';

export interface InstallerDTO {
  /** Also the download path segment. */
  fileName: string;
  platform: InstallerPlatform;
  version: string | null;
  sizeBytes: number;
  modifiedAt: string;
}

export interface InstallerListResponse {
  /** Newest first, so the first of a platform is the one to offer. */
  installers: InstallerDTO[];
}
