'use client';

import { useSyncExternalStore } from 'react';

/**
 * The last filters/sort/page-size each list page was left with, remembered for
 * the tab's session so leaving a list through the sidebar and coming back
 * (Dispositivos -> Ubicaciones -> Dispositivos) lands on the same table.
 *
 * `sessionStorage`, not `localStorage`: the memory ends with the tab, so filters
 * never resurface days later and make a list look mysteriously empty. It is
 * also cleared on logout so the next person to sign in starts from a clean list.
 *
 * The page number is deliberately not remembered — a stale page 5 on a
 * narrower result set shows an empty table, and page 1 is where anyone
 * re-entering a list expects to be.
 */
const KEY_PREFIX = 'nms:list-state:';
const listeners = new Set<() => void>();

/** Query params that are position, not filter — never restored. */
const isPageParam = (key: string) => key === 'page' || key.endsWith('Page');

const notify = () => listeners.forEach((onChange) => onChange());

function readStorage(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

/** Query string (with leading `?`, or empty) last saved for `pathname`. */
export function getSavedListQuery(pathname: string): string {
  const qs = readStorage(KEY_PREFIX + pathname);
  return qs ? `?${qs}` : '';
}

/** `pathname` plus its saved query — where a "back to the list" link should go. */
export function withSavedListQuery(href: string): string {
  return href.includes('?') ? href : href + getSavedListQuery(href);
}

export function saveListQuery(pathname: string, search: URLSearchParams) {
  const params = new URLSearchParams();
  search.forEach((value, key) => {
    if (!isPageParam(key)) params.append(key, value);
  });
  const qs = params.toString();
  try {
    if (qs === readStorage(KEY_PREFIX + pathname)) return;
    if (qs) sessionStorage.setItem(KEY_PREFIX + pathname, qs);
    else sessionStorage.removeItem(KEY_PREFIX + pathname);
  } catch {
    return;
  }
  notify();
}

export function clearSavedListQueries() {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(KEY_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    return;
  }
  notify();
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

/**
 * `href` with the list's saved query appended, for navigation links. Renders
 * the bare `href` on the server and first paint, then picks up the saved query.
 */
export function useSavedListHref(href: string): string {
  const query = useSyncExternalStore(
    subscribe,
    () => getSavedListQuery(href),
    () => ''
  );
  return href + query;
}
