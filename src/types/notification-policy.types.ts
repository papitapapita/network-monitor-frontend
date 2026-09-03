/**
 * A device with no quiet-hours window always notifies — there is no separate
 * "important device" flag, clearing both bounds *is* what marks a device
 * always-notify (BACKEND_API.md, NOT-170).
 */
export interface DeviceNotificationPolicyDTO {
  deviceId: string;
  quietHoursStart: string | null; // "HH:mm", 24-hour
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null; // override; null = system default
  updatedAt: string | null; // null if never configured
}

/** Full replace — both quiet-hours fields must be set together, or both omitted/null. */
export interface UpsertDeviceNotificationPolicyDTO {
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  alertDelayMinutes?: number | null;
}

export interface BulkUpsertDeviceNotificationPoliciesDTO extends UpsertDeviceNotificationPolicyDTO {
  deviceIds: string[];
}

export interface BulkUpsertDeviceNotificationPoliciesResponseDTO {
  updated: Array<{
    deviceId: string;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    alertDelayMinutes: number | null;
    updatedAt: string;
  }>;
  failed: Array<{ id: string; error: string }>;
}
