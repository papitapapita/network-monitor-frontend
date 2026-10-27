'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { InboxCategory, InboxNotificationDTO } from '@/types/inbox.types';
import { INBOX_CATEGORY_LABELS, inboxHref, inboxTone, type InboxTone } from '@/constants/inbox.constants';
import { formatAgo } from '@/constants/agent.constants';
import { useInbox } from '@/contexts/inbox.context';
import { useToast } from '@/contexts/toast.context';

const CATEGORY_ICON_PATHS: Record<InboxCategory, string> = {
  device:
    'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
  wireless:
    'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0',
  agent: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  backup: 'M4 7v10c0 2 3.6 3 8 3s8-1 8-3V7M4 7c0 2 3.6 3 8 3s8-1 8-3M4 7c0-2 3.6-3 8-3s8 1 8 3m0 5c0 2-3.6 3-8 3s-8-1-8-3',
  security:
    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  other: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
};

const TONE_CLASSES: Record<InboxTone, string> = {
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
};

/** The category's icon in a disc coloured by how bad it is — green for a recovery. */
export function InboxCategoryIcon({ notification }: { notification: InboxNotificationDTO }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[inboxTone(notification)]}`}
      title={INBOX_CATEGORY_LABELS[notification.category]}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={CATEGORY_ICON_PATHS[notification.category]} />
      </svg>
    </span>
  );
}

/**
 * Opening a notice marks it read and follows it to its alert or device. A
 * failed mark is reported but does not hold the navigation back.
 */
export function useOpenNotification() {
  const router = useRouter();
  const { markRead } = useInbox();
  const { showError } = useToast();
  return async (notification: InboxNotificationDTO) => {
    const href = inboxHref(notification);
    if (href) router.push(href);
    if (!(await markRead(notification))) showError('No se pudo marcar la notificación como leída');
  };
}

interface Props {
  notification: InboxNotificationDTO;
  /** Body cut to two lines, for the bell's dropdown. */
  compact?: boolean;
  /** Runs after the notice is opened, e.g. to close the dropdown. */
  onOpened?: () => void;
}

/** One notice in a list: unread ones bold, with a dot and a «marcar como leída». */
export function InboxItem({ notification, compact = false, onOpened }: Props) {
  const open = useOpenNotification();
  const { markRead } = useInbox();
  const { showError } = useToast();
  const unread = notification.readAt === null;
  const href = inboxHref(notification);

  return (
    <li
      data-testid="inbox-item"
      data-unread={unread || undefined}
      className={`group relative flex gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
        unread ? 'bg-brand-50/40 dark:bg-brand-900/10' : ''
      }`}
    >
      <InboxCategoryIcon notification={notification} />
      <button
        type="button"
        onClick={() => {
          void open(notification);
          onOpened?.();
        }}
        className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        title={href ? undefined : 'Lo que nombraba ya no existe'}
      >
        <p
          className={`text-sm break-words ${
            unread ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p
            className={`mt-0.5 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line break-words ${
              compact ? 'line-clamp-2' : ''
            }`}
          >
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500" title={new Date(notification.occurredAt).toLocaleString('es')}>
          {INBOX_CATEGORY_LABELS[notification.category]} · {formatAgo(notification.occurredAt)}
        </p>
      </button>
      {unread && (
        <button
          type="button"
          onClick={async () => {
            if (!(await markRead(notification))) showError('No se pudo marcar la notificación como leída');
          }}
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="Marcar como leída"
          title="Marcar como leída"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-brand-600 dark:bg-brand-400" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
