'use client';

import React from 'react';
import { SubscriptionStatusDTO } from '@/types/subscription.types';
import { useNow } from '@/hooks/useWirelessThroughput';

/** "5 de octubre" — the stages turn on dates, not times. */
const formatDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long' }) : '—';

/** How close to the end of a paid period the renewal hint appears. */
const RENEWAL_HINT_DAYS = 5;

const TONES = {
  info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
  warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
  danger: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
};

/**
 * One line across the top of every page for the stages that still let the
 * dashboard open (R17). READ_ONLY in particular has to say that alerts are
 * off, so an empty alert feed is not read as a quiet network.
 */
export function SubscriptionBanner({ subscription }: { subscription: SubscriptionStatusDTO }) {
  const now = useNow(60 * 60_000);
  const { state, paidThrough, graceEndsAt, lockedAt } = subscription;

  let tone: keyof typeof TONES;
  let message: React.ReactNode;
  if (state === 'READ_ONLY') {
    tone = 'danger';
    message = (
      <>
        <strong>Suscripción vencida: el sistema está en solo lectura.</strong> No se está monitoreando ningún equipo y las
        alertas están apagadas; nada se ha borrado. El acceso se bloqueará el {formatDay(lockedAt)} si no se registra el
        pago.
      </>
    );
  } else if (state === 'GRACE') {
    tone = 'warning';
    message = (
      <>
        <strong>Pago pendiente.</strong> Todo sigue funcionando, pero desde el {formatDay(graceEndsAt)} el sistema pasará a
        solo lectura y dejará de monitorear.
      </>
    );
  } else if (
    state === 'ACTIVE' &&
    paidThrough &&
    Date.parse(paidThrough) - now <= RENEWAL_HINT_DAYS * 86_400_000
  ) {
    tone = 'info';
    message = <>La suscripción está pagada hasta el {formatDay(paidThrough)}. Recuerda renovarla.</>;
  } else {
    return null;
  }

  return (
    <div role="status" className={`border-b px-4 py-2.5 text-sm ${TONES[tone]}`}>
      {message}
    </div>
  );
}
