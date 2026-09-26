'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Badge, PageHeader } from '@/components/ui';
import { StreamIndicator, StreamErrorNotice } from '@/components/wireless/StreamStatus';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useNow } from '@/hooks/useWirelessThroughput';
import { DEVICE_STATUS_LABELS } from '@/constants/device.constants';
import { fmtBps } from '@/constants/wireless.constants';
import {
  OPEN_ONLY_VALUE,
  UNASSIGNED_VALUE,
  TICKET_PRIORITY_VARIANTS,
  ticketPriorityLabel,
  todayISODate,
} from '@/constants/ticket.constants';
import type { DeviceStatus } from '@/types/device.types';
import type { TicketPriority } from '@/types/ticket.types';
import { KpiTile, Panel, ProblemList, Figure, StackedStrip } from '@/components/dashboard/panels';
import { Ring, StackedColumns, AreaTrend, BarList, LegendKey } from '@/components/dashboard/charts';
import {
  ALERT_WINDOW_DAYS,
  alertsByDay,
  buildProblems,
  countByStatus,
  fmtDuration,
  latencyRows,
  meanResolveSeconds,
  noisiestDevices,
  summarizeConnectivity,
  summarizeTickets,
} from '@/components/dashboard/dashboardModel';

const SEVERITY_SERIES = [
  { key: 'critical', label: 'Críticas', color: 'var(--viz-critical)' },
  { key: 'warning', label: 'Advertencias', color: 'var(--viz-warning)' },
];

// Ordered so the two grays never touch and so ACTIVE leads.
const LIFECYCLE: { status: DeviceStatus; color: string }[] = [
  { status: 'ACTIVE', color: 'var(--viz-series)' },
  { status: 'COMMISSIONING', color: 'var(--viz-series-2)' },
  { status: 'INVENTORY', color: 'var(--viz-idle)' },
  { status: 'DAMAGED', color: 'var(--viz-critical)' },
  { status: 'DECOMMISSIONED', color: 'var(--viz-unknown)' },
];

const PRIORITY_ORDER: TicketPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

/** A latency above this is worth a look on a WISP backhaul; it paints the bar as a warning. */
const SLOW_PING_MS = 100;

const utilisationColor = (pct: number) =>
  pct >= 90 ? 'var(--viz-critical)' : pct >= 70 ? 'var(--viz-warning)' : 'var(--viz-good)';

