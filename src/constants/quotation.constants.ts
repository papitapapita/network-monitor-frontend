import type { BadgeVariant } from '@/components/ui';
import type { QuotationStatus } from '@/types/quotation.types';

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Expirada',
};

export const QUOTATION_STATUS_VARIANTS: Record<QuotationStatus, BadgeVariant> = {
  DRAFT: 'draft',
  SENT: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
};

export const QUOTATION_STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'SENT', label: 'Enviada' },
  { value: 'ACCEPTED', label: 'Aceptada' },
  { value: 'REJECTED', label: 'Rechazada' },
  { value: 'EXPIRED', label: 'Expirada' },
];

export const formatCurrency = (value: number): string =>
  value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** Line items and details are editable only while the quote is still a draft. */
export const canEditQuotation = (status: QuotationStatus): boolean => status === 'DRAFT';

export const canSend = (status: QuotationStatus): boolean => status === 'DRAFT';

export const canAccept = (status: QuotationStatus): boolean => status === 'SENT';

export const canReject = (status: QuotationStatus): boolean => status === 'SENT';

/** Only once the quote is past its own validUntil date, matching bills' overdue rule. */
export const canExpire = (status: QuotationStatus, validUntil: string): boolean =>
  status === 'SENT' && new Date(validUntil).getTime() < Date.now();
