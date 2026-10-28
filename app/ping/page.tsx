'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Card, Input, LoadingSpinner, PageHeader, Select } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useInstallation } from '@/hooks/useInstallation';
import { useAgents } from '@/hooks/useAgents';
import { summarize, usePingTool } from '@/hooks/usePingTool';
import {
  PING_DEFAULT_COUNT,
  PING_FROM_SERVER,
  PING_MAX_COUNT,
  fmtPingMs,
  translatePingDetail,
  translatePingError,
} from '@/constants/ping-tool.constants';
import type { PingToolReplyDTO, PingToolStartDTO, PingToolSummaryDTO } from '@/types/ping-tool.types';

/**
 * Pings any IP address now, from the server or from an agent, and prints each
 * answer like a terminal (MON-120 … MON-123). Nothing is stored. A device's
 * page links here with `?ip=` and `?agentId=` filled in.
 */
export default function PingPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <PingTool />
    </Suspense>
  );
}

function PingTool() {
  const searchParams = useSearchParams();
  const { canWrite } = usePermissions();
  const { serverOnSite } = useInstallation();
  const { data: agents, isLoading: agentsLoading, refetch: refetchAgents } = useAgents(canWrite);
  const { start, replies, summary, state, run, stop } = usePingTool();

  const [ip, setIp] = useState(searchParams.get('ip') ?? '');
  const [count, setCount] = useState(String(PING_DEFAULT_COUNT));
  // Null until the user picks: the default depends on the agents and the install.
  const [from, setFrom] = useState<string | null>(searchParams.get('agentId'));
  const [dismissedError, setDismissedError] = useState(false);

  useEffect(() => {
    // The agent picked is gone: the list is stale.
    if (state.status === 'failed' && state.error.httpStatus === 404) refetchAgents();
  }, [state, refetchAgents]);

  const activeAgents = (agents ?? []).filter((a) => a.status === 'ACTIVE');
  // Off site the server is not on the ISP's network, so an agent is required.
  const fromOptions = [
    ...(serverOnSite ? [{ value: PING_FROM_SERVER, label: 'Servidor' }] : []),
    ...activeAgents.map((a) => ({ value: a.id, label: a.offlineSince ? `${a.name} (sin conexión)` : a.name })),
  ];
  const selectedFrom = from ?? (serverOnSite ? PING_FROM_SERVER : (activeAgents[0]?.id ?? ''));

  const running = state.status === 'running';
  const refusal = state.status === 'failed' && !dismissedError ? translatePingError(state.error) : null;
  const countNumber = Number(count);
  const countValid = Number.isInteger(countNumber) && countNumber >= 1 && countNumber <= PING_MAX_COUNT;
  const canStart = ip.trim() !== '' && countValid && selectedFrom !== '';

  const handleStart = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canStart || running) return;
    setDismissedError(false);
    run({
      ip: ip.trim(),
      agentId: selectedFrom === PING_FROM_SERVER ? undefined : selectedFrom,
      count: countNumber,
    });
  };

  // A stopped run gets no summary from the backend, so its totals are worked out here.
  const totals = summary ?? (state.status === 'stopped' && start ? summarize(start, replies) : null);

  return (
    <div className="p-8">
      <PageHeader
        title="Ping"
        info="Hace ping a cualquier dirección IP ahora, una vez por segundo, desde el servidor o desde un agente, y muestra cada respuesta como una terminal. Desde un agente, el resultado es lo que ve la red de ese agente. No cambia nada ni se guarda."
      />

      <div className="space-y-6">
        <Card>
          <Card.Body>
            {!canWrite ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Solo operadores y administradores pueden hacer ping.
              </p>
            ) : (
              <form onSubmit={handleStart} className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-start">
                <Input
                  label="Dirección IP"
                  placeholder="10.0.0.1"
                  value={ip}
                  onChange={(e) => {
                    setIp(e.target.value);
                    setDismissedError(true);
                  }}
                  error={refusal?.field === 'ip' ? refusal.message : undefined}
                  disabled={running}
                  autoComplete="off"
                  spellCheck={false}
                  fullWidth
                />
                <Select
                  label="Desde"
                  options={fromOptions}
                  placeholder={agentsLoading ? 'Cargando…' : 'Sin agentes activos'}
                  value={selectedFrom}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setDismissedError(true);
                  }}
                  error={refusal?.field === 'from' ? refusal.message : undefined}
                  helperText={
                    !serverOnSite && !agentsLoading && activeAgents.length === 0
                      ? 'Este servidor no está en la red del ISP: hace falta un agente para hacer ping.'
                      : undefined
                  }
                  disabled={running}
                  fullWidth
                />
                <Input
                  label="Pings"
                  type="number"
                  min={1}
                  max={PING_MAX_COUNT}
                  value={count}
                  onChange={(e) => {
                    setCount(e.target.value);
                    setDismissedError(true);
                  }}
                  error={
                    refusal?.field === 'count'
                      ? refusal.message
                      : count !== '' && !countValid
                        ? `Entre 1 y ${PING_MAX_COUNT}.`
                        : undefined
                  }
                  disabled={running}
                  fullWidth
                />
                <div className="sm:pt-6">
                  {running ? (
                    <Button type="button" variant="outline" onClick={stop} className="w-full sm:w-auto">
                      Detener
                    </Button>
                  ) : (
                    <Button type="submit" disabled={!canStart} className="w-full sm:w-auto">
                      Iniciar
                    </Button>
                  )}
                </div>
              </form>
            )}
          </Card.Body>
        </Card>

        {refusal && refusal.field === null && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {refusal.message}
          </div>
        )}

        {(start || running) && (
          <Terminal start={start} replies={replies} totals={totals} running={running} stopped={state.status === 'stopped'} />
        )}
      </div>
    </div>
  );
}

