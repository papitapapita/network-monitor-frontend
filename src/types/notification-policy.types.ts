/**
 * Which quiet hours apply to a device (BACKEND_API.md, NOT-170): INHERIT
 * follows the install's window (NOT-207), CUSTOM uses the device's own, and
 * ALWAYS_NOTIFY is never silenced — the "important device" case. A device with
 * no policy row is INHERIT.
 */
export type QuietHoursMode = 'INHERIT' | 'CUSTOM' | 'ALWAYS_NOTIFY';

export interface DeviceNotificationPolicyDTO {
  deviceId: string;
  quietHoursMode: QuietHoursMode;
  quietHoursStart: string | null; // "HH:mm", 24-hour; set only when CUSTOM
  quietHoursEnd: string | null;
  alertDelayMinutes: number | null; // override; null = system default
  updatedAt: string | null; // null if never configured
}

/**
 * Full replace. The window is set exactly when the mode is CUSTOM; omitting
 * the mode means CUSTOM if a window is sent, else INHERIT.
 */
export interface UpsertDeviceNotificationPolicyDTO {
  quietHoursMode?: QuietHoursMode;
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
    quietHoursMode: QuietHoursMode;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    alertDelayMinutes: number | null;
    updatedAt: string;
  }>;
  failed: Array<{ id: string; error: string }>;
}
