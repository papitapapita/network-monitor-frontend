'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import type { SseState } from '@/services/sse';
import type { InboxListDTO, InboxListParams, InboxNotificationDTO } from '@/types/inbox.types';
import { INBOX_MAX_CARDS } from '@/constants/inbox.constants';
import { InboxCardViewport } from '@/components/inbox/InboxCards';

/** Every inbox list in the query cache sits under this key. */
export const INBOX_QUERY_KEY = ['inbox'] as const;

export const inboxListKey = (params: Required<InboxListParams>) => [...INBOX_QUERY_KEY, 'list', params] as const;

/** Without the stream the badge is refreshed this often, so it never sits stale for long. */
const FALLBACK_POLL_MS = 60_000;

interface InboxContextValue {
  /** Null until the first count arrives. */
  unread: number | null;
  /** Marks one read, in every cached list too. Never throws; false when the backend refused. */
  markRead: (notification: InboxNotificationDTO) => Promise<boolean>;
  markAllRead: () => Promise<boolean>;
}

const InboxContext = createContext<InboxContextValue | null>(null);

type CachedList = readonly [unknown, InboxListDTO | undefined];

/** Applies `update` to each notification in each cached list. */
function patchCachedLists(client: QueryClient, update: (n: InboxNotificationDTO) => InboxNotificationDTO) {
  client.setQueriesData<InboxListDTO>({ queryKey: INBOX_QUERY_KEY }, (list) =>
    list ? { ...list, notifications: list.notifications.map(update) } : list
  );
}

/**
 * The signed-in user's inbox, live: the unread count for the bell, the corner
 * card for each new notice, and the cached lists kept in step with what any
 * tab does. Mount it once, inside the signed-in shell — it holds the tab's
 * one inbox stream.
 */
export function InboxProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [unread, setUnread] = useState<number | null>(null);
  const [cards, setCards] = useState<InboxNotificationDTO[]>([]);
  const [streamDown, setStreamDown] = useState(false);

  useEffect(() => {
    const close = apiService.streamInbox({
      onState: (state: SseState) => {
        if (state.status === 'live') setStreamDown(false);
        else if (state.status === 'error') setStreamDown(true);
      },
      onUnread: (count) => {
        setUnread(count);
        // The first frame after a (re)connect, or another tab marking: what
        // the lists show may be out of date either way.
        queryClient.invalidateQueries({ queryKey: INBOX_QUERY_KEY });
      },
      onNotification: (notification, count) => {
        setUnread(count);
        setCards((prev) => [notification, ...prev.filter((c) => c.id !== notification.id)].slice(0, INBOX_MAX_CARDS));
        // An open first page takes the notice at its top, with no request; a
        // later page's rows all shift by one, so it is fetched again.
        const lists = queryClient.getQueriesData<InboxListDTO>({ queryKey: INBOX_QUERY_KEY }) as CachedList[];
        for (const [key, list] of lists) {
          if (!list) continue;
          if (list.offset > 0) {
            queryClient.invalidateQueries({ queryKey: key as readonly unknown[], exact: true });
            continue;
          }
          if (list.notifications.some((n) => n.id === notification.id)) continue;
          const notifications = [notification, ...list.notifications];
          queryClient.setQueryData<InboxListDTO>(key as readonly unknown[], {
            ...list,
            notifications: notifications.slice(0, list.limit),
            total: list.total + 1,
            unread: count,
            hasMore: list.hasMore || notifications.length > list.limit,
          });
        }
      },
    });
    return close;
  }, [queryClient]);

  // A stream refused for good (the 10-per-user cap, a dead proxy) leaves the
  // badge to a plain poll, and to coming back to the tab.
  useEffect(() => {
    if (!streamDown) return;
    const refresh = () => {
      apiService.getInboxUnreadCount().then((result) => {
        if (result.success && result.data) setUnread(result.data.unread);
      });
    };
    refresh();
    const timer = setInterval(refresh, FALLBACK_POLL_MS);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [streamDown]);

  const markRead = useCallback(
    async (notification: InboxNotificationDTO) => {
      if (notification.readAt) return true;
      const result = await apiService.markInboxRead(notification.id);
      if (!result.success || !result.data) return false;
      const read = result.data;
      patchCachedLists(queryClient, (n) => (n.id === read.id ? read : n));
      // The stream's `unread` frame follows; this keeps the badge right without it.
      setUnread((u) => (u === null ? u : Math.max(0, u - 1)));
      return true;
    },
    [queryClient]
  );

  const markAllRead = useCallback(async () => {
    const result = await apiService.markInboxAllRead();
    if (!result.success) return false;
    const now = new Date().toISOString();
    patchCachedLists(queryClient, (n) => (n.readAt ? n : { ...n, readAt: now }));
    setUnread(0);
    return true;
  }, [queryClient]);

  const dismissCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const value = useMemo(() => ({ unread, markRead, markAllRead }), [unread, markRead, markAllRead]);

  return (
    <InboxContext.Provider value={value}>
      {children}
      <InboxCardViewport cards={cards} onDismiss={dismissCard} />
    </InboxContext.Provider>
  );
}

export function useInbox(): InboxContextValue {
  const context = useContext(InboxContext);
  if (!context) throw new Error('useInbox must be used within InboxProvider');
  return context;
}
