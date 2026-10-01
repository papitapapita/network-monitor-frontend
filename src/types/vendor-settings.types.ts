/**
 * What the vendor runs this install with (BACKEND_API.md, INS-028). VENDOR
 * only, reads included, and answered even on a locked install so a payment
 * can be recorded there. Secrets (bot tokens, the WhatsApp access token) stay
 * in the server's environment. Each group is all or nothing: complete, or null.
 */
export interface IssuerSettingsDTO {
  name: string;
  /** 'NIT' */
  documentLabel: string;
  document: string;
  address: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  /** '#1F4E79' */
  accentColorHex: string;
}

export interface WhatsAppSettingsDTO {
  /** Digits. */
  phoneNumberId: string;
  /** Lowercase, digits, underscores. */
  templateName: string;
  /** 'es', 'es_CO' */
  templateLanguage: string;
  /** 'v21.0' */
  apiVersion: string;
}

export interface EnforcementRouterSettingsDTO {
  /** The MikroTik in the inventory. */
  deviceId: string;
  /** 1–65535, 8728 by default. */
  apiPort: number;
}

export interface VendorSettingsDTO {
  /** null = agent alerts go to the install's chat only. */
  vendorTelegramChatId: string | null;
  /** 'YYYY-MM-DD', the last day paid (covered to its end, Colombian time); null = not enforced. */
  subscriptionPaidUntil: string | null;
  /** 0–90, full service after the last paid day. */
  subscriptionGraceDays: number;
  /** 0–90, read-only after grace, then locked. */
  subscriptionReadOnlyDays: number;
  /** 1–3650 each. */
  pingResultRetentionDays: number;
  /** Resolved alerts only. */
  alertRetentionDays: number;
  wirelessSnapshotRetentionDays: number;
  /** Cleared records only. */
  wirelessAlertRecordRetentionDays: number;
  /** null: cuenta de cobro PDFs answer 409 (BIL-232). */
  issuer: IssuerSettingsDTO | null;
  /** null: subscriber notices fail and are logged (NOT-115). */
  whatsApp: WhatsAppSettingsDTO | null;
  /** null: /api/enforcement/* answers 503 (SVC-060). */
  enforcementRouter: EnforcementRouterSettingsDTO | null;
}
