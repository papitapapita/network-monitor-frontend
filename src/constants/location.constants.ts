import type { BadgeVariant } from '@/components/ui';
import type { LocationType } from '@/types/location.types';

export const LOCATION_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar tipo' },
  { value: 'TOWER', label: 'Torre' },
  { value: 'DATACENTER', label: 'Datacenter' },
  { value: 'POINT_OF_PRESENCE', label: 'Punto de Presencia' },
  { value: 'OFFICE', label: 'Oficina' },
  { value: 'CUSTOMER_PREMISES', label: 'Instalación de cliente' },
  { value: 'OTHER', label: 'Otro' },
];

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  TOWER: 'Torre',
  DATACENTER: 'Datacenter',
  POINT_OF_PRESENCE: 'Punto de Presencia',
  OFFICE: 'Oficina',
  CUSTOMER_PREMISES: 'Instalación Cliente',
  OTHER: 'Otro',
};

export const LOCATION_TYPE_BADGE_VARIANTS: Record<LocationType, BadgeVariant> = {
  TOWER: 'info',
  DATACENTER: 'warning',
  POINT_OF_PRESENCE: 'draft',
  OFFICE: 'neutral',
  CUSTOMER_PREMISES: 'neutral',
  OTHER: 'neutral',
};

export const LOCATION_TYPE_COLORS: Record<LocationType, string> = {
  TOWER: '#3b82f6',
  DATACENTER: '#8b5cf6',
  POINT_OF_PRESENCE: '#f59e0b',
  OFFICE: '#ec4899',
  CUSTOMER_PREMISES: '#f97316',
  OTHER: '#9ca3af',
};
