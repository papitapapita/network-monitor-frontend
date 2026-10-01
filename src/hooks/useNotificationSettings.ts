import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';

export const NOTIFICATION_SETTINGS_QUERY_KEY = ['notification-settings'] as const;

/** The install's alert chat, down-alert delay and wireless switch (NOT-200). Every role may read them. */
export function useNotificationSettings() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getNotificationSettings();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar la configuración de notificaciones');
      return r.data;
    },
    enabled: isAuthenticated,
  });
}
