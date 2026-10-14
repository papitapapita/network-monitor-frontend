'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { usePermissions } from '@/hooks/usePermissions';
import { AlertDTO } from '@/types/alert.types';
import { DeviceResponseDTO } from '@/types/device.types';
import { TicketDTO } from '@/types/ticket.types';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_RANK,
  TICKET_PRIORITY_VARIANTS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_RANK,
  TICKET_STATUS_VARIANTS,
  formatSchedule,
  isAlertOrigin,
  isTerminal,
  ticketOriginLabel,
} from '@/constants/ticket.constants';
import { Badge, Button, Card, LoadingSpinner, SectionTitle } from '@/components/ui';

interface Props {
  device: DeviceResponseDTO;
}

/** How many closed rows sit under the open ones before "Ver todos" takes over. */
const RECENT_CLOSED = 5;

const ALERT_FETCH_LIMIT = 50;
const TICKET_FETCH_LIMIT = 100;

const ROW_CLASSES =
  'block w-full text-left border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es');
}

function fmtDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins > 0 ? `${hours}h ${remMins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

async function fetchDeviceAlerts(deviceId: string) {
  const r = await apiService.listAlerts({ deviceId, limit: ALERT_FETCH_LIMIT });
  if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar las alertas');
  return r.data;
}

async function fetchDeviceTickets(deviceId: string) {
  const r = await apiService.listTickets({ deviceId, limit: TICKET_FETCH_LIMIT });
  if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los tickets');
  return r.data;
}

/**
 * Open work first, so the tab answers "what is wrong with this device right
 * now" before "what was". Open alerts already arrive newest-first; open tickets
 * follow the dispatcher's sense of urgency, then how far along they are.
 * Closed tickets go by when they closed, since the list endpoint orders by
 * schedule — which says little about a ticket that is already done.
 */
function splitTickets(tickets: TicketDTO[]) {
  const open = tickets
    .filter((t) => !isTerminal(t.status))
    .sort(
      (a, b) =>
        TICKET_PRIORITY_RANK[a.priority] - TICKET_PRIORITY_RANK[b.priority] ||
        TICKET_STATUS_RANK[b.status] - TICKET_STATUS_RANK[a.status] ||
        b.createdAt.localeCompare(a.createdAt)
    );
  const closedAt = (t: TicketDTO) => t.resolvedAt ?? t.cancelledAt ?? t.updatedAt;
  const closed = tickets
    .filter((t) => isTerminal(t.status))
    .sort((a, b) => closedAt(b).localeCompare(closedAt(a)));
  return { open, closed };
}

function CountNote({ open, total }: { open: number; total: number }) {
  return (
    <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
      {open > 0 ? `${open} sin cerrar · ` : ''}
      {total} en total
    </span>
  );
}

function AlertRow({ alert, ticket }: { alert: AlertDTO; ticket: TicketDTO | undefined }) {
  const isOpen = alert.status === 'OPEN';
  const duration = fmtDuration(alert.durationSecs);
  const severity = alert.severity === 'CRITICAL' ? 'danger' : 'warning';
  return (
    <li className="relative">
      <Link href={`/alerts/${alert.id}`} className={`${ROW_CLASSES} ${ticket ? 'pr-24' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{alert.description}</span>
          <Badge variant={isOpen ? severity : 'neutral'}>
            {isOpen ? (alert.severity === 'CRITICAL' ? 'Crítica' : 'Advertencia') : 'Resuelta'}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {alert.source} · {fmtDateTime(alert.startedAt)}
          {alert.resolvedAt && ` → ${fmtDateTime(alert.resolvedAt)}`}
          {duration && ` · duró ${duration}`}
        </p>
      </Link>
      {/* Its own link rather than nested in the row's — an <a> inside an <a>
          is invalid, and the two go to different places. */}
      {ticket && (
        <Link
          href={`/tickets/${ticket.id}`}
          className="absolute right-3 top-3 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
        >
          Ticket #{ticket.code}
        </Link>
      )}
    </li>
  );
}

