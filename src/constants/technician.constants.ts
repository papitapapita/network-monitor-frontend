import type { BadgeVariant } from '@/components/ui';

export const technicianActiveLabel = (isActive: boolean): string =>
  isActive ? 'Activo' : 'Inactivo';

export const technicianActiveVariant = (isActive: boolean): BadgeVariant =>
  isActive ? 'active' : 'neutral';

/**
 * The list endpoint takes `activeOnly` as a boolean, so the filter only has an
 * "everyone" and an "assignable" setting — there is no server-side way to ask
 * for the retired ones alone.
 */
export const TECHNICIAN_ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'Todos los técnicos' },
  { value: 'true', label: 'Solo activos' },
];

/**
 * A technician who has tickets cannot be deleted (TKT-097) — the FK is SET NULL,
 * so deleting would blank the technician on every ticket they ever worked and
 * erase who did what. Retiring them is the supported path.
 */
export const DEACTIVATE_INSTEAD_MESSAGE =
  'No se puede eliminar el técnico: tiene tickets asociados. Desactívalo en su lugar para quitarlo de la rota sin perder su historial.';
