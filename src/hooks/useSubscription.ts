import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import { SubscriptionStatusDTO } from '@/types/subscription.types';

export const SUBSCRIPTION_QUERY_KEY = ['subscription'] as const;

/** The stages move with the calendar, not with anything the app does. */
const SUBSCRIPTION_REFRESH_MS = 5 * 60_000;

const NOT_ENFORCED: SubscriptionStatusDTO = {
  state: 'NOT_ENFORCED',
  paidThrough: null,
  graceEndsAt: null,
  lockedAt: null,
  readOnly: false,
  locked: false,
};

/**
 * The install's subscription stage (R17). Any 402 from the API means the
 * stage just moved, so it is re-read at once rather than at the next tick.
 * Until it answers — or if it cannot — nothing is restricted: the backend
 * still refuses what it must, and each refusal re-reads this.
 */
export function useSubscription(): SubscriptionStatusDTO {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const onPaymentRequired = () => queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    window.addEventListener('nms:payment-required', onPaymentRequired);
    return () => window.removeEventListener('nms:payment-required', onPaymentRequired);
  }, [queryClient]);

  const { data } = useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getSubscription();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al leer la suscripción');
      return r.data;
    },
    enabled: isAuthenticated,
    refetchInterval: SUBSCRIPTION_REFRESH_MS,
  });

  return data ?? NOT_ENFORCED;
}
