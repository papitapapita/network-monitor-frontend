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

/** Every account's password is 12–200 characters (8 for staff before 2026-10-05). */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 200;
