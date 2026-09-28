'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import type { SseState } from '@/services/sse';
import type {
  LinkDiagnosisDTO,
  LinkDiagnosisReportDTO,
  PingSampleDTO,
  RadioSampleDTO,
} from '@/types/wireless.types';

export interface UseLinkDiagnosisResult {
  /** The running session, or the last one if it ended under 15 minutes ago. */
  diagnosis: LinkDiagnosisDTO | null;
  report: LinkDiagnosisReportDTO | null;
  ping: PingSampleDTO[];
  radio: RadioSampleDTO[];
  /** The stream's state while a session runs; null when nothing is being watched. */
  streamState: SseState | null;
  isLoading: boolean;
  isStarting: boolean;
  isStopping: boolean;
  /** A refused start or stop, in the operator's words. */
  error: string | null;
  start: (durationSeconds: number) => Promise<void>;
  stop: () => Promise<void>;
  /** Re-opens the stream after it gave up. */
  retryStream: () => void;
}

function translateStartError(status: number | undefined, error: string | undefined): string {
  // request() swaps a 429 for the generic rate-limit wording, but here it means
  // the server is already running its maximum number of sessions.
  if (status === 429) {
    return 'El servidor ya está ejecutando el máximo de diagnósticos simultáneos. Espera a que termine alguno e inténtalo de nuevo.';
  }
  return error || 'No se pudo iniciar el diagnóstico';
}

/**
 * One device's live link diagnosis. Starting and watching are separate on the
 * backend: POST starts (or joins) a session, and the stream only watches it, so
 * a remount or a second viewer adds no load on the radio. The stream's opening
 * frame carries every sample so far, so a late viewer draws the whole chart.
 */
export function useLinkDiagnosis(deviceId: string): UseLinkDiagnosisResult {
  const [diagnosis, setDiagnosis] = useState<LinkDiagnosisDTO | null>(null);
  const [report, setReport] = useState<LinkDiagnosisReportDTO | null>(null);
  const [ping, setPing] = useState<PingSampleDTO[]>([]);
  const [radio, setRadio] = useState<RadioSampleDTO[]>([]);
  const [streamState, setStreamState] = useState<SseState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped to (re)open the stream; 0 means nothing to watch yet.
  const [watch, setWatch] = useState(0);

  const hydrate = useCallback((dto: LinkDiagnosisDTO) => {
    setDiagnosis(dto);
    setReport(dto.report);
    if (dto.samples) {
      setPing(dto.samples.ping);
      setRadio(dto.samples.radio);
    }
  }, []);

  const openStream = useCallback(() => {
    setStreamState({ status: 'connecting' });
    setWatch((n) => n + 1);
  }, []);

  // A session may already be running (another technician started it, or this
  // page was reloaded), or have ended within the last 15 minutes.
  useEffect(() => {
    let cancelled = false;
    apiService.getLinkDiagnosis(deviceId).then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if (!result.success || !result.data) return; // 404: nothing to show
      hydrate(result.data);
      if (result.data.status === 'RUNNING') openStream();
    });
    return () => {
      cancelled = true;
    };
  }, [deviceId, hydrate, openStream]);

  useEffect(() => {
    if (watch === 0) return;
    return apiService.streamLinkDiagnosis(deviceId, {
      onDiagnosis: hydrate,
      onPing: (sample) => setPing((prev) => [...prev, sample]),
      onRadio: (sample) => setRadio((prev) => [...prev, sample]),
      onReport: setReport,
      onEnd: (dto) => {
        // The `end` frame has no samples; keep the ones already drawn.
        setDiagnosis(dto);
        setReport(dto.report);
        setStreamState(null);
      },
      onState: setStreamState,
    });
  }, [deviceId, watch, hydrate]);

  const start = useCallback(
    async (durationSeconds: number) => {
      setIsStarting(true);
      setError(null);
      const result = await apiService.startLinkDiagnosis(deviceId, durationSeconds);
      setIsStarting(false);
      if (!result.success || !result.data) {
        setError(translateStartError(result.status, result.error));
        return;
      }
      // A fresh session starts empty; a joined one is refilled by the stream's
      // opening frame.
      setPing([]);
      setRadio([]);
      hydrate(result.data.diagnosis);
      openStream();
    },
    [deviceId, hydrate, openStream]
  );

  const stop = useCallback(async () => {
    setIsStopping(true);
    setError(null);
    const result = await apiService.stopLinkDiagnosis(deviceId);
    setIsStopping(false);
    if (!result.success || !result.data) {
      // 404: it ended on its own in the meantime; the stream's `end` covers it.
      if (result.status !== 404) setError(result.error || 'No se pudo detener el diagnóstico');
      return;
    }
    setDiagnosis(result.data);
    setReport(result.data.report);
  }, [deviceId]);

  const retryStream = openStream;

  return {
    diagnosis,
    report,
    ping,
    radio,
    streamState,
    isLoading,
    isStarting,
    isStopping,
    error,
    start,
    stop,
    retryStream,
  };
}
