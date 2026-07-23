/**
 * Suspension enforcement — whether a suspended service is actually throttled on
 * the router, as opposed to merely flagged SUSPENDED in the database.
 *
 * These endpoints hit the MikroTik live, so a failure (503) means "unknown",
 * never "not enforced".
 */

export interface SuspensionEnforcementDTO {
  contractedServiceId: string;
  targetIp: string;
}

export interface EnforcedSuspensionsResponse {
  checkedAt: string;
  enforcements: SuspensionEnforcementDTO[];
}

export interface ServiceEnforcementStatusDTO {
  contractedServiceId: string;
  enforced: boolean;
  targetIp: string | null;
  checkedAt: string;
}
