'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '@/services/api.service';
import type { SseState } from '@/services/sse';
import type { RouterTrafficDTO } from '@/types/router-traffic.types';
import { ROUTER_TRAFFIC_HISTORY, routerTotals } from '@/constants/router-traffic.constants';

/** The network-wide line — ten minutes at one sample per 2 s. */
const TOTAL_HISTORY_POINTS = 300;

/** One reading of one interface, for its chart. */
export interface InterfaceSample {
  /** Client clock when the frame landed — the router's `at` is the server's. */
  t: number;
  rxBps: number;
  txBps: number;
}

export interface LiveRouter {
  router: RouterTrafficDTO;
  receivedAt: number;
  /** Keyed by interface name; the newest `ROUTER_TRAFFIC_HISTORY` readings, oldest first. */
  history: Map<string, InterfaceSample[]>;
}

/** Every router's busiest interface summed, as the customers see it. */
export interface TotalSample {
  t: number;
  downBps: number;
  upBps: number;
}

export interface UseRouterTrafficResult {
  /** In the snapshot's order — the backend sorts the routers by name. */
  routers: LiveRouter[];
  /** False until the opening frame arrives. */
  loaded: boolean;
  intervalSeconds: number;
  /** Since this page opened, oldest first; empty until a router has been read. */
  totalHistory: TotalSample[];
  state: SseState;
  retry: () => void;
}

/**
 * Nothing is stored server-side, so the charts are only as long as this page
 * has been open: each frame appends to its interfaces' history here.
 */
function withReading(prev: LiveRouter | undefined, router: RouterTrafficDTO, receivedAt: number): LiveRouter {
  // A frame without a read (the first viewer's snapshot) adds nothing to chart.
  if (router.at === null) return { router, receivedAt, history: prev?.history ?? new Map() };
  const history = new Map<string, InterfaceSample[]>();
  for (const iface of router.interfaces) {
    const past = prev?.history.get(iface.name) ?? [];
    history.set(
      iface.name,
      [...past, { t: receivedAt, rxBps: iface.rxBps, txBps: iface.txBps }].slice(-ROUTER_TRAFFIC_HISTORY)
    );
  }
  return { router, receivedAt, history };
}

/**
 * Live traffic for every main router. The opening `router-traffic-snapshot`
 * lists them all; each later `router-traffic` frame replaces one.
 */
export function useRouterTraffic(): UseRouterTrafficResult {
  const [routers, setRouters] = useState<LiveRouter[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(2);
  const [state, setState] = useState<SseState>({ status: 'connecting' });
  const [attempt, setAttempt] = useState(0);
  const [totalHistory, setTotalHistory] = useState<TotalSample[]>([]);

  // Frames arrive one router at a time, so the total is sampled on the
  // stream's own cadence rather than per frame — per frame, a network of three
  // routers would draw three points per reading, each counting one router anew.
  const routersRef = useRef(routers);
  useEffect(() => {
    routersRef.current = routers;
  }, [routers]);
  useEffect(() => {
    const timer = setInterval(() => {
      const read = routersRef.current.filter((r) => r.router.at !== null && !r.router.error);
      if (read.length === 0) return;
      let downBps = 0;
      let upBps = 0;
      for (const r of read) {
        const totals = routerTotals(r.router.interfaces);
        downBps += totals?.downBps ?? 0;
        upBps += totals?.upBps ?? 0;
      }
      setTotalHistory((prev) => [...prev, { t: Date.now(), downBps, upBps }].slice(-TOTAL_HISTORY_POINTS));
    }, intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [intervalSeconds]);

  useEffect(() => {
    return apiService.streamRouterTraffic({
      onSnapshot: (snapshot) => {
        const receivedAt = Date.now();
        setIntervalSeconds(snapshot.intervalSeconds);
        // A reconnect re-sends the snapshot; keep the charts drawn so far.
        setRouters((prev) =>
          snapshot.routers.map((r) =>
            withReading(prev.find((p) => p.router.deviceId === r.deviceId), r, receivedAt)
          )
        );
        setLoaded(true);
      },
      onRouter: (router) => {
        const receivedAt = Date.now();
        setRouters((prev) => {
          const i = prev.findIndex((p) => p.router.deviceId === router.deviceId);
          // A router that became a GATEWAY after the snapshot shows up at the end.
          if (i === -1) return [...prev, withReading(undefined, router, receivedAt)];
          const next = [...prev];
          next[i] = withReading(prev[i], router, receivedAt);
          return next;
        });
      },
      onState: setState,
    });
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'connecting' });
    setAttempt((n) => n + 1);
  }, []);

  return { routers, loaded, intervalSeconds, totalHistory, state, retry };
}
