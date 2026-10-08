import type { BadgeVariant } from '@/components/ui';
import type { BillLineItemDTO, BillStatus, PaymentMethod } from '@/types/bill.types';

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

export const BILL_STATUS_VARIANTS: Record<BillStatus, BadgeVariant> = {
  PENDING: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'neutral',
};

export const BILL_STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PAID', label: 'Pagada' },
  { value: 'OVERDUE', label: 'Vencida' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  BANK_TRANSFER: 'Transferencia bancaria',
  NEQUI: 'Nequi',
  DAVIPLATA: 'Daviplata',
  BRE_B: 'Bre-B',
  OTHER: 'Otro',
};

export const PAYMENT_METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

export const PAYMENT_REFERENCE_MAX_LENGTH = 100;

export const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const MONTH_OPTIONS = MONTH_LABELS.map((label, i) => ({
  value: String(i + 1),
  label,
}));

/** Formats a 'YYYY-MM' period as "Julio 2026". */
export const formatPeriod = (period: string): string => {
  const [year, month] = period.split('-');
  const label = MONTH_LABELS[Number(month) - 1];
  return label ? `${label} ${year}` : period;
};

/** 'YYYY-MM-DD' as a local date, without the UTC shift `new Date('YYYY-MM-DD')` brings. */
export const formatDay = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es');
};

/** The days a line charges, or null on lines from before the days were recorded. */
export const formatServiceDays = (li: BillLineItemDTO): string | null =>
  li.serviceFrom && li.serviceTo ? `${formatDay(li.serviceFrom)} – ${formatDay(li.serviceTo)}` : null;

/** A line charges less than its monthly price only when the automatic run prorated it. */
export const isProrated = (li: BillLineItemDTO): boolean => li.amount !== li.monthlyPrice;

export const formatCurrency = (value: number): string =>
  value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** A bill can be marked overdue only from PENDING and once past its due date. */
export const canMarkOverdue = (status: BillStatus, dueDate: string): boolean =>
  status === 'PENDING' && new Date(dueDate).getTime() < Date.now();

export const canPay = (status: BillStatus): boolean =>
  status === 'PENDING' || status === 'OVERDUE';

export const canCancel = (status: BillStatus): boolean =>
  status === 'PENDING' || status === 'OVERDUE';
