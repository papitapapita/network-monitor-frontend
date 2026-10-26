'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, Input, PageHeader, SearchIcon, Select } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useNetworkSweep, type NetworkSweepRun } from '@/hooks/useNetworkSweep';
import { useNow } from '@/hooks/useWirelessThroughput';
import { fetchAllLocations } from '@/hooks/useCatalogs';
import { fmtAge } from '@/constants/wireless.constants';
import { DEVICE_CATEGORY_FILTER_OPTIONS, deviceCategoryLabel } from '@/constants/device.constants';
import {
  SWEEP_OUTCOME_BADGES,
  SWEEP_OUTCOME_LABELS,
  SWEEP_OUTCOME_ORDER,
  devicesNotChecked,
  fmtClock,
  fmtLatency,
  groupAgentFailures,
  skipReasonLabel,
  translateSweepDetail,
  translateSweepError,
  type AgentFailureGroup,
} from '@/constants/network-sweep.constants';
import type { DeviceCategory } from '@/types/device.types';
import type { LocationResponseDTO } from '@/types/location.types';
import type { NetworkSweepResultDTO } from '@/types/network-sweep.types';

/**
 * "What is up after the outage?" (MON-080 … MON-084). Pings every in-service
 * device once and lists what answered as it comes in. A snapshot only: the
 * backend changes no status, history or alert because of it, so this page
 * never mixes its results into the live polling status.
 */
export default function NetworkSweepPage() {
  const { canWrite } = usePermissions();
  const { run, phase, fromCache, start, stop } = useNetworkSweep();
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [locationId, setLocationId] = useState('');
  const [category, setCategory] = useState('');
  const running = phase.status === 'running';

  useEffect(() => {
    // Only the filter needs them; a failure leaves "Todas las ubicaciones".
    fetchAllLocations().then(setLocations, () => {});
  }, []);

  const locationOptions = useMemo(
    () => [
      { value: '', label: 'Todas las ubicaciones' },
      ...[...locations].sort((a, b) => a.name.localeCompare(b.name)).map((l) => ({ value: l.id, label: l.name })),
    ],
    [locations]
  );

  const onStart = () =>
    start({
      locationId: locationId || undefined,
      category: (category || undefined) as DeviceCategory | undefined,
    });

  return (
    <div className="p-8">
      <PageHeader
        title="Discovery"
        info="Hace ping una vez, ahora, a cada equipo activo o en instalación: hasta 3 intentos de 1 s. Los equipos detrás de un agente los revisa su agente. Es solo una foto: no cambia el estado de los equipos, su historial ni sus alertas. El último barrido se guarda solo en este navegador."
      />

      <div className="space-y-6">
        <Card>
          <Card.Body>
            {canWrite ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-64">
                  <Select
                    label="Ubicación"
                    options={locationOptions}
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    disabled={running}
                    fullWidth
                  />
                </div>
                <div className="w-full sm:w-64">
                  <Select
                    label="Categoría"
                    options={DEVICE_CATEGORY_FILTER_OPTIONS}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={running}
                    fullWidth
                  />
                </div>
                {running ? (
                  <Button variant="outline" onClick={stop}>
                    Detener
                  </Button>
                ) : (
                  <Button onClick={onStart}>Barrer red</Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Solo operadores y administradores pueden barrer la red.
              </p>
            )}
          </Card.Body>
        </Card>

        {phase.status === 'failed' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {translateSweepError(phase.error)}
          </div>
        )}

        {run && <SweepResults run={run} running={running} stopped={phase.status === 'stopped'} fromCache={fromCache} />}
      </div>
    </div>
  );
}

