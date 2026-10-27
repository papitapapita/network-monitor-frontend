'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useInbox, inboxListKey } from '@/contexts/inbox.context';
import { useToast } from '@/contexts/toast.context';
import { formatUnreadBadge } from '@/constants/inbox.constants';
import { LoadingSpinner } from '@/components/ui';
import { InboxItem } from './InboxItem';

/** How many of the newest notices the dropdown shows; the rest are on /notifications. */
const DROPDOWN_LIMIT = 8;
const PANEL_WIDTH = 384;
const GAP = 8;

const BELL_PATH =
  'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={BELL_PATH} />
    </svg>
  );
}

function UnreadBadge({ unread, className = '' }: { unread: number; className?: string }) {
  return (
    <span
      data-testid="inbox-badge"
      className={`min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-semibold leading-5 text-center ${className}`}
    >
      {formatUnreadBadge(unread)}
    </span>
  );
}

/**
 * Where the panel sits: beside the sidebar, its bottom level with the bell,
 * or under the mobile top bar across the screen.
 */
function panelPosition(anchor: DOMRect, placement: 'side' | 'below'): React.CSSProperties {
  if (placement === 'below') {
    return { top: anchor.bottom + GAP, right: GAP, left: GAP, maxHeight: window.innerHeight - anchor.bottom - 2 * GAP };
  }
  return {
    left: anchor.right + GAP,
    bottom: Math.max(GAP, window.innerHeight - anchor.bottom),
    width: PANEL_WIDTH,
    maxHeight: anchor.bottom - GAP,
  };
}

function InboxPanel({ onClose }: { onClose: () => void }) {
  const { unread, markAllRead } = useInbox();
  const { showError } = useToast();
  const [marking, setMarking] = useState(false);
  const params = { unread: false, limit: DROPDOWN_LIMIT, offset: 0 };
  const list = useQuery({
    queryKey: inboxListKey(params),
    queryFn: async () => {
      const result = await apiService.getInbox(params);
      if (!result.success || !result.data) throw new Error(result.error || 'No se pudieron cargar las notificaciones');
      return result.data;
    },
  });

  const handleMarkAll = async () => {
    setMarking(true);
    if (!(await markAllRead())) showError('No se pudieron marcar las notificaciones como leídas');
    setMarking(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notificaciones</h2>
        {(unread ?? 0) > 0 && (
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={marking}
            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.isPending ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : list.isError ? (
          <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">{list.error.message}</p>
        ) : list.data.notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No tienes notificaciones.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {list.data.notifications.map((n) => (
              <InboxItem key={n.id} notification={n} compact onOpened={onClose} />
            ))}
          </ul>
        )}
      </div>
      <Link
        href="/notifications"
        onClick={onClose}
        className="block px-4 py-2.5 text-center text-sm font-medium text-brand-600 dark:text-brand-400 border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        Ver todas
      </Link>
    </>
  );
}

interface Props {
  /** `sidebar`: a row of the sidebar, its panel opening beside it. `topbar`: an icon in the mobile bar. */
  variant: 'sidebar' | 'topbar';
  /** Sidebar rail mode: icon only, the count on the icon. */
  collapsed?: boolean;
}

/** The bell: the unread count, and a dropdown of the newest notices. */
export function NotificationBell({ variant, collapsed = false }: Props) {
  const { unread } = useInbox();
  const pathname = usePathname();
  // Open on the page it was opened on: navigating anywhere closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((was: boolean) => boolean)) =>
    setOpenOn((prev) => ((typeof next === 'function' ? next(prev === pathname) : next) ? pathname : null));
  const [style, setStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const count = unread ?? 0;
  const label = count > 0 ? `Notificaciones (${count} sin leer)` : 'Notificaciones';

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (buttonRef.current) {
        setStyle(panelPosition(buttonRef.current.getBoundingClientRect(), variant === 'topbar' ? 'below' : 'side'));
      }
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, variant]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenOn(null);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = open || pathname.startsWith('/notifications');

  return (
    <>
      {variant === 'topbar' ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={label}
          aria-expanded={open}
          data-testid="inbox-bell"
          className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <BellIcon />
          {count > 0 && <UnreadBadge unread={count} className="absolute -top-0.5 -right-0.5" />}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={label}
          aria-expanded={open}
          title={collapsed ? label : undefined}
          data-testid="inbox-bell"
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            collapsed ? 'md:justify-center md:px-0' : ''
          } ${
            active
              ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <span className={`relative shrink-0 ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'}`}>
            <BellIcon />
            {collapsed && count > 0 && <UnreadBadge unread={count} className="absolute -top-2 -right-2.5 hidden md:block" />}
          </span>
          <span className={collapsed ? 'md:sr-only' : 'whitespace-nowrap'}>Notificaciones</span>
          {count > 0 && <UnreadBadge unread={count} className={`ml-auto ${collapsed ? 'md:hidden' : ''}`} />}
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notificaciones"
            style={style}
            className="fixed z-[80] flex flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
          >
            <InboxPanel onClose={() => setOpen(false)} />
          </div>,
          document.body
        )}
    </>
  );
}
