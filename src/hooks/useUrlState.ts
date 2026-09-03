'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SortDirection, TableSort } from '@/components/ui';

export type UrlStateValue = string | number | null;

/**
 * Keeps a list page's pagination, filters and sort in the URL instead of
 * component state. Navigating to a detail page and coming back with the
 * browser's back button lands on the same URL, so the table reappears where
 * it was — page, filters and sort intact — instead of resetting to page 1.
 *
 * `set` uses `router.replace` so a filter or page change never grows the
 * history stack: only the `/devices` -> `/devices/:id` hop does that, which
 * is exactly the one entry back navigation should undo.
 */
export function useUrlState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const get = useCallback(
    (key: string, defaultValue = ''): string => searchParams.get(key) ?? defaultValue,
    [searchParams]
  );

  const getNumber = useCallback(
    (key: string, defaultValue: number): number => {
      const n = Number(searchParams.get(key));
      return Number.isFinite(n) && n > 0 ? n : defaultValue;
    },
    [searchParams]
  );

  /** Merges `updates` into the query string in one history entry; `null`/`''` removes a key. */
  const set = useCallback(
    (updates: Record<string, UrlStateValue>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') params.delete(key);
        else params.set(key, String(value));
      });
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  return { get, getNumber, set };
}

/**
 * A `TableSort` backed by the `sort`/`dir` query params instead of local
 * state, so the sorted column survives navigating away and back. Changing
 * the sort resets `page` (or whatever `pageParam` names) — a resort makes the
 * old page number meaningless.
 */
export function useUrlTableSort(
  { get, set }: Pick<ReturnType<typeof useUrlState>, 'get' | 'set'>,
  pageParam = 'page'
): TableSort {
  const field = get('sort', '') || null;
  const direction = get('dir', 'asc') as SortDirection;

  const onSort = (next: string) => {
    if (field === next) {
      set({ dir: direction === 'asc' ? 'desc' : 'asc', [pageParam]: null });
    } else {
      set({ sort: next, dir: 'asc', [pageParam]: null });
    }
  };

  return { field, direction, onSort };
}
