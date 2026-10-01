/**
 * The install's own notification settings, edited by the customer's
 * administrator (BACKEND_API.md, NOT-200). A save applies from the next alert;
 * until the first one the values are the server's env defaults. Bot tokens
 * stay in the server's environment and never appear here.
 */
export interface NotificationSettingsDTO {
  /** `-1001234567890` or `@channel`; null = no chat: alerts are recorded but not sent. */
  telegramChatId: string | null;
  /** 0–1440: how long a device stays DOWN before its alert is sent. A device's own override wins. */
  downAlertDelayMinutes: number;
  /** false: wireless alerts are recorded but not sent (NOT-203). */
  wirelessAlertsEnabled: boolean;
}

export interface NotificationTestResultDTO {
  /** The chat the message was sent to. */
  telegramChatId: string;
}
