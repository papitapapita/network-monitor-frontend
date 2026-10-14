import type { BadgeVariant } from '@/components/ui';
import type { ContractedServiceStatus } from '@/types/customer.types';

export const CONTRACT_STATUS_LABELS: Record<ContractedServiceStatus, string> = {
  PENDING: 'Pendiente',
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
};

export const CONTRACT_STATUS_VARIANTS: Record<ContractedServiceStatus, BadgeVariant> = {
  PENDING: 'draft',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'danger',
};

// The backend only accepts these as update targets; PENDING is a start state.
export const CONTRACT_TARGET_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export const formatPlanPrice = (n: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
