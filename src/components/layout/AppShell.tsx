'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/auth.context';
import { LoadingSpinner } from '@/components/ui';
import { StatusPage } from './StatusPage';
import { useInstallation } from '@/hooks/useInstallation';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionBanner } from './SubscriptionBanner';
import { isRouteAvailable } from '@/constants/installation.constants';
import { isVendorRole } from '@/constants/roles';

function LockIcon() {
  return (
    <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path strokeLinecap="round" d="M8 11V7a4 4 0 118 0v4" />
    </svg>
  );
}

function UnavailableIcon() {
  return (
    <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}

/** Sidebar collapse preference, kept in localStorage so it survives reloads. */
const COLLAPSED_KEY = 'nms:sidebar-collapsed';
const collapsedListeners = new Set<() => void>();

const subscribeCollapsed = (onChange: () => void) => {
  collapsedListeners.add(onChange);
  return () => {
    collapsedListeners.delete(onChange);
  };
};
const getCollapsed = () => localStorage.getItem(COLLAPSED_KEY) === '1';
const setCollapsed = (value: boolean) => {
  localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
  collapsedListeners.forEach((onChange) => onChange());
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Server renders expanded; the stored preference kicks in on hydration.
  const sidebarCollapsed = useSyncExternalStore(subscribeCollapsed, getCollapsed, () => false);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const installation = useInstallation();
  const subscription = useSubscription();

  const isLoginPage = pathname === '/login';
  // The vendor's settings answer on a locked install too (INS-030): that is
  // where the payment is recorded.
  const isVendor = isVendorRole(user?.role);
  const paymentHref = isVendor ? '/settings/installation#suscripcion' : undefined;

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, isLoginPage, router]);

  // Handle token expiry from API service
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
      router.replace('/login');
    };
    window.addEventListener('nms:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('nms:unauthorized', handleUnauthorized);
  }, [logout, router]);

  // Login page: render without shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  // While checking auth state
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // LOCKED (R17): every /api route but sign-in answers 402, so there is
  // nothing to show but this — and a way out to sign in as someone else.
  // The vendor alone gets one way in: its settings, to record the payment.
  if (subscription.locked && isVendor && pathname === '/settings/installation') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div role="status" className="border-b px-4 py-2.5 text-sm bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Instalación bloqueada.</strong> Registra el pago en «Suscripción» y guarda: el acceso vuelve al instante.
          </span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="underline"
          >
            Cerrar sesión
          </button>
        </div>
        <main>{children}</main>
      </div>
    );
  }

  if (subscription.locked) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900">
        <StatusPage
          fullScreen
          icon={<LockIcon />}
          iconTone="red"
          title="Acceso bloqueado"
          description={
            paymentHref
              ? 'La suscripción de esta instalación está vencida. Los datos se conservan intactos; registra el pago para que el acceso vuelva al instante.'
              : 'La suscripción de esta instalación está vencida. Los datos se conservan intactos; el acceso vuelve en cuanto se registre el pago. Comunícate con el proveedor del sistema.'
          }
          primaryAction={
            paymentHref
              ? { label: 'Registrar pago', href: paymentHref }
              : {
                  label: 'Cerrar sesión',
                  onClick: () => {
                    logout();
                    router.replace('/login');
                  },
                }
          }
          secondaryAction={
            paymentHref
              ? {
                  label: 'Cerrar sesión',
                  onClick: () => {
                    logout();
                    router.replace('/login');
                  },
                }
              : undefined
          }
        />
      </div>
    );
  }

  // A form that can only end in 402 is not worth opening.
  const blockedByReadOnly = subscription.readOnly && /\/(create|edit)(\/|$)/.test(pathname);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setCollapsed(!sidebarCollapsed)}
      />

      <div
        className={`flex flex-col flex-1 min-w-0 transition-[margin] duration-200 ${
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'
        }`}
      >
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center h-14 px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Abrir menú"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Network Monitor</span>
        </header>

        {/* x hidden: an edge-positioned IconButton's tooltip label stays in
            layout while invisible (opacity doesn't remove it from flow), so
            without this a tooltip like "Eliminar dispositivo" near the right
            edge quietly pokes past the viewport and turns this into a
            horizontally-scrollable container. Every wide-content component
            (tables, the device detail tab bar) already scrolls within its
            own wrapper, so main never legitimately needs to scroll sideways. */}
        <SubscriptionBanner subscription={subscription} paymentHref={paymentHref} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {/* A saved link into a module this install does not run: its API
              answers 404 on every call, so say so once instead of letting the
              page fail request by request. */}
          {blockedByReadOnly ? (
            <StatusPage
              icon={<LockIcon />}
              iconTone="amber"
              title="Sistema en solo lectura"
              description="La suscripción está vencida, así que no se pueden crear ni modificar registros. Puedes seguir consultando todo."
              primaryAction={{ label: 'Volver atrás', onClick: () => router.back() }}
            />
          ) : installation.isLoaded && !isRouteAvailable(pathname, installation) ? (
            <StatusPage
              icon={<UnavailableIcon />}
              iconTone="amber"
              title="No disponible en esta instalación"
              description={
                pathname.startsWith('/network-scan')
                  ? 'El servidor de esta instalación no está en la red monitoreada, así que no puede escanearla. Los agentes vigilan esa red desde adentro.'
                  : 'Esta sección pertenece a un módulo que no está activo en esta instalación. Si lo necesitas, habla con el proveedor del sistema.'
              }
              primaryAction={{ label: 'Volver al inicio', href: '/' }}
            />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