function Terminal({
  start,
  replies,
  totals,
  running,
  stopped,
}: {
  start: PingToolStartDTO | null;
  replies: PingToolReplyDTO[];
  totals: PingToolSummaryDTO | null;
  running: boolean;
  stopped: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Keep the newest line in view, as a terminal does — within the box, not the page.
    const box = endRef.current?.parentElement;
    if (box) box.scrollTop = box.scrollHeight;
  }, [replies.length, totals]);

  return (
    <div
      className="max-h-[28rem] overflow-y-auto rounded-lg bg-gray-900 p-4 font-mono text-sm leading-6 text-gray-100 dark:bg-black"
      role="log"
      aria-live="polite"
    >
      {start ? (
        <div className="text-gray-400">
          Ping a {start.ipAddress} desde {start.source === 'AGENT' ? `el agente «${start.agentName ?? start.agentId}»` : 'el servidor'}
          {' '}({start.count} {start.count === 1 ? 'ping' : 'pings'})
        </div>
      ) : (
        <div className="text-gray-400">Conectando…</div>
      )}

      {start && replies.map((r) => <ReplyLine key={r.seq} ip={start.ipAddress} reply={r} />)}

      {running && start && <div className="animate-pulse text-gray-500">…</div>}
      {stopped && <div className="text-gray-400">Detenido.</div>}

      {totals && <Totals totals={totals} />}
      <div ref={endRef} />
    </div>
  );
}

function ReplyLine({ ip, reply }: { ip: string; reply: PingToolReplyDTO }) {
  const seq = <span className="text-gray-500">{String(reply.seq).padStart(3, ' ')} </span>;
  switch (reply.outcome) {
    case 'REPLY':
      return (
        <div className="whitespace-pre-wrap">
          {seq}Respuesta de {ip}: tiempo=<span className="text-green-400">{fmtPingMs(reply.latencyMs)} ms</span>
        </div>
      );
    case 'NO_REPLY':
      return (
        <div className="whitespace-pre-wrap">
          {seq}<span className="text-amber-400">Tiempo de espera agotado</span>
        </div>
      );
    case 'ERROR':
      return (
        <div className="whitespace-pre-wrap">
          {seq}<span className="text-red-400">{translatePingDetail(reply.detail)}</span>
        </div>
      );
  }
}

function Totals({ totals }: { totals: PingToolSummaryDTO }) {
  return (
    <div className="mt-3 border-t border-gray-700 pt-3">
      <div className="text-gray-400">Estadísticas de {totals.ipAddress}:</div>
      <div>
        Enviados {totals.sent} · Recibidos {totals.received} · Perdidos{' '}
        <span className={totals.lossPercent ? 'text-amber-400' : undefined}>
          {totals.lossPercent === null ? '—' : `${totals.lossPercent}%`}
        </span>
        {totals.errors > 0 && <span className="text-red-400"> · Errores {totals.errors}</span>}
      </div>
      {totals.avgMs !== null && (
        <div>
          Mín {fmtPingMs(totals.minMs)} ms · Prom {fmtPingMs(totals.avgMs)} ms · Máx {fmtPingMs(totals.maxMs)} ms
        </div>
      )}
      {totals.stoppedEarly && (
        <div className="mt-1 text-red-400">Se detuvo antes: {translatePingDetail(totals.stoppedEarly)}</div>
      )}
    </div>
  );
}
