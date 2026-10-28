import { apiService } from './api.service';
import type { PushSubscriptionBody } from '@/types/push.types';

/**
 * Phone notifications on the browser side (NOT-220…228): the service worker in
 * `public/sw.js` shows what the backend pushes, and this module turns a
 * subscription on and off for the signed-in user. The switch's state is
 * simply whether the browser holds a subscription.
 */

/** Whether this browser can receive web push at all, as it is open right now. */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own flag for a page opened from the home screen.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * iPhone and iPad only push from the home-screen icon (iOS 16.4+): in a Safari
 * tab there is no PushManager, so this, not "unsupported", is what to say.
 */
export function needsHomeScreenInstall(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch is what gives it away.
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return isIos && !isStandalone();
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

function toBody(subscription: PushSubscription): PushSubscriptionBody {
  return subscription.toJSON() as PushSubscriptionBody;
}

/** The VAPID key arrives base64url; `pushManager.subscribe` wants the raw bytes. */
function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type EnablePushResult = { ok: true } | { ok: false; error: string };

/**
 * Must run from a tap: iOS refuses a permission prompt nobody asked for.
 * A browser subscription the server then rejects is rolled back, so the
 * switch never shows on for a phone the backend won't reach.
 */
export async function enablePush(publicKey: string): Promise<EnablePushResult> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      error:
        permission === 'denied'
          ? 'Las notificaciones están bloqueadas para este sitio. Permítelas en los ajustes del navegador y vuelve a intentarlo.'
          : 'No se concedió el permiso de notificaciones.',
    };
  }
  const registration = await navigator.serviceWorker.ready;
  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    });
  } catch {
    return { ok: false, error: 'Este navegador no pudo activar las notificaciones.' };
  }
  const r = await apiService.subscribePush(toBody(subscription));
  if (!r.success) {
    await subscription.unsubscribe().catch(() => undefined);
    return { ok: false, error: r.error || 'El servidor no aceptó este dispositivo.' };
  }
  return { ok: true };
}

export async function disablePush(): Promise<EnablePushResult> {
  const subscription = await getPushSubscription();
  if (!subscription) return { ok: true };
  const { endpoint } = subscription;
  await subscription.unsubscribe().catch(() => undefined);
  const r = await apiService.unsubscribePush(endpoint);
  return r.success ? { ok: true } : { ok: false, error: r.error || 'No se pudo desactivar en el servidor.' };
}

/**
 * On every signed-in load: re-sending an existing subscription is idempotent,
 * and keeps the server current when the browser rotated its keys or another
 * user signed in on this phone (the phone then moves to them).
 */
export async function syncPushSubscription(): Promise<void> {
  if (!isPushSupported()) return;
  await registerServiceWorker();
  const subscription = await getPushSubscription();
  if (subscription) await apiService.subscribePush(toBody(subscription));
}
