import { useAuth } from '@/contexts/auth.context';
import { useSubscription } from './useSubscription';
import { canWriteRole, isAdminRole, isVendorRole } from '@/constants/roles';

/**
 * What the signed-in user may change right now: their role, narrowed by the
 * subscription. While it is read-only every write answers 402, so every
 * control that writes is hidden or disabled rather than left to fail.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { readOnly } = useSubscription();
  const role = user?.role;
  return {
    readOnly,
    canWrite: canWriteRole(role) && !readOnly,
    isAdmin: isAdminRole(role) && !readOnly,
    isVendor: isVendorRole(role) && !readOnly,
  };
}
