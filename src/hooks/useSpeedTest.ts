'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import type { SseState } from '@/services/sse';
import type { SpeedTestPhase, SpeedTestResultDTO, SpeedTestStartDTO } from '@/types/speed-test.types';

export const SPEED_TESTS_QUERY_KEY = ['speed-tests'] as const;

/** What the gauges show while a test runs; replaced by the kept result once it ends. */
export interface SpeedTestLive {
  start: SpeedTestStartDTO | null;
  phase: SpeedTestPhase | null;
  /** Of the current phase. */
  elapsedMs: number;
  latencySamples: number[];
  /** The speed over the last second, and still the last one once its phase is over. */
  downloadMbps: number | null;
  uploadMbps: number | null;
}

export type SpeedTestRunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done' }
  | { status: 'stopped' }
  | { status: 'failed'; error: Extract<SseState, { status: 'error' }> };

const EMPTY_LIVE: SpeedTestLive = {
  start: null,
  phase: null,
  elapsedMs: 0,
  latencySamples: [],
  downloadMbps: null,
  uploadMbps: null,
};

/** The middle sample, the way the backend reports latency. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function useSpeedTest() {
  const queryClient = useQueryClient();
  const [live, setLive] = useState<SpeedTestLive>(EMPTY_LIVE);
  const [result, setResult] = useState<SpeedTestResultDTO | null>(null);
  const [state, setState] = useState<SpeedTestRunState>({ status: 'idle' });
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Leaving the page stops the test: closing the stream is the backend's stop signal.
    return () => closeRef.current?.();
  }, []);

  const start = useCallback(() => {
    closeRef.current?.();
    setLive(EMPTY_LIVE);
    setResult(null);
    setState({ status: 'running' });

    closeRef.current = apiService.streamSpeedTest({
      onStart: (dto) => setLive({ ...EMPTY_LIVE, start: dto }),
      onProgress: (p) =>
        setLive((prev) => ({
          ...prev,
          phase: p.phase,
          elapsedMs: p.elapsedMs,
          latencySamples:
            p.phase === 'LATENCY' && p.latencyMs !== null ? [...prev.latencySamples, p.latencyMs] : prev.latencySamples,
          downloadMbps: p.phase === 'DOWNLOAD' && p.mbps !== null ? p.mbps : prev.downloadMbps,
          uploadMbps: p.phase === 'UPLOAD' && p.mbps !== null ? p.mbps : prev.uploadMbps,
        })),
      onDone: (dto) => {
        closeRef.current = null;
        setResult(dto);
        setState({ status: 'done' });
        queryClient.invalidateQueries({ queryKey: SPEED_TESTS_QUERY_KEY });
      },
      onState: (s) => {
        if (s.status === 'error') {
          closeRef.current = null;
          setState({ status: 'failed', error: s });
        }
      },
    });
  }, [queryClient]);

  const stop = useCallback(() => {
    closeRef.current?.();
    closeRef.current = null;
    setState({ status: 'stopped' });
  }, []);

  return { live, result, state, start, stop };
}

export function useSpeedTestHistory(limit: number, offset: number) {
  return useQuery({
    queryKey: [...SPEED_TESTS_QUERY_KEY, limit, offset],
    queryFn: async () => {
      const r = await apiService.getSpeedTests(limit, offset);
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar el historial');
      return r.data;
    },
    placeholderData: keepPreviousData,
  });
}
