import type {
  EnforcementRouterSettingsDTO,
  IssuerSettingsDTO,
  VendorSettingsDTO,
  WhatsAppSettingsDTO,
} from '../types/vendor-settings.types';
import { validateTelegramChatId } from './notification-settings.constants';

/**
 * The vendor settings form (INS-028). Numbers are kept as typed until the
 * save, and every rule below is the backend's own (VendorSettings,
 * SubscriptionTerms), so a refusal is caught before it is sent.
 */

export const STAGE_DAYS_MAX = 90;
export const RETENTION_DAYS_MAX = 3650;
export const DEFAULT_ROUTER_API_PORT = 8728;
const TEXT_MAX = 200;

export const RETENTION_FIELDS = [
  { key: 'pingResultRetentionDays', label: 'Resultados de ping' },
  { key: 'alertRetentionDays', label: 'Alertas resueltas' },
  { key: 'wirelessSnapshotRetentionDays', label: 'Lecturas inalámbricas' },
  { key: 'wirelessAlertRecordRetentionDays', label: 'Registros de alertas inalámbricas cerradas' },
] as const;

export type RetentionKey = (typeof RETENTION_FIELDS)[number]['key'];

export const ISSUER_FIELDS: { key: keyof IssuerSettingsDTO; label: string; placeholder?: string }[] = [
  { key: 'name', label: 'Nombre o razón social' },
  { key: 'documentLabel', label: 'Tipo de documento', placeholder: 'NIT' },
  { key: 'document', label: 'Número de documento' },
  { key: 'address', label: 'Dirección' },
  { key: 'city', label: 'Ciudad' },
  { key: 'contactPhone', label: 'Teléfono de contacto' },
  { key: 'contactEmail', label: 'Correo de contacto' },
  { key: 'accentColorHex', label: 'Color de acento', placeholder: '#1F4E79' },
];

export const WHATSAPP_FIELDS: { key: keyof WhatsAppSettingsDTO; label: string; placeholder: string }[] = [
  { key: 'phoneNumberId', label: 'ID del número de teléfono', placeholder: '123456789012345' },
  { key: 'templateName', label: 'Nombre de la plantilla', placeholder: 'aviso_suspension' },
  { key: 'templateLanguage', label: 'Idioma de la plantilla', placeholder: 'es_CO' },
  { key: 'apiVersion', label: 'Versión de la API', placeholder: 'v21.0' },
];

export interface RouterDraft {
  deviceId: string;
  apiPort: string;
}

export interface VendorSettingsDraft {
  vendorTelegramChatId: string;
  /** '' = not billed by subscription. */
  subscriptionPaidUntil: string;
  subscriptionGraceDays: string;
  subscriptionReadOnlyDays: string;
  retention: Record<RetentionKey, string>;
  issuer: IssuerSettingsDTO | null;
  whatsApp: WhatsAppSettingsDTO | null;
  enforcementRouter: RouterDraft | null;
}

/** What a group starts from when the vendor turns it on. */
export const EMPTY_ISSUER: IssuerSettingsDTO = {
  name: '',
  documentLabel: 'NIT',
  document: '',
  address: '',
  city: '',
  contactPhone: '',
  contactEmail: '',
  accentColorHex: '#1F4E79',
};
export const EMPTY_WHATSAPP: WhatsAppSettingsDTO = {
  phoneNumberId: '',
  templateName: '',
  templateLanguage: 'es',
  apiVersion: 'v21.0',
};
export const EMPTY_ROUTER: RouterDraft = { deviceId: '', apiPort: String(DEFAULT_ROUTER_API_PORT) };

export function toVendorDraft(s: VendorSettingsDTO): VendorSettingsDraft {
  return {
    vendorTelegramChatId: s.vendorTelegramChatId ?? '',
    subscriptionPaidUntil: s.subscriptionPaidUntil ?? '',
    subscriptionGraceDays: String(s.subscriptionGraceDays),
    subscriptionReadOnlyDays: String(s.subscriptionReadOnlyDays),
    retention: Object.fromEntries(RETENTION_FIELDS.map(({ key }) => [key, String(s[key])])) as Record<RetentionKey, string>,
    issuer: s.issuer && { ...s.issuer },
    whatsApp: s.whatsApp && { ...s.whatsApp },
    enforcementRouter: s.enforcementRouter && {
      deviceId: s.enforcementRouter.deviceId,
      apiPort: String(s.enforcementRouter.apiPort),
    },
  };
}

const trimmed = <T extends object>(group: T): T =>
  Object.fromEntries(Object.entries(group).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as T;

/** The PUT body — all eight, as the backend stores them. Call after `validateVendorDraft` passes. */
export function fromVendorDraft(d: VendorSettingsDraft): VendorSettingsDTO {
  const router: EnforcementRouterSettingsDTO | null = d.enforcementRouter && {
    deviceId: d.enforcementRouter.deviceId.trim(),
    apiPort: Number(d.enforcementRouter.apiPort.trim()),
  };
  return {
    vendorTelegramChatId: d.vendorTelegramChatId.trim() || null,
    subscriptionPaidUntil: d.subscriptionPaidUntil.trim() || null,
    subscriptionGraceDays: Number(d.subscriptionGraceDays.trim()),
    subscriptionReadOnlyDays: Number(d.subscriptionReadOnlyDays.trim()),
    ...(Object.fromEntries(RETENTION_FIELDS.map(({ key }) => [key, Number(d.retention[key].trim())])) as Record<RetentionKey, number>),
    issuer: d.issuer && trimmed(d.issuer),
    whatsApp: d.whatsApp && trimmed(d.whatsApp),
    enforcementRouter: router,
  };
}

function wholeNumberError(raw: string, min: number, max: number): string | null {
  const value = raw.trim();
  const n = Number(value);
  if (!value || !Number.isInteger(n) || n < min || n > max) return `Un número entero de ${min} a ${max}`;
  return null;
}

/** 'YYYY-MM-DD' as a UTC midnight, or null when it is not a real date. */
export function parseDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCDate() === d && date.getUTCMonth() === m - 1 ? date : null;
}

