'use client';

import React, { useState } from 'react';
import { Badge, Button, Card, ErrorBanner, LoadingSpinner, PageHeader, Pagination } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { median, useSpeedTest, useSpeedTestHistory, type SpeedTestLive } from '@/hooks/useSpeedTest';
import {
  SPEED_TEST_PAGE_SIZE,
  SPEED_TEST_PHASE_LABELS,
  fmtDateTime,
  fmtMbps,
  fmtMs,
  translateSpeedTestError,
} from '@/constants/speed-test.constants';
import type { SpeedTestPhase, SpeedTestResultDTO } from '@/types/speed-test.types';

/**
 * The ISP's own upstream link, measured from its on-site server against
 * Cloudflare (MON-100 … MON-104). It moves several hundred MB, so it only ever
 * runs from the button — never on load. The route is hidden off site, where
 * the backend refuses it (installation.constants.ts).
 */
export default function SpeedTestPage() {
  const { canWrite } = usePermissions();
  const { live, result, state, start, stop } = useSpeedTest();
  const running = state.status === 'running';
  const showGauges = state.status !== 'idle' && !(state.status === 'failed' && !live.start);

  return (
    <div className="p-8">
      <PageHeader
        title="Test de velocidad"
        info="Mide ahora la conexión a internet del servidor del ISP contra el centro de datos de Cloudflare más cercano: latencia, luego 10 s de descarga y 10 s de subida. Tarda unos 25 s y usa la línea a toda velocidad. No dice nada del enlace de un cliente. Si lo detienes, no se guarda."
      />

      <div className="space-y-6">
        <Card>
          <Card.Body>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {canWrite ? (
                running ? (
                  <Button variant="outline" onClick={stop}>
                    Detener
                  </Button>
                ) : (
                  <Button onClick={start}>{state.status === 'idle' ? 'Iniciar test' : 'Repetir test'}</Button>
                )
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Solo operadores y administradores pueden correr el test de velocidad.
                </p>
              )}
              {running && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {live.phase ? SPEED_TEST_PHASE_LABELS[live.phase] : 'Preparando el test…'}
                </span>
              )}
              {state.status === 'stopped' && (
                <span className="text-sm text-gray-500 dark:text-gray-400">Test detenido. No se guardó.</span>
              )}
            </div>

            {showGauges && <Gauges live={live} result={result} running={running} />}
          </Card.Body>
        </Card>

        {state.status === 'failed' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {translateSpeedTestError(state.error)}
          </div>
        )}

        <History />
      </div>
    </div>
  );
}

/** Seconds into the whole test, counting latency as one second. */
function progressPercent(live: SpeedTestLive): number {
  if (!live.start || !live.phase) return 0;
  const { latencySamples, downloadSeconds, uploadSeconds } = live.start;
  const total = 1 + downloadSeconds + uploadSeconds;
  const elapsed = live.elapsedMs / 1000;
  const done: Record<SpeedTestPhase, number> = {
    LATENCY: Math.min(1, live.latencySamples.length / Math.max(1, latencySamples)),
    DOWNLOAD: 1 + Math.min(elapsed, downloadSeconds),
    UPLOAD: 1 + downloadSeconds + Math.min(elapsed, uploadSeconds),
  };
  return Math.min(100, Math.round((done[live.phase] / total) * 100));
}

