import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';

export const BILLING_SETTINGS_QUERY_KEY = ['billing-settings'] as const;

/** The install's billing cycle (BIL-280). Every role may read it; billing module only. */
export function useBillingSettings() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: BILLING_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getBillingSettings();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar la configuración de facturación');
      return r.data;
    },
    enabled: isAuthenticated,
  });
}