function TicketRow({ ticket }: { ticket: TicketDTO }) {
  return (
    <li>
      <Link href={`/tickets/${ticket.id}`} className={ROW_CLASSES}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">#{ticket.code}</span>
          <Badge variant={TICKET_STATUS_VARIANTS[ticket.status]}>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
          {!isTerminal(ticket.status) && (
            <Badge variant={TICKET_PRIORITY_VARIANTS[ticket.priority]}>{TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
          )}
          {isAlertOrigin(ticket.origin) && <Badge variant="neutral">{ticketOriginLabel(ticket.origin)}</Badge>}
        </div>
        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{ticket.title}</p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {isTerminal(ticket.status)
            ? `Cerrado: ${fmtDateTime(ticket.resolvedAt ?? ticket.cancelledAt ?? ticket.updatedAt)}`
            : `Programado: ${formatSchedule(ticket.scheduledFor, ticket.startTime, ticket.endTime)}`}
        </p>
      </Link>
    </li>
  );
}

/**
 * Which unit this one replaced, or was replaced by. Rare, and one line each,
 * so it sits above the lists rather than earning a card of its own.
 */
function Lineage({ device }: { device: DeviceResponseDTO }) {
  if (!device.replacesDeviceId && !device.replacedByDeviceId) return null;
  const linkClass = 'font-medium text-brand-600 dark:text-brand-400 hover:underline';
  const when = (iso: string | null) => (iso ? ` · ${fmtDateTime(iso)}` : '');
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-700 dark:text-gray-300 space-y-1">
      {device.replacesDeviceId && (
        <p>
          Sustituyó a{' '}
          <Link href={`/devices/${device.replacesDeviceId}`} className={linkClass}>
            la unidad anterior
          </Link>
          <span className="text-xs text-gray-500 dark:text-gray-400">{when(device.replacedAt)}</span>
        </p>
      )}
      {device.replacedByDeviceId && (
        <p>
          Esta unidad fue reemplazada por{' '}
          <Link href={`/devices/${device.replacedByDeviceId}`} className={linkClass}>
            el equipo actual
          </Link>
          <span className="text-xs text-gray-500 dark:text-gray-400">{when(device.replacedAt)}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Everything that has happened to the device: its alerts, the tickets filed
 * against it, and any hardware replacement. The question an operator brings
 * here is usually "it went down; is someone already on it?", which used to
 * take the alerts list and the tickets list filtered by hand. An alert that
 * opened a ticket links straight to it.
 */
export function DeviceHistoryTab({ device }: Props) {
  const router = useRouter();
  const { canWrite } = usePermissions();

  const alertsQuery = useQuery({
    queryKey: ['alerts', 'device', device.id],
    queryFn: () => fetchDeviceAlerts(device.id),
  });

  // Prefix-matches the `['tickets']` invalidation every ticket write already does.
  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'device', device.id],
    queryFn: () => fetchDeviceTickets(device.id),
  });

  const alerts = useMemo(() => alertsQuery.data?.alerts ?? [], [alertsQuery.data]);
  const tickets = useMemo(() => ticketsQuery.data?.tickets ?? [], [ticketsQuery.data]);

  const openAlerts = alerts.filter((a) => a.status === 'OPEN');
  const closedAlerts = alerts.filter((a) => a.status !== 'OPEN');
  const { open: openTickets, closed: closedTickets } = useMemo(() => splitTickets(tickets), [tickets]);

  const ticketByAlert = useMemo(
    () => new Map(tickets.filter((t) => t.originAlertId).map((t) => [t.originAlertId as string, t])),
    [tickets]
  );

  const shownAlerts = [...openAlerts, ...closedAlerts.slice(0, RECENT_CLOSED)];
  const shownTickets = [...openTickets, ...closedTickets.slice(0, RECENT_CLOSED)];

  return (
    <div className="space-y-6">
      <Lineage device={device} />

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center">
              <SectionTitle info="Caídas de conectividad del sondeo y umbrales inalámbricos superados. Las abiertas primero, luego las más recientes ya resueltas.">
                Alertas
              </SectionTitle>
              {alertsQuery.data && (
                <CountNote open={openAlerts.length} total={alertsQuery.data.total} />
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`/alerts?deviceId=${device.id}`)}>
              Ver todas
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {alertsQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Cargando alertas..." />
            </div>
          ) : alertsQuery.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{(alertsQuery.error as Error).message}</p>
          ) : shownAlerts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Este dispositivo no ha registrado alertas.</p>
          ) : (
            <ul className="space-y-3">
              {shownAlerts.map((a) => (
                <AlertRow key={a.id} alert={a} ticket={ticketByAlert.get(a.id)} />
              ))}
            </ul>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center">
              <SectionTitle info="Tickets abiertos para este dispositivo, a mano o por una alerta. Los que siguen abiertos primero, luego los cerrados más recientes.">
                Tickets
              </SectionTitle>
              {ticketsQuery.data && (
                <CountNote open={openTickets.length} total={ticketsQuery.data.total} />
              )}
            </div>
            <div className="flex gap-2">
              {canWrite && (
                <Button variant="outline" size="sm" onClick={() => router.push(`/tickets/create?deviceId=${device.id}`)}>
                  Nuevo ticket
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => router.push(`/tickets?deviceId=${device.id}`)}>
                Ver todos
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {ticketsQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Cargando tickets..." />
            </div>
          ) : ticketsQuery.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{(ticketsQuery.error as Error).message}</p>
          ) : shownTickets.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sin tickets para este dispositivo.</p>
          ) : (
            <ul className="space-y-3">
              {shownTickets.map((t) => (
                <TicketRow key={t.id} ticket={t} />
              ))}
            </ul>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