const weekday = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export default function DashboardPage() {
  const data = useDashboardData();
  const { devices, statuses, alerts, tickets, locationNames, fleet } = data;
  // Durations tick once a minute — "caído hace 3 h" does not need seconds.
  const now = useNow(60_000);

  const devicesLoading = data.devicesQuery.isPending;
  const statusLoading = devicesLoading || data.statusQuery.isPending;
  const alertsLoading = data.alertsQuery.isPending;

  const connectivity = useMemo(
    () => summarizeConnectivity(devices, statuses, data.statusQuery.data?.failed ?? 0),
    [devices, statuses, data.statusQuery.data]
  );
  const problems = useMemo(
    () => buildProblems(devices, statuses, alerts, locationNames),
    [devices, statuses, alerts, locationNames]
  );
  const days = useMemo(() => alertsByDay(alerts), [alerts]);
  const noisy = useMemo(() => noisiestDevices(alerts, devices), [alerts, devices]);
  const mttr = useMemo(() => meanResolveSeconds(alerts), [alerts]);
  const latency = useMemo(() => latencyRows(devices, statuses), [devices, statuses]);
  const ticketSummary = useMemo(() => summarizeTickets(tickets), [tickets]);
  const lifecycle = useMemo(() => countByStatus(devices), [devices]);

  const openAlerts = alerts.filter((a) => a.status === 'OPEN');
  const criticalOpen = openAlerts.filter((a) => a.severity === 'CRITICAL').length;
  const measured = connectivity.online + connectivity.offline;
  const availability = measured > 0 ? Math.round((connectivity.online / measured) * 100) : null;
  const longestDown = problems
    .filter((p) => p.kind === 'down' && p.since)
    .reduce<number | null>((max, p) => {
      const secs = (now - new Date(p.since!).getTime()) / 1000;
      return max === null || secs > max ? secs : max;
    }, null);
  const alertsInWindow = days.reduce((s, d) => s + d.critical + d.warning, 0);
  // Newest-first and capped at 300: if the oldest one fetched is still inside
  // the window, older days may be undercounted.
  const alertsTruncated =
    !!data.alertsQuery.data?.hasMore && alerts.length > 0 && new Date(alerts[alerts.length - 1].startedAt) > new Date(days[0].day);

  const deviceNames = useMemo(() => new Map(devices.map((d) => [d.id, d.name])), [devices]);
  const fleetReadings = [...fleet.entries.values()].map((e) => e.reading);
  const liveReadings = fleetReadings.filter((r) => !r.stale);
  const currentTraffic = data.throughputHistory.at(-1)?.bps ?? null;
  const busiestLinks = fleetReadings
    .filter((r) => r.utilisationPercent !== null && !r.stale)
    .sort((a, b) => (b.utilisationPercent ?? 0) - (a.utilisationPercent ?? 0))
    .slice(0, 5);

  const today = todayISODate();

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Panel"
        subtitle="Estado de la red en este momento"
        info="Se actualiza solo cada minuto. El tráfico llega en vivo desde los radios."
        onRefresh={data.refresh}
        isRefreshing={data.isRefreshing}
        lastRefreshed={data.lastRefreshed}
      />

      {/* Headline numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          label="Disponibilidad"
          href="/devices?connectivity=ONLINE"
          loading={statusLoading}
          tone={availability === null ? 'neutral' : availability === 100 ? 'good' : availability >= 90 ? 'warning' : 'critical'}
          value={availability === null ? '—' : `${availability}%`}
          sub={measured > 0 ? `${connectivity.online} de ${measured} con lectura` : 'Sin dispositivos medidos'}
        />
        <KpiTile
          label="Caídos"
          href="/devices?connectivity=OFFLINE"
          loading={statusLoading}
          tone={connectivity.offline > 0 ? 'critical' : 'good'}
          value={connectivity.offline}
          sub={
            connectivity.offline === 0
              ? 'Ninguno sin respuesta'
              : longestDown !== null
                ? `El más largo: ${fmtDuration(longestDown)}`
                : 'Sin respuesta al sondeo'
          }
        />
        <KpiTile
          label="Alertas abiertas"
          href="/alerts?status=OPEN"
          loading={alertsLoading}
          tone={criticalOpen > 0 ? 'critical' : openAlerts.length > 0 ? 'warning' : 'good'}
          value={openAlerts.length}
          sub={`${criticalOpen} crítica${criticalOpen === 1 ? '' : 's'} · ${openAlerts.length - criticalOpen} advertencia${openAlerts.length - criticalOpen === 1 ? '' : 's'}`}
        />
        <KpiTile
          label="Tickets abiertos"
          href={`/tickets?status=${OPEN_ONLY_VALUE}`}
          loading={data.ticketsQuery.isPending}
          tone={ticketSummary.byPriority.URGENT > 0 ? 'critical' : ticketSummary.unassigned > 0 ? 'warning' : 'neutral'}
          value={ticketSummary.open}
          sub={`${ticketSummary.unassigned} sin asignar · ${ticketSummary.byPriority.URGENT} urgente${ticketSummary.byPriority.URGENT === 1 ? '' : 's'}`}
        />
        <KpiTile
          label="Tráfico ahora"
          href="/wireless"
          tone="neutral"
          loading={fleet.state.status === 'connecting' && currentTraffic === null}
          value={currentTraffic === null ? '—' : fmtBps(currentTraffic)}
          sub={`${liveReadings.length} radio${liveReadings.length === 1 ? '' : 's'} reportando`}
          adornment={<StreamIndicator state={fleet.state} />}
        />
      </div>

      {connectivity.unread > 0 && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          No se pudo leer el estado de {connectivity.unread} dispositivo{connectivity.unread === 1 ? '' : 's'} (límite de
          solicitudes); las cifras de conectividad están incompletas hasta la próxima actualización.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* What needs attention */}
        <Panel
          title="Qué requiere atención"
          info="Dispositivos sin respuesta y alertas abiertas, críticos primero y, dentro de cada gravedad, los más antiguos arriba."
          action={{ href: '/alerts?status=OPEN', label: 'Alertas' }}
          aside={
            problems.length > 0 ? (
              <Badge variant={problems.some((p) => p.severity === 'CRITICAL') ? 'danger' : 'warning'}>
                {problems.length}
              </Badge>
            ) : undefined
          }
          loading={statusLoading || alertsLoading}
          error={data.alertsQuery.error?.message ?? data.devicesQuery.error?.message}
          className="lg:col-span-2"
        >
          <ProblemList problems={problems} now={now} />
        </Panel>

        {/* Connectivity */}
        <Panel
          title="Conectividad"
          info="Último resultado del sondeo ICMP de cada dispositivo monitoreado. «Sin lectura» significa que aún no se ha sondeado."
          loading={statusLoading}
          error={data.devicesQuery.error?.message}
        >
          <Ring
            centerValue={`${connectivity.online}/${connectivity.monitored}`}
            centerLabel="monitoreados en línea"
            segments={[
              { key: 'online', label: 'En línea', value: connectivity.online, color: 'var(--viz-good)', href: '/devices?connectivity=ONLINE' },
              { key: 'unknown', label: 'Sin lectura', value: connectivity.unknown, color: 'var(--viz-unknown)', href: '/devices?connectivity=UNKNOWN' },
              { key: 'offline', label: 'Caído', value: connectivity.offline, color: 'var(--viz-critical)', href: '/devices?connectivity=OFFLINE' },
            ]}
          />
          {connectivity.unmonitored > 0 && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              {connectivity.unmonitored} dispositivo{connectivity.unmonitored === 1 ? '' : 's'} sin monitoreo, fuera de estas cifras.
            </p>
          )}
        </Panel>

        {/* Alert history */}
        <Panel
          title={`Alertas, últimos ${ALERT_WINDOW_DAYS} días`}
          info="Alertas por día en que empezaron, abiertas o ya resueltas."
          action={{ href: '/alerts', label: 'Historial' }}
          loading={alertsLoading}
          error={data.alertsQuery.error?.message}
          className="lg:col-span-2"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-8">
              <Figure label="Total" value={alertsInWindow} />
              <Figure label="Tiempo medio de resolución" value={mttr === null ? '—' : fmtDuration(mttr)} />
            </div>
            <div className="flex gap-4">
              {SEVERITY_SERIES.map((s) => (
                <LegendKey key={s.key} color={s.color} label={s.label} />
              ))}
            </div>
          </div>
          <StackedColumns
            series={SEVERITY_SERIES}
            data={days.map((d) => {
              const date = weekday(d.day);
              return {
                key: d.day,
                tick: date.toLocaleDateString('es', { day: 'numeric', month: 'short' }),
                title: date.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }),
                values: { critical: d.critical, warning: d.warning },
              };
            })}
          />
          {alertsTruncated && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Solo se leen las 300 alertas más recientes; los primeros días pueden estar incompletos.
            </p>
          )}
        </Panel>

        {/* Noisiest devices */}
        <Panel
          title="Dispositivos con más alertas"
          info={`Alertas iniciadas en los últimos ${ALERT_WINDOW_DAYS} días. Un dispositivo que aparece aquí a menudo tiene un problema de fondo.`}
          loading={alertsLoading || devicesLoading}
          error={data.alertsQuery.error?.message}
        >
          {noisy.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Sin alertas en el periodo</p>
          ) : (
            <BarList
              rows={noisy.map((n) => ({
                key: n.deviceId,
                label: n.name,
                href: `/alerts?deviceId=${n.deviceId}`,
                value: n.value,
                display: String(n.value),
              }))}
            />
          )}
        </Panel>

        {/* Live traffic */}
        <Panel
          title="Tráfico inalámbrico"
          info="Suma del tráfico de los AP (o de las estaciones, si no hay AP sondeados). El historial es solo el de esta sesión: empieza cuando se abre el panel."
          aside={<StreamIndicator state={fleet.state} />}
          action={{ href: '/wireless', label: 'Inalámbrico' }}
          className="lg:col-span-2"
        >
          <StreamErrorNotice state={fleet.state} onRetry={fleet.retry} />
          {fleet.state.status !== 'error' &&
            (data.throughputHistory.length < 2 ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                {fleetReadings.length === 0 && fleet.state.status === 'live'
                  ? 'Ningún radio sondeado todavía.'
                  : 'Reuniendo lecturas…'}
              </p>
            ) : (
              <AreaTrend
                label="Tráfico total"
                points={data.throughputHistory.map((p) => ({ t: p.t, v: p.bps }))}
                format={(v) => fmtBps(v)}
              />
            ))}
          {busiestLinks.length > 0 && (
            <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Enlaces más cargados (uso del plan)
              </p>
              <BarList
                max={100}
                rows={busiestLinks.map((r) => ({
                  key: r.deviceId,
                  label: deviceNames.get(r.deviceId) ?? r.deviceId,
                  href: `/devices/${r.deviceId}`,
                  value: r.utilisationPercent,
                  display: `${Math.round(r.utilisationPercent ?? 0)}%`,
                  color: utilisationColor(r.utilisationPercent ?? 0),
                }))}
              />
            </div>
          )}
        </Panel>

        {/* Latency */}
        <Panel
          title="Latencia"
          info={`Último ping de cada dispositivo monitoreado, los más lentos arriba. Sobre ${SLOW_PING_MS} ms se marca en ámbar; «sin respuesta» es un ping fallido.`}
          loading={statusLoading}
        >
          {latency.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Sin sondeos todavía</p>
          ) : (
            <BarList
              rows={latency.map((r) => ({
                key: r.deviceId,
                label: r.name,
                href: `/devices/${r.deviceId}`,
                value: r.latencyMs,
                display: r.latencyMs === null ? 'sin respuesta' : `${Math.round(r.latencyMs)} ms`,
                color: r.latencyMs !== null && r.latencyMs > SLOW_PING_MS ? 'var(--viz-warning)' : undefined,
              }))}
            />
          )}
        </Panel>

        {/* Today's work */}
        <Panel
          title="Visitas de hoy"
          action={{ href: `/tickets?scheduledFrom=${today}&scheduledTo=${today}`, label: 'Tickets' }}
          loading={data.ticketsQuery.isPending}
          error={data.ticketsQuery.error?.message}
          className="lg:col-span-2"
        >
          <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
            {PRIORITY_ORDER.map((p) => (
              <Link key={p} href={`/tickets?status=${OPEN_ONLY_VALUE}&priority=${p}`} className="group">
                <Figure label={ticketPriorityLabel(p)} value={<span className="group-hover:text-blue-600 dark:group-hover:text-blue-400">{ticketSummary.byPriority[p]}</span>} />
              </Link>
            ))}
            <Link href={`/tickets?status=${OPEN_ONLY_VALUE}&technicianId=${UNASSIGNED_VALUE}`} className="group">
              <Figure label="Sin asignar" value={<span className="group-hover:text-blue-600 dark:group-hover:text-blue-400">{ticketSummary.unassigned}</span>} />
            </Link>
            {ticketSummary.overdue > 0 && <Figure label="Atrasados" value={ticketSummary.overdue} />}
          </div>
          {ticketSummary.today.length === 0 ? (
            <p className="rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
              No hay visitas programadas para hoy
            </p>
          ) : (
            <ul className="-mx-2 divide-y divide-gray-100 dark:divide-gray-700/70">
              {ticketSummary.today.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tickets/${t.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <span className="w-24 shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                      {t.startTime ? `${t.startTime}–${t.endTime}` : 'Todo el día'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                      <span className="text-gray-400 dark:text-gray-500">#{t.code}</span> {t.title}
                    </span>
                    {!t.technicianId && <Badge variant="warning">Sin asignar</Badge>}
                    <Badge variant={TICKET_PRIORITY_VARIANTS[t.priority]}>{ticketPriorityLabel(t.priority)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Inventory */}
        <Panel
          title="Inventario"
          action={{ href: '/devices', label: 'Dispositivos' }}
          loading={devicesLoading}
          error={data.devicesQuery.error?.message}
        >
          <p className="mb-3 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {devices.length}
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">dispositivos</span>
          </p>
          <StackedStrip parts={LIFECYCLE.map((l) => ({ key: l.status, value: lifecycle[l.status] ?? 0, color: l.color }))} />
          <ul className="mt-4 space-y-1">
            {LIFECYCLE.map((l) => (
              <li key={l.status}>
                <Link
                  href={`/devices?status=${l.status}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                  <span className="flex-1 text-gray-600 dark:text-gray-300">{DEVICE_STATUS_LABELS[l.status]}</span>
                  <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{lifecycle[l.status] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
