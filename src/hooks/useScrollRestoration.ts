'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Scroll offset each URL was left at, for this tab. In `sessionStorage`, like
 * the list filters (see `listState`), so a reload on the detail page — which
 * also empties the query cache, the case where the list comes back shortest —
 * still has somewhere to go back to.
 */
const KEY_PREFIX = 'nms:scroll:';

function savePosition(url: string, y: number) {
  try {
    sessionStorage.setItem(KEY_PREFIX + url, String(Math.round(y)));
  } catch {
    return;
  }
}

function savedPosition(url: string): number {
  try {
    return Number(sessionStorage.getItem(KEY_PREFIX + url)) || 0;
  } catch {
    return 0;
  }
}

/** Set by `popstate`, consumed by the render the history change causes. */
let pendingTarget: number | null = null;

/** The pathname on screen, to tell a `popstate` that changes it from one that doesn't. */
let renderedPathname: string | null = null;

/** Give up waiting for the page to grow tall enough after this long. */
const RESTORE_TIMEOUT_MS = 3000;

const USER_INPUTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

const currentUrl = () => window.location.pathname + window.location.search;

/**
 * Back/forward lands where the page was left. The browser's own restoration
 * runs at `popstate`, while the list being returned to is still a loading
 * state a fraction of its final height, so the offset gets clamped to that
 * and every return from a detail page landed somewhere above where the
 * operator was.
 *
 * So restoration is manual: the target is read at `popstate`, before the
 * incoming page renders (that render's clamp fires a scroll event that would
 * overwrite it), then reapplied as the page grows — rows arriving from the
 * API — until it fits, the operator scrolls on their own, or the timeout
 * passes. Link and sidebar navigation keep Next's scroll to the top.
 *
 * Runs on pathname changes, not the query: list filters move by `replace`, so
 * a history step that only changes the query does not happen in practice, and
 * reading the query here would need a Suspense boundary around the whole shell.
 */
export function useScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    history.scrollRestoration = 'manual';
    const onScroll = () => savePosition(currentUrl(), window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      history.scrollRestoration = 'auto';
    };
  }, []);

  // Capture phase, registered once: Next's own `popstate` handler renders the
  // incoming page synchronously, effects included, so this has to run first.
  useEffect(() => {
    const onPopState = () => {
      // A step that only changes the query renders no new pathname to consume it.
      if (window.location.pathname === renderedPathname) return;
      pendingTarget = savedPosition(currentUrl());
    };
    window.addEventListener('popstate', onPopState, { capture: true });
    return () => window.removeEventListener('popstate', onPopState, { capture: true });
  }, []);

  useEffect(() => {
    renderedPathname = pathname;
    const target = pendingTarget;
    pendingTarget = null;
    if (target === null) return;

    // Mutations, not a ResizeObserver: the page element itself is swapped out
    // as it goes from loading to loaded, and a mutation is what grows it.
    const observer = new MutationObserver(() => apply());
    const stop = () => {
      observer.disconnect();
      clearTimeout(timeout);
      USER_INPUTS.forEach((type) => window.removeEventListener(type, stop));
    };
    const timeout = setTimeout(() => stop(), RESTORE_TIMEOUT_MS);
    const apply = () => {
      window.scrollTo(0, target);
      if (window.scrollY >= target - 1) stop();
    };

    USER_INPUTS.forEach((type) => window.addEventListener(type, stop, { passive: true }));
    observer.observe(document.body, { childList: true, subtree: true });
    apply();
    return stop;
  }, [pathname]);
}
