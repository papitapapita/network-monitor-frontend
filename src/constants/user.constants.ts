import type { UserRole } from '../types/auth.types';
import type { AssignableRole } from '../types/user.types';
import type { BadgeVariant } from '@/components/ui';

export const ROLE_LABELS: Record<UserRole, string> = {
  VENDOR: 'Proveedor',
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  VIEWER: 'Lector',
};

export const ROLE_VARIANTS: Record<UserRole, BadgeVariant> = {
  VENDOR: 'active',
  ADMIN: 'info',
  OPERATOR: 'neutral',
  VIEWER: 'draft',
};

/** VENDOR is set from the server's environment, never given through the API (IDN-011). */
export const ASSIGNABLE_ROLE_OPTIONS: { value: AssignableRole; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador — todo, incluidos los usuarios' },
  { value: 'OPERATOR', label: 'Operador — crea y modifica, no elimina' },
  { value: 'VIEWER', label: 'Lector — solo consulta' },
];

/** IDN-142 / IDN-012: staff passwords 8–200 characters, the vendor's at least 12. */
export const STAFF_PASSWORD_MIN = 8;
export const VENDOR_PASSWORD_MIN = 12;
export const STAFF_PASSWORD_MAX = 200;
