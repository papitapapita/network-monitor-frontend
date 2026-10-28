'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  disablePush,
  enablePush,
  getPushSubscription,
  isPushSupported,
  needsHomeScreenInstall,
  registerServiceWorker,
} from '@/services/push';
import { useToast } from '@/contexts/toast.context';
import { Button, SectionTitle, Switch } from '@/components/ui';

type PhoneState =
  | { kind: 'install' } // iPhone in a Safari tab: only the home-screen app gets push
  | { kind: 'unsupported' }
  | { kind: 'ready'; subscribed: boolean; blocked: boolean };

/** What this browser can do, read on the client only — the server has no phone to ask. */
async function readPhoneState(): Promise<PhoneState> {
  if (needsHomeScreenInstall()) return { kind: 'install' };
  if (!isPushSupported()) return { kind: 'unsupported' };
  await registerServiceWorker();
  const subscription = await getPushSubscription();
  return { kind: 'ready', subscribed: !!subscription, blocked: Notification.permission === 'denied' };
}

// The backend's refusals for `POST /api/push/test`, said in the operator's words.
const TEST_ERRORS: Record<number, string> = {
  409: 'Tu usuario no tiene ningún dispositivo con notificaciones activas.',
  502: 'La prueba no llegó a ningún dispositivo. Desactiva y vuelve a activar las notificaciones aquí.',
  503: 'Las notificaciones a dispositivos no están configuradas en este servidor.',
};

type TestOutcome = { ok: true; delivered: number } | { ok: false; message: string };

/**
 * "Activar notificaciones en este dispositivo" (NOT-220…228): the same alerts the
 * install's Telegram chat gets, on the signed-in user's own phone. Every role
 * may turn it on; it is per browser, so each phone is switched on its own.
 * Hidden entirely when the server has no VAPID keys.
 */
export function PhoneNotificationsCard({ className = '' }: { className?: string }) {
  const { showError, showSuccess } = useToast();
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOutcome, setTestOutcome] = useState<TestOutcome | null>(null);

  const { data: key } = useQuery({
    queryKey: ['push', 'public-key'],
    queryFn: async () => {
      const r = await apiService.getPushPublicKey();
      if (!r.success || !r.data) throw new Error(r.error);
      return r.data;
    },
    staleTime: Infinity,
  });
  const enabled = !!key?.enabled && !!key.publicKey;

  const { data: phone, refetch } = useQuery({
    queryKey: ['push', 'this-phone'],
    queryFn: readPhoneState,
    enabled,
  });

  if (!enabled || !phone) return null;

  const toggle = async (on: boolean) => {
    if (!key?.publicKey) return;
    setBusy(true);
    setTestOutcome(null);
    const r = on ? await enablePush(key.publicKey) : await disablePush();
    setBusy(false);
    if (!r.ok) showError(r.error);
    else showSuccess(on ? 'Notificaciones activadas en este dispositivo.' : 'Notificaciones desactivadas en este dispositivo.');
    refetch();
  };

  const sendTest = async () => {
    setTesting(true);
    setTestOutcome(null);
    const r = await apiService.sendTestPush();
    setTesting(false);
    setTestOutcome(
      r.success && r.data
        ? { ok: true, delivered: r.data.delivered }
        : { ok: false, message: TEST_ERRORS[r.status ?? 0] ?? r.error ?? 'No se pudo enviar la notificación de prueba' }
    );
  };

  return (
    <section
      aria-label="Notificaciones en este dispositivo"
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ${className}`}
    >
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <SectionTitle
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
          info="Recibe en este dispositivo las mismas alertas que llegan al chat de Telegram de la instalación, con sus mismos horarios de silencio y alertas silenciadas. Se activa por separado en cada dispositivo o navegador."
        >
          Notificaciones en este dispositivo
        </SectionTitle>
      </div>
      <div className="px-6 py-5 space-y-4">
        {phone.kind === 'install' ? (
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
            <p>En iPhone, las notificaciones solo llegan a la app instalada en la pantalla de inicio:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Toca <strong>Compartir</strong> en la barra de Safari.
              </li>
              <li>
                Elige <strong>Agregar a inicio</strong>.
              </li>
              <li>Abre Mi Red Control desde ese ícono y vuelve aquí para activarlas.</li>
            </ol>
            <p className="text-xs text-gray-500 dark:text-gray-400">Requiere iOS 16.4 o posterior.</p>
          </div>
        ) : phone.kind === 'unsupported' ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Este navegador no admite notificaciones. En Android usa Chrome; en iPhone, Safari.
          </p>
        ) : (
          <>
            <Switch
              id="push-this-phone"
              label="Activar notificaciones en este dispositivo"
              description={
                phone.blocked
                  ? 'Las notificaciones están bloqueadas para este sitio: permítelas en los ajustes del navegador.'
                  : 'Al activarlas, el navegador te pedirá permiso.'
              }
              checked={phone.subscribed}
              disabled={busy || (phone.blocked && !phone.subscribed)}
              onChange={(e) => toggle(e.target.checked)}
            />
            {phone.subscribed && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={sendTest} isLoading={testing} disabled={busy}>
                  Enviar prueba
                </Button>
                {testOutcome && (
                  <span
                    role="status"
                    className={`text-sm ${
                      testOutcome.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {testOutcome.ok
                      ? testOutcome.delivered === 1
                        ? 'Enviada a 1 dispositivo.'
                        : `Enviada a ${testOutcome.delivered} dispositivos.`
                      : testOutcome.message}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
