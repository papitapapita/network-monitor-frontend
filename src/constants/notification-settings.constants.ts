export const DOWN_ALERT_DELAY_MAX_MINUTES = 1440;

/**
 * A numeric chat id (groups and supergroups are negative) or a public
 * channel's @username — the two forms the Bot API accepts, and the backend's
 * own rule (NOT-200, INS-028).
 */
const TELEGRAM_CHAT_ID = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;

/** Empty is valid: it means no chat. */
export function validateTelegramChatId(raw: string): string | null {
  const value = raw.trim();
  if (!value || TELEGRAM_CHAT_ID.test(value)) return null;
  return 'Debe ser un id numérico de chat (p. ej. -1001234567890) o un canal (@nombre)';
}

export function validateDownAlertDelay(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Indica el retraso en minutos';
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > DOWN_ALERT_DELAY_MAX_MINUTES) {
    return `Debe ser un número entero de minutos entre 0 y ${DOWN_ALERT_DELAY_MAX_MINUTES}`;
  }
  return null;
}
