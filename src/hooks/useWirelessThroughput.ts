'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import type { SseState } from '@/services/sse';
import type { WirelessThroughputDTO } from '@/types/wireless.types';

/**
 * A reading plus the client clock at the moment its frame landed. The stream
 * pushes on the poller's cadence — minutes apart on a slow interval — so the
 * age has to keep counting between frames. It counts from `receivedAt` rather
 * than from `collectedAt` because the browser clock and the server clock drift,
 * and skew there would show a fresh reading as an old one (or as the future).
 */
export interface LiveReading {
  reading: WirelessThroughputDTO;
  receivedAt: number;
}

/** Age of a reading right now, in seconds. */
export function liveAgeSeconds(entry: LiveReading, now: number): number {
  return entry.reading.ageSeconds + Math.max(0, (now - entry.receivedAt) / 1000);
}

/** Re-renders on an interval so a ticking age stays honest without new frames. */
export function useNow(intervalMs = 1_000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, enabled]);
  return now;
}

interface StreamResult {
  state: SseState;
  /**
   * Re-opens the stream after it gave up. Worth offering on every fatal
   * refusal: a 429 clears when the operator closes another tab, and a 404
   * clears the first time the device is polled.
   */
  retry: () => void;
}

export interface UseWirelessThroughputResult extends StreamResult {
  entry: LiveReading | null;
}

/**
 * Live throughput for one device. The stream's first frame carries the current
 * reading, so there is nothing to fetch up front.
 */
export function useWirelessThroughput(deviceId: string, enabled = true): UseWirelessThroughputResult {
  const [entry, setEntry] = useState<LiveReading | null>(null);
  const [state, setState] = useState<SseState>({ status: 'connecting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    return apiService.streamWirelessThroughput(deviceId, {
      onThroughput: (reading) => setEntry({ reading, receivedAt: Date.now() }),
      onState: setState,
    });
  }, [deviceId, enabled, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'connecting' });
    setAttempt((n) => n + 1);
  }, []);
  return { entry, state, retry };
}

export interface UseFleetThroughputResult extends StreamResult {
  /** Keyed by device id — the deltas that follow the snapshot are upserts. */
  entries: Map<string, LiveReading>;
}

/**
 * Live throughput for every polled wireless device. The opening
 * `throughput-snapshot` seeds the map; each later `throughput` frame updates
 * one device. Devices that have never been polled are simply absent — a row of
 * nulls would read as idle rather than unknown.
 */
export function useFleetThroughput(enabled = true): UseFleetThroughputResult {
  const [entries, setEntries] = useState<Map<string, LiveReading>>(() => new Map());
  const [state, setState] = useState<SseState>({ status: 'connecting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    return apiService.streamFleetThroughput({
      onSnapshot: (snapshot) => {
        const receivedAt = Date.now();
        setEntries(new Map(snapshot.devices.map((r) => [r.deviceId, { reading: r, receivedAt }])));
      },
      onThroughput: (reading) => {
        setEntries((prev) => {
          const next = new Map(prev);
          next.set(reading.deviceId, { reading, receivedAt: Date.now() });
          return next;
        });
      },
      onState: setState,
    });
  }, [enabled, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'connecting' });
    setAttempt((n) => n + 1);
  }, []);
  return { entries, state, retry };
}
