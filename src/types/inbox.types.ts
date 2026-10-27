/** What a notice is about — picks its icon (NOT-260). */
export type InboxCategory = 'device' | 'wireless' | 'agent' | 'backup' | 'security' | 'other';

/** One notice in the signed-in user's own inbox (`/api/notifications`). */
export interface InboxNotificationDTO {
  id: string;
  category: InboxCategory;
  severity: 'WARNING' | 'CRITICAL';
  /** A recovery ("volvió a responder"): shown green whatever its severity. */
  resolved: boolean;
  /** The alert type, e.g. `device_unreachable`. */
  type: string;
  /** One sentence, Spanish, ready to show. */
  title: string;
  /** Extra lines; may contain `\n`. */
  body: string | null;
  /** Null once the device is deleted; the notice stays. */
  deviceId: string | null;
  /** Null once the alert is deleted; the notice stays. */
  alertId: string | null;
  occurredAt: string;
  /** Null means unread. */
  readAt: string | null;
  /** When it reached the inbox; the list is ordered by this. */
  createdAt: string;
}

export interface InboxListParams {
  unread?: boolean;
  /** 1–100, 20 by default. */
  limit?: number;
  offset?: number;
}

export interface InboxListDTO {
  notifications: InboxNotificationDTO[];
  /** Matching the filter. */
  total: number;
  /** The user's unread count whatever the filter — the badge. */
  unread: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface InboxStreamHandlers {
  /** The first frame of every connection, then after any tab marks one or all read. */
  onUnread: (unread: number) => void;
  /** A new notice reached this user; `unread` already counts it. */
  onNotification: (notification: InboxNotificationDTO, unread: number) => void;
}
