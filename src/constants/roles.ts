import type { UserRole } from '../types/auth.types';

/**
 * VENDOR is the company that runs the install and holds everything ADMIN has
 * (BACKEND_API.md, Roles: "wherever an endpoint lists ADMIN, VENDOR is allowed
 * too"). Every "is this an administrator" question goes through here so the
 * two never drift apart again.
 */
export const isAdminRole = (role: UserRole | undefined): boolean => role === 'ADMIN' || role === 'VENDOR';

/** Create, update and activate — everything but VIEWER. */
export const canWriteRole = (role: UserRole | undefined): boolean => isAdminRole(role) || role === 'OPERATOR';

/** `manage-installation` (IDN-033): agent create/re-key/revoke and the data purge. The customer's ADMIN gets 403. */
export const isVendorRole = (role: UserRole | undefined): boolean => role === 'VENDOR';
