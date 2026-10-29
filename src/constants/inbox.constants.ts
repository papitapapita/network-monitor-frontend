import type { InboxCategory, InboxNotificationDTO } from '@/types/inbox.types';

/** Notices older than this are deleted by the backend, read or not (NOT-268). */
export const INBOX_RETENTION_DAYS = 90;

/** How long a live notice's corner card stays up unless hovered. */
export const INBOX_CARD_MS = 8_000;
/** Corner cards on screen at once; an older one makes room for a newer. */
export const INBOX_MAX_CARDS = 3;

export const INBOX_CATEGORY_LABELS: Record<InboxCategory, string> = {
  device: 'Dispositivo',
  wireless: 'Inalámbrico',
  agent: 'Agente',
  backup: 'Respaldo',
  security: 'Seguridad',
  other: 'Aviso',
};

export type InboxTone = 'resolved' | 'critical' | 'warning';

/** A recovery is green whatever severity the alert it closes had. */
export function inboxTone(notification: Pick<InboxNotificationDTO, 'resolved' | 'severity'>): InboxTone {
  if (notification.resolved) return 'resolved';
  return notification.severity === 'CRITICAL' ? 'critical' : 'warning';
}

/**
 * Where opening a notice leads: its alert, else its device. A port notice opens
 * its router on /port-speeds, a MikroTik's reboot or health its row on the
 * routers' status tab, a discovery the discovered devices. Security notices
 * name an account, which is managed on /users. Null when what it named was
 * deleted.
 */
export function inboxHref(notification: InboxNotificationDTO): string | null {
  if (notification.alertId) return `/alerts/${notification.alertId}`;
  // Port and router notices have no alert; the router's card or row says what.
  if ((notification.type === 'port_speed_low' || notification.type === 'port_health') && notification.deviceId) {
    return `/port-speeds#${notification.deviceId}`;
  }
  if ((notification.type === 'router_rebooted' || notification.type === 'router_health') && notification.deviceId) {
    return `/routers?tab=system#${notification.deviceId}`;
  }
  if (notification.deviceId) return `/devices/${notification.deviceId}`;
  // New hosts on the network name no device yet (DEV-206).
  if (notification.type === 'device_discovered') return '/discovered-devices';
  if (notification.category === 'security') return '/users';
  return null;
}

/** "9+" past nine, so the badge keeps its size. */
export const formatUnreadBadge = (unread: number): string => (unread > 9 ? '9+' : String(unread));