function SweepResults({
  run,
  running,
  stopped,
  fromCache,
}: {
  run: NetworkSweepRun;
  running: boolean;
  stopped: boolean;
  fromCache: boolean;
}) {
  const now = useNow(10_000, run.summary !== null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const { counts, groups, rows, skipped } = useMemo(() => {
    const counts = { UP: 0, DOWN: 0, ERROR: 0, SKIPPED: 0 };
    for (const r of run.results) counts[r.outcome] += 1;
    // The tiles count the whole sweep; the search narrows only the lists below.
    const matching = query
      ? run.results.filter((r) =>
          [r.deviceName, r.ipAddress, r.locationName, r.agentName].some((v) => v?.toLowerCase().includes(query))
        )
      : run.results;
    const { groups, rest } = groupAgentFailures(matching);
    const rows = rest
      .filter((r) => r.outcome !== 'SKIPPED')
      .sort(
        (a, b) =>
          SWEEP_OUTCOME_ORDER[a.outcome] - SWEEP_OUTCOME_ORDER[b.outcome] || a.deviceName.localeCompare(b.deviceName)
      );
    const skipped = rest.filter((r) => r.outcome === 'SKIPPED');
    return { counts, groups, rows, skipped };
  }, [run.results, query]);

  if (!run.start) {
    return running ? (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Preparando el barrido…</p>
    ) : null;
  }

  const pinged = counts.UP + counts.DOWN + counts.ERROR;
  const toPing = run.start.toPing;
  const percent = toPing === 0 ? 100 : Math.min(100, Math.round((pinged / toPing) * 100));
  const finishedAt = run.summary?.finishedAt;

  return (
    <>
      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              Discovery {fmtClock(run.start.startedAt)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {running
                ? `${pinged} de ${toPing} equipos revisados`
                : stopped
                  ? `Detenido: ${pinged} de ${toPing} equipos revisados`
                  : finishedAt
                    ? `Terminó ${fmtAge(Math.max(0, (now - Date.parse(finishedAt)) / 1000))} · ${(run.summary!.durationMs / 1000).toFixed(1)} s`
                    : null}
            </span>
          </div>
        </Card.Header>
        <Card.Body>
          {(running || stopped) && (
            <div
              className="mb-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
              role="progressbar"
              aria-label="Progreso del barrido"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Sin respuesta" value={counts.DOWN} tone="text-red-600 dark:text-red-400" />
            <Tile label="Desconocido" value={counts.ERROR} tone="text-amber-600 dark:text-amber-400" />
            <Tile label="Responden" value={counts.UP} tone="text-green-600 dark:text-green-400" />
            <Tile label="Omitidos" value={counts.SKIPPED} tone="text-gray-600 dark:text-gray-300" />
          </div>
          {fromCache && (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Último barrido guardado en este navegador. El estado de los equipos puede haber cambiado desde entonces.
            </p>
          )}
        </Card.Body>
      </Card>

      {run.results.length > 0 && (
        <div className="w-full sm:w-80">
          <Input
            icon={<SearchIcon />}
            aria-label="Buscar"
            placeholder="Buscar por nombre, IP, ubicación o agente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
          />
        </div>
      )}

      {query && groups.length === 0 && rows.length === 0 && skipped.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Ningún equipo coincide con «{search.trim()}».
        </p>
      )}

      {groups.map((g) => (
        <AgentFailureLine key={g.key} group={g} />
      ))}

      {rows.length > 0 && (
        <Card>
          <Card.Body>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <th className="pb-2 pr-3 font-medium">Estado</th>
                    <th className="pb-2 pr-3 font-medium">Equipo</th>
                    <th className="pb-2 pr-3 font-medium">IP</th>
                    <th className="pb-2 pr-3 font-medium">Categoría</th>
                    <th className="pb-2 pr-3 font-medium">Ubicación</th>
                    <th className="pb-2 font-medium">Latencia</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <ResultRow key={r.deviceId} result={r} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card.Body>
        </Card>
      )}

      {skipped.length > 0 && (
        <Card>
          <Card.Body>
            <button
              type="button"
              onClick={() => setShowSkipped((v) => !v)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              {showSkipped ? 'Ocultar' : 'Ver'} {skipped.length === 1 ? 'el equipo omitido' : `los ${skipped.length} equipos omitidos`}
            </button>
            {showSkipped && (
              <ul className="mt-3 divide-y divide-gray-100 text-sm dark:divide-gray-700">
                {skipped.map((r) => (
                  <li key={r.deviceId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <DeviceLink result={r} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{skipReasonLabel(r.reason)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card.Body>
        </Card>
      )}
    </>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function DeviceLink({ result }: { result: NetworkSweepResultDTO }) {
  return (
    <Link
      href={`/devices/${result.deviceId}`}
      className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
    >
      {result.deviceName}
    </Link>
  );
}

function ResultRow({ result }: { result: NetworkSweepResultDTO }) {
  return (
    <tr className="border-b border-gray-100 last:border-0 dark:border-gray-700">
      <td className="py-2 pr-3">
        <Badge variant={SWEEP_OUTCOME_BADGES[result.outcome]}>{SWEEP_OUTCOME_LABELS[result.outcome]}</Badge>
      </td>
      <td className="py-2 pr-3">
        <DeviceLink result={result} />
        {result.agentName && (
          <div className="text-xs text-gray-400 dark:text-gray-500">Vía agente {result.agentName}</div>
        )}
        {result.outcome === 'ERROR' && (
          <div className="text-xs text-amber-700 dark:text-amber-400">{translateSweepDetail(result)}</div>
        )}
      </td>
      <td className="py-2 pr-3 font-mono text-gray-700 dark:text-gray-300">{result.ipAddress ?? '—'}</td>
      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{deviceCategoryLabel(result.category)}</td>
      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{result.locationName ?? '—'}</td>
      <td className="py-2 tabular-nums text-gray-700 dark:text-gray-300">
        {result.outcome === 'UP' ? fmtLatency(result.latencyMs) : '—'}
      </td>
    </tr>
  );
}

/** After an outage a dead agent is the news, so its devices fold into one line. */
function AgentFailureLine({ group }: { group: AgentFailureGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{group.message}</span> — {devicesNotChecked(group.devices.length)}
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="font-medium underline">
          {open ? 'Ocultar equipos' : 'Ver equipos'}
        </button>
      </div>
      {open && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {group.devices.map((r) => (
            <li key={r.deviceId}>
              <Link href={`/devices/${r.deviceId}`} className="underline">
                {r.deviceName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
