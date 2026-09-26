import type { BadgeVariant } from '@/components/ui';
import type { CollectionAccountDTO, CollectionAccountStatus } from '@/types/collection-account.types';

export const COLLECTION_ACCOUNT_STATUS_LABELS: Record<CollectionAccountStatus, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagada',
  CANCELLED: 'Anulada',
};

export const COLLECTION_ACCOUNT_STATUS_VARIANTS: Record<CollectionAccountStatus, BadgeVariant> = {
  PENDING: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
};

export const COLLECTION_ACCOUNT_STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PAID', label: 'Pagada' },
  { value: 'CANCELLED', label: 'Anulada' },
];

/** PAID and CANCELLED are terminal; both actions only leave PENDING. */
export const canPayCollectionAccount = (status: CollectionAccountStatus): boolean => status === 'PENDING';

export const canCancelCollectionAccount = (status: CollectionAccountStatus): boolean => status === 'PENDING';

/** The printed number ('CC-0007'), falling back to the raw sequence value. */
export const collectionAccountLabel = (ca: Pick<CollectionAccountDTO, 'number' | 'code'>): string =>
  ca.number ?? (ca.code !== null ? `#${ca.code}` : '—');
