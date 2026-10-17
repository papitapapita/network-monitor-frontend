'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { apiService } from '@/services/api.service';
import type { SseState } from '@/services/sse';
import type {
  NetworkSweepFilters,
  NetworkSweepResultDTO,
  NetworkSweepStartDTO,
  NetworkSweepSummaryDTO,
} from '@/types/network-sweep.types';

/**
 * Nothing is kept server side, so the last finished sweep lives here: an
 * operator who reloads the page after an outage still sees what answered.
 */
const STORAGE_KEY = 'nms_last_network_sweep';

export interface NetworkSweepRun {
  filters: NetworkSweepFilters;
  start: NetworkSweepStartDTO | null;
  /** In arrival order. */
  results: NetworkSweepResultDTO[];
  /** Set once `sweep-done` arrived; a stopped or failed sweep never gets one. */
  summary: NetworkSweepSummaryDTO | null;
}

export type NetworkSweepPhase =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done' }
  | { status: 'stopped' }
  | { status: 'failed'; error: Extract<SseState, { status: 'error' }> };

export interface UseNetworkSweepResult {
  run: NetworkSweepRun | null;
  phase: NetworkSweepPhase;
  /** True when `run` was read back from the browser rather than swept on this visit. */
  fromCache: boolean;
  start: (filters: NetworkSweepFilters) => void;
  stop: () => void;
}

function readCachedRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Only this tab writes it, and only once its own sweep is already on screen. */
const noSubscription = () => () => {};

function parseCached(raw: string | null): NetworkSweepRun | null {
  if (!raw) return null;
  try {
    const run = JSON.parse(raw) as NetworkSweepRun;
    return run.summary && Array.isArray(run.results) ? run : null;
  } catch {
    return null;
  }
}

function writeCached(run: NetworkSweepRun): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  } catch {
    // A full or blocked storage only costs the reload; the sweep still shows.
  }
}

export function useNetworkSweep(): UseNetworkSweepResult {
  // Null until a sweep starts on this visit; until then the cached one shows.
  const [run, setRun] = useState<NetworkSweepRun | null>(null);
  const [phase, setPhase] = useState<NetworkSweepPhase>({ status: 'idle' });
  const closeRef = useRef<(() => void) | null>(null);
  const cachedRaw = useSyncExternalStore(noSubscription, readCachedRaw, () => null);
  const cached = useMemo(() => parseCached(cachedRaw), [cachedRaw]);

  useEffect(() => {
    // Leaving the page stops the sweep: closing the stream is the backend's stop signal.
    return () => closeRef.current?.();
  }, []);

  const start = useCallback((filters: NetworkSweepFilters) => {
    closeRef.current?.();
    // This sweep's own record: a stale handler from a stopped one can't touch the next.
    const current: NetworkSweepRun = { filters, start: null, results: [], summary: null };
    setRun({ ...current });
    setPhase({ status: 'running' });

    closeRef.current = apiService.streamNetworkSweep(filters, {
      onStart: (dto) => {
        current.start = dto;
        setRun({ ...current });
      },
      onResult: (dto) => {
        current.results.push(dto);
        setRun({ ...current, results: [...current.results] });
      },
      onDone: (summary) => {
        current.summary = summary;
        closeRef.current = null;
        const finished = { ...current, results: [...current.results] };
        setRun(finished);
        setPhase({ status: 'done' });
        writeCached(finished);
      },
      onState: (state) => {
        if (state.status === 'error') {
          closeRef.current = null;
          setPhase({ status: 'failed', error: state });
        }
      },
    });
  }, []);

  const stop = useCallback(() => {
    closeRef.current?.();
    closeRef.current = null;
    setPhase({ status: 'stopped' });
  }, []);

  if (!run && cached) return { run: cached, phase: { status: 'done' }, fromCache: true, start, stop };
  return { run, phase, fromCache: false, start, stop };
}
