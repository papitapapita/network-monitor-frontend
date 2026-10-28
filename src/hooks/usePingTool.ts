'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '@/services/api.service';
import type { SseState } from '@/services/sse';
import type { PingToolParams, PingToolReplyDTO, PingToolStartDTO, PingToolSummaryDTO } from '@/types/ping-tool.types';

export type PingRunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done' }
  | { status: 'stopped' }
  | { status: 'failed'; error: Extract<SseState, { status: 'error' }> };

/**
 * The totals of the pings so far, worked out the way the backend does: ERROR
 * pings are not sent packets. A stopped run gets no `ping-done`, so this is
 * what it shows instead — like a terminal's ping after Ctrl+C.
 */
export function summarize(start: PingToolStartDTO, replies: PingToolReplyDTO[]): PingToolSummaryDTO {
  const latencies = replies.flatMap((r) => (r.outcome === 'REPLY' && r.latencyMs !== null ? [r.latencyMs] : []));
  const errors = replies.filter((r) => r.outcome === 'ERROR').length;
  const sent = replies.length - errors;
  const received = replies.filter((r) => r.outcome === 'REPLY').length;
  return {
    ipAddress: start.ipAddress,
    sent,
    received,
    errors,
    lossPercent: sent === 0 ? null : Math.round(((sent - received) / sent) * 100),
    minMs: latencies.length ? Math.min(...latencies) : null,
    avgMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
    maxMs: latencies.length ? Math.max(...latencies) : null,
    startedAt: start.startedAt,
    finishedAt: replies.at(-1)?.at ?? start.startedAt,
    stoppedEarly: null,
    cancelled: false,
  };
}

export function usePingTool() {
  const [start, setStart] = useState<PingToolStartDTO | null>(null);
  const [replies, setReplies] = useState<PingToolReplyDTO[]>([]);
  const [summary, setSummary] = useState<PingToolSummaryDTO | null>(null);
  const [state, setState] = useState<PingRunState>({ status: 'idle' });
  const closeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Leaving the page stops the pings: closing the stream is the backend's stop signal.
    return () => closeRef.current?.();
  }, []);

  const run = useCallback((params: PingToolParams) => {
    closeRef.current?.();
    setStart(null);
    setReplies([]);
    setSummary(null);
    setState({ status: 'running' });

    closeRef.current = apiService.streamPingTool(params, {
      onStart: setStart,
      onReply: (r) => setReplies((prev) => [...prev, r]),
      onDone: (s) => {
        closeRef.current = null;
        setSummary(s);
        setState({ status: 'done' });
      },
      onState: (s) => {
        if (s.status === 'error') {
          closeRef.current = null;
          setState({ status: 'failed', error: s });
        }
      },
    });
  }, []);

  const stop = useCallback(() => {
    closeRef.current?.();
    closeRef.current = null;
    setState({ status: 'stopped' });
  }, []);

  return { start, replies, summary, state, run, stop };
}
