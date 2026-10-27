'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { withSavedListQuery } from '@/hooks/listState';

/** The slice of the Navigation API used here; not yet in TypeScript's DOM lib. */
interface NavigationLike {
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
}

/**
 * How many history steps back the nearest entry for a *different* page is —
 * entries that only change this page's query (its tabs) are stepped over.
 * 0 when there is no in-app page behind this one; `null` when the browser
 * can't say (no Navigation API), so the caller can fall back to plain
 * `history.back()` instead of guessing.
 */
function stepsToPreviousPage(): number | null {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  if (!nav?.currentEntry) return null;
  const entries = nav.entries();
  for (let i = nav.currentEntry.index - 1; i >= 0; i--) {
    let url: URL;
    try {
      url = new URL(entries[i]?.url ?? '');
    } catch {
      return 0;
    }
    if (url.origin !== window.location.origin) return 0;
    if (url.pathname !== window.location.pathname) return nav.currentEntry.index - i;
  }
  return 0;
}

/**
 * A "back" that means *where the operator came from*. Device -> Location and
 * Back returns to that device, not to the locations list, because it steps
 * back through history rather than pushing a fixed route. Tab switches on the
 * page itself are skipped: the browser's back button walks those, this one
 * leaves the page.
 *
 * When there is no in-app page behind this one (opened from a bookmark, a
 * pasted link, or another site), `history.back()` would do nothing or leave the
 * app, so it goes to `fallbackHref` instead — with the list's remembered
 * filters, so it lands on the table as the operator last left it.
 */
export function useGoBack(fallbackHref: string) {
  const router = useRouter();

  return useCallback(() => {
    const steps = stepsToPreviousPage();
    if (steps === 0) {
      router.push(withSavedListQuery(fallbackHref));
    } else if (steps === null || steps === 1) {
      router.back();
    } else {
      window.history.go(-steps);
    }
  }, [router, fallbackHref]);
}