function Gauges({
  live,
  result,
  running,
}: {
  live: SpeedTestLive;
  result: SpeedTestResultDTO | null;
  running: boolean;
}) {
  // Once the test ends its kept numbers replace the live ones: the backend
  // leaves out the first 2 s of each phase, so they differ.
  const download = result ? result.downloadMbps : live.downloadMbps;
  const upload = result ? result.uploadMbps : live.uploadMbps;
  const latency = result ? result.latencyMs : median(live.latencySamples);
  const percent = result ? 100 : progressPercent(live);

  return (
    <div className="mt-5">
      {running && (
        <div
          className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
          role="progressbar"
          aria-label="Progreso del test"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Gauge label="Descarga" value={fmtMbps(download)} unit="Mbps" active={running && live.phase === 'DOWNLOAD'} />
        <Gauge label="Subida" value={fmtMbps(upload)} unit="Mbps" active={running && live.phase === 'UPLOAD'} />
        <Gauge
          label="Latencia"
          value={fmtMs(latency)}
          unit="ms"
          active={running && live.phase === 'LATENCY'}
          note={result?.jitterMs != null ? `Jitter ${fmtMs(result.jitterMs)} ms` : undefined}
        />
      </div>
      {result && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {result.serverLocation ? `Contra Cloudflare ${result.serverLocation} · ` : ''}
          {(result.durationMs / 1000).toFixed(0)} s
        </p>
      )}
      {result?.status === 'FAILED' && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          El test falló{result.error ? `: ${result.error}` : '.'} Se muestra lo que alcanzó a medir.
        </p>
      )}
    </div>
  );
}

function Gauge({
  label,
  value,
  unit,
  active,
  note,
}: {
  label: string;
  value: string;
  unit: string;
  active: boolean;
  note?: string;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${active ? 'border-brand-500 dark:border-brand-400' : 'border-gray-200 dark:border-gray-700'}`}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>
      </div>
      {note && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{note}</div>}
    </div>
  );
}

function History() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useSpeedTestHistory(SPEED_TEST_PAGE_SIZE, (page - 1) * SPEED_TEST_PAGE_SIZE);

  if (error) return <ErrorBanner message={error.message} onRetry={() => refetch()} className="" />;

  return (
    <Card>
      <Card.Header>
        <span className="font-semibold text-gray-900 dark:text-gray-100">Historial</span>
      </Card.Header>
      <Card.Body>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        ) : !data || data.results.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Todavía no se ha corrido ningún test.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="pb-2 pr-3 font-medium">Fecha</th>
                    <th className="pb-2 pr-3 font-medium">Descarga</th>
                    <th className="pb-2 pr-3 font-medium">Subida</th>
                    <th className="pb-2 pr-3 font-medium">Latencia</th>
                    <th className="pb-2 pr-3 font-medium">Ubicación</th>
                    <th className="pb-2 font-medium">Corrido por</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r) => (
                    <HistoryRow key={r.id} result={r} />
                  ))}
                </tbody>
              </table>
            </div>
            {data.total > SPEED_TEST_PAGE_SIZE && (
              <div className="mt-4">
                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil(data.total / SPEED_TEST_PAGE_SIZE)}
                  onPageChange={setPage}
                  totalItems={data.total}
                  itemsPerPage={SPEED_TEST_PAGE_SIZE}
                />
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}

function HistoryRow({ result }: { result: SpeedTestResultDTO }) {
  const cell = 'py-2 pr-3 tabular-nums text-gray-700 dark:text-gray-300';
  return (
    <tr className="border-b border-gray-100 align-top last:border-0 dark:border-gray-700">
      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
        {fmtDateTime(result.startedAt)}
        {result.status === 'FAILED' && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="danger">Falló</Badge>
            {result.error && <span className="text-xs text-red-600 dark:text-red-400">{result.error}</span>}
          </div>
        )}
      </td>
      <td className={cell}>{result.downloadMbps === null ? '—' : `${fmtMbps(result.downloadMbps)} Mbps`}</td>
      <td className={cell}>{result.uploadMbps === null ? '—' : `${fmtMbps(result.uploadMbps)} Mbps`}</td>
      <td className={cell}>
        {result.latencyMs === null ? '—' : `${fmtMs(result.latencyMs)} ms`}
        {result.jitterMs !== null && (
          <div className="text-xs text-gray-400 dark:text-gray-500">± {fmtMs(result.jitterMs)} ms</div>
        )}
      </td>
      <td className="py-2 pr-3 font-mono text-gray-700 dark:text-gray-300">{result.serverLocation ?? '—'}</td>
      <td className="py-2 text-gray-700 dark:text-gray-300">{result.startedByEmail}</td>
    </tr>
  );
}
