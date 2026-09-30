import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import { InstallationDTO } from '@/types/installation.types';

export const INSTALLATION_QUERY_KEY = ['installation'] as const;

/**
 * How the app behaved before the backend could say otherwise. Used while the
 * request is in flight and if it fails, so a hiccup hides nothing: a module
 * that turns out to be off answers 404 on its own pages, which is no worse
 * than before this endpoint existed.
 */
const EVERYTHING_ON: InstallationDTO = {
  modules: { customers: true, billing: true, quoting: true, tickets: true, enforcement: true },
  serverOnSite: true,
  agentPairingAvailable: true,
  installersAvailable: true,
};

/**
 * What this install runs (INS-009). Fixed until the vendor restarts the
 * backend, so it is read once per session and never refetched on its own.
 */
export function useInstallation(): InstallationDTO & { isLoaded: boolean } {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: INSTALLATION_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getInstallation();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al leer la instalación');
      return r.data;
    },
    enabled: isAuthenticated,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  return { ...(data ?? EVERYTHING_ON), isLoaded: !!data };
}
