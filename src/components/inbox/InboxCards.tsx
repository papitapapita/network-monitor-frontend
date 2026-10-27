'use client';

import React, { useEffect, useState } from 'react';
import type { InboxNotificationDTO } from '@/types/inbox.types';
import { INBOX_CARD_MS } from '@/constants/inbox.constants';
import { InboxCategoryIcon, useOpenNotification } from './InboxItem';

interface CardProps {
  notification: InboxNotificationDTO;
  onDismiss: (id: string) => void;
}

/** A notice that just arrived. Hovering holds it; clicking opens it. */
function InboxCard({ notification, onDismiss }: CardProps) {
  const open = useOpenNotification();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(notification.id), INBOX_CARD_MS);
    return () => clearTimeout(timer);
  }, [paused, notification.id, onDismiss]);

  return (
    <div
      data-testid="inbox-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto animate-toast-in overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg shadow-black/10"
    >
      <div className="flex items-start gap-3 p-3">
        <InboxCategoryIcon notification={notification} />
        <button
          type="button"
          onClick={() => {
            onDismiss(notification.id);
            void open(notification);
          }}
          className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 break-words">{notification.title}</p>
          {notification.body && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line break-words line-clamp-3">
              {notification.body}
            </p>
          )}
        </button>
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          className="shrink-0 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span className="sr-only">Descartar</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface ViewportProps {
  cards: InboxNotificationDTO[];
  onDismiss: (id: string) => void;
}

/**
 * Live notices, bottom right — the toasts own the top right, and those answer
 * what the user just did. Dismissing a card leaves the notice unread in the
 * inbox.
 */
export function InboxCardViewport({ cards, onDismiss }: ViewportProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(calc(100vw-2rem),24rem)] flex-col-reverse gap-2"
    >
      {cards.map((notification) => (
        <InboxCard key={notification.id} notification={notification} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