export const formatDayValue = (date: Date) => date.toISOString().slice(0, 10);

export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

/** One month on, the day clamped to the month's end (Jan 31 → Feb 28). */
export function addMonth(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

/** Keyed by field path ('issuer.name', 'retention.alertRetentionDays'…). Empty when the draft can be saved. */
export function validateVendorDraft(d: VendorSettingsDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const set = (key: string, error: string | null) => {
    if (error) errors[key] = error;
  };

  set('vendorTelegramChatId', validateTelegramChatId(d.vendorTelegramChatId));

  if (d.subscriptionPaidUntil.trim() && !parseDay(d.subscriptionPaidUntil)) {
    errors.subscriptionPaidUntil = 'Una fecha real (AAAA-MM-DD)';
  }
  // The stage lengths are checked even with no date, as the backend does.
  set('subscriptionGraceDays', wholeNumberError(d.subscriptionGraceDays, 0, STAGE_DAYS_MAX));
  set('subscriptionReadOnlyDays', wholeNumberError(d.subscriptionReadOnlyDays, 0, STAGE_DAYS_MAX));

  for (const { key } of RETENTION_FIELDS) {
    set(`retention.${key}`, wholeNumberError(d.retention[key], 1, RETENTION_DAYS_MAX));
  }

  if (d.issuer) {
    for (const { key } of ISSUER_FIELDS) {
      const value = d.issuer[key].trim();
      if (!value) errors[`issuer.${key}`] = 'Obligatorio';
      else if (value.length > TEXT_MAX) errors[`issuer.${key}`] = `Máximo ${TEXT_MAX} caracteres`;
    }
    if (!errors['issuer.contactEmail'] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.issuer.contactEmail.trim())) {
      errors['issuer.contactEmail'] = 'Un correo electrónico';
    }
    if (!errors['issuer.accentColorHex'] && !/^#[0-9A-Fa-f]{6}$/.test(d.issuer.accentColorHex.trim())) {
      errors['issuer.accentColorHex'] = 'Un color como #RRGGBB';
    }
  }

  if (d.whatsApp) {
    const rules: Record<keyof WhatsAppSettingsDTO, [RegExp, string]> = {
      phoneNumberId: [/^\d{1,30}$/, 'Solo dígitos'],
      templateName: [/^[a-z0-9_]{1,512}$/, 'Minúsculas, dígitos y guiones bajos'],
      templateLanguage: [/^[a-z]{2,3}(_[A-Z]{2})?$/, 'Un código como es o es_CO'],
      apiVersion: [/^v\d+\.\d+$/, 'Una versión como v21.0'],
    };
    for (const { key } of WHATSAPP_FIELDS) {
      const [pattern, message] = rules[key];
      if (!pattern.test(d.whatsApp[key].trim())) errors[`whatsApp.${key}`] = message;
    }
  }

  if (d.enforcementRouter) {
    const id = d.enforcementRouter.deviceId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      errors['enforcementRouter.deviceId'] = 'Elige el router del inventario';
    }
    set('enforcementRouter.apiPort', wholeNumberError(d.enforcementRouter.apiPort, 1, 65535));
  }

  return errors;
}

/** The retention windows this draft shortens — older data goes at the next purge. */
export function shortenedRetention(saved: VendorSettingsDTO, d: VendorSettingsDraft) {
  return RETENTION_FIELDS.filter(({ key }) => Number(d.retention[key]) < saved[key]);
}

export interface StagePreview {
  /** The last day of full service. */
  paidUntil: Date;
  /** The last day of grace; null when there is none. */
  graceLast: Date | null;
  /** The last read-only day; null when there is none. */
  readOnlyLast: Date | null;
  lockedFrom: Date;
}

/**
 * When each stage starts for these terms: grace runs the days after the last
 * paid one, then read-only, then locked — the backend's SubscriptionTerms,
 * counted in whole days. Null while any input is not valid.
 */
export function previewStages(paidUntil: string, graceRaw: string, readOnlyRaw: string): StagePreview | null {
  const paid = parseDay(paidUntil);
  if (!paid) return null;
  if (wholeNumberError(graceRaw, 0, STAGE_DAYS_MAX) || wholeNumberError(readOnlyRaw, 0, STAGE_DAYS_MAX)) return null;
  const grace = Number(graceRaw);
  const readOnly = Number(readOnlyRaw);
  return {
    paidUntil: paid,
    graceLast: grace > 0 ? addDays(paid, grace) : null,
    readOnlyLast: readOnly > 0 ? addDays(paid, grace + readOnly) : null,
    lockedFrom: addDays(paid, grace + readOnly + 1),
  };
}

/** "31 de octubre de 2026" for a UTC-midnight day. */
export const formatLongDay = (date: Date) =>
  date.toLocaleDateString('es', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
