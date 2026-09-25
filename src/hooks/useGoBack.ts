'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { withSavedListQuery } from '@/hooks/listState';

/** The slice of the Navigation API used here; not yet in TypeScript's DOM lib. */
interface NavigationLike {
  canGoBack: boolean;
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
}

/**
 * Whether the previous history entry is another page of this app. `null` when
 * the browser can't say (no Navigation API), so the caller can fall back to
 * plain `history.back()` instead of guessing.
 */
function previousEntryIsInApp(): boolean | null {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  if (!nav?.currentEntry) return null;
  if (!nav.canGoBack) return false;
  const previous = nav.entries()[nav.currentEntry.index - 1];
  if (!previous?.url) return false;
  try {
    return new URL(previous.url).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * A "back" that means *where the operator came from*. Device -> Location and
 * Back returns to that device, not to the locations list, because it steps
 * back through history rather than pushing a fixed route.
 *
 * When there is no in-app page behind this one (opened from a bookmark, a
 * pasted link, or another site), `history.back()` would do nothing or leave the
 * app, so it goes to `fallbackHref` instead — with the list's remembered
 * filters, so it lands on the table as the operator last left it.
 */
export function useGoBack(fallbackHref: string) {
  const router = useRouter();

  return useCallback(() => {
    if (previousEntryIsInApp() === false) {
      router.push(withSavedListQuery(fallbackHref));
    } else {
      router.back();
    }
  }, [router, fallbackHref]);
}
