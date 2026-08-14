'use client';

import React from 'react';
import { Button } from '@/components/ui';
import type { SseState } from '@/services/sse';
import { streamStatusLabel, translateStreamError } from '@/constants/wireless.constants';

const DOT_CLASS: Record<SseState['status'], string> = {
  connecting: 'bg-amber-400',
  live: 'bg-green-500',
  reconnecting: 'bg-amber-400',
  error: 'bg-red-500',
};

/** Dot plus label for a live stream's connection, for a card or page header. */
export function StreamIndicator({ state }: { state: SseState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span className="relative flex h-2 w-2">
        {/* Only the healthy state pulses — a blinking red dot reads as activity. */}
        {state.status === 'live' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${DOT_CLASS[state.status]}`} />
      </span>
      {streamStatusLabel(state)}
    </span>
  );
}

/**
 * The refusal and the way out of it. Renders nothing while the stream is
 * healthy or merely reconnecting on its own — only a stream that gave up needs
 * the operator.
 */
export function StreamErrorNotice({ state, onRetry }: { state: SseState; onRetry: () => void }) {
  if (state.status !== 'error') return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
      <span>{translateStreamError(state)}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
