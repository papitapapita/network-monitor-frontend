import type { BillingMode } from '@/types/billing-settings.types';
import type { PaymentDay } from '@/types/customer.types';

export const ISSUE_LEAD_DAYS_MIN = 1;
export const ISSUE_LEAD_DAYS_MAX = 14;
export const GRACE_DAYS_MAX = 14;

export const BILLING_MODE_OPTIONS: { value: BillingMode; label: string }[] = [
  { value: 'ADVANCE', label: 'Anticipado — la factura de octubre cobra octubre' },
  { value: 'ARREARS', label: 'Vencido — la factura de octubre cobra septiembre' },
];

export const PAYMENT_DAY_OPTIONS: { value: string; label: string }[] = [
  { value: '15', label: 'Día 15' },
  { value: '30', label: 'Día 30 (último día en febrero)' },
];

export const formatPaymentDay = (day: PaymentDay): string => `Día ${day}`;

// Meta's rule for template names, which the backend also enforces.
const WHATSAPP_TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;

function validateWholeDays(raw: string, min: number, max: number): string | null {
  const value = raw.trim();
  if (!value) return 'Indica el número de días';
  const days = Number(value);
  if (!Number.isInteger(days) || days < min || days > max) {
    return `Debe ser un número entero de días entre ${min} y ${max}`;
  }
  return null;
}

export const validateIssueLeadDays = (raw: string) => validateWholeDays(raw, ISSUE_LEAD_DAYS_MIN, ISSUE_LEAD_DAYS_MAX);

export const validateGraceDays = (raw: string) => validateWholeDays(raw, 0, GRACE_DAYS_MAX);

/** Empty is valid: reminders go by email only. */
export function validateWhatsAppTemplate(raw: string): string | null {
  const value = raw.trim();
  if (!value || WHATSAPP_TEMPLATE_NAME.test(value)) return null;
  return 'Solo minúsculas, dígitos y guiones bajos, como el nombre aprobado en Meta';
}
