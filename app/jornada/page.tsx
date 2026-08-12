'use client';

import React, { useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { TicketDetailDTO } from '@/types/ticket.types';
import { TechnicianDTO } from '@/types/technician.types';
import { fetchAllTechnicians } from '@/hooks/useCatalogs';
import { useAuth } from '@/contexts/auth.context';
import { technicianActiveLabel, technicianActiveVariant } from '@/constants/technician.constants';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_VARIANTS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_VARIANTS,
  formatCalendarDayLong,
  ticketCategoryLabel,
  todayISODate,
} from '@/constants/ticket.constants';
import { TicketActions } from '@/components/tickets/TicketActions';
import {
  Badge,
  Button,
  Card,
  Combobox,
  ErrorBanner,
  Input,
  LoadingSpinner,
  PageHeader,
} from '@/components/ui';

/** One job on the sheet, in the order a technician needs to read it. */
function DayTicketCard({
  ticket,
  position,
  technicians,
  canWrite,
  onUpdated,
}: {
  ticket: TicketDetailDTO;
  position: number;
  technicians: TechnicianDTO[];
  canWrite: boolean;
  onUpdated: () => void | Promise<void>;
}) {
  const router = useRouter();

  const mapsUrl =
    ticket.address?.latitude != null && ticket.address?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${ticket.address.latitude},${ticket.address.longitude}`
      : ticket.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${ticket.address.street}, ${ticket.address.neighborhood}, ${ticket.address.municipality}`
          )}`
        : null;

  return (
    <Card>
      <Card.Body>
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-700 dark:text-gray-300">
            {position}
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                #{ticket.code}
              </span>
              <Badge variant={TICKET_PRIORITY_VARIANTS[ticket.priority]}>
                {TICKET_PRIORITY_LABELS[ticket.priority]}
              </Badge>
              <Badge variant={TICKET_STATUS_VARIANTS[ticket.status]}>
                {TICKET_STATUS_LABELS[ticket.status]}
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {ticketCategoryLabel(ticket.category)}
              </span>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 wrap-anywhere">
                {ticket.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-500 dark:text-gray-400">Cliente</p>
                {ticket.customer ? (
                  <>
                    <p className="text-gray-900 dark:text-gray-100">{ticket.customer.fullName}</p>
                    {/* The number to ring before driving out. */}
                    <a
                      href={`tel:${ticket.customer.phone}`}
                      className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {ticket.customer.phone}
                    </a>
                  </>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500">—</p>
                )}
              </div>

              <div>
                <p className="font-medium text-gray-500 dark:text-gray-400">Dispositivo</p>
                {ticket.device ? (
                  <>
                    <p className="text-gray-900 dark:text-gray-100">{ticket.device.name}</p>
                    {ticket.device.ipAddress && (
                      <p className="font-mono text-gray-600 dark:text-gray-400">
                        {ticket.device.ipAddress}
                      </p>
                    )}
                    {ticket.device.modelName && (
                      <p className="text-gray-600 dark:text-gray-400">{ticket.device.modelName}</p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500">—</p>
                )}
              </div>

              <div>
                <p className="font-medium text-gray-500 dark:text-gray-400">Dirección</p>
                {ticket.address ? (
                  <>
                    <p className="text-gray-900 dark:text-gray-100">{ticket.address.street}</p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {ticket.address.neighborhood}, {ticket.address.municipality}
                    </p>
                    {ticket.address.reference && (
                      <p className="text-gray-600 dark:text-gray-400">{ticket.address.reference}</p>
                    )}
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline print:hidden"
                      >
                        Abrir en Google Maps
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500">Sin dirección registrada</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <TicketActions
                ticket={ticket}
                technicians={technicians}
                canWrite={canWrite}
                onUpdated={onUpdated}
              />
              <Button variant="outline" size="sm" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                Ver ticket
              </Button>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

function JornadaPageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR';

  const [technicianId, setTechnicianId] = useState(() => searchParams.get('technicianId') ?? '');
  const [date, setDate] = useState(() => searchParams.get('date') ?? todayISODate());

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: fetchAllTechnicians,
  });

  const {
    data: sheet,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['daySheet', technicianId, date],
    queryFn: async () => {
      // The date is always sent explicitly: the backend defaults to today in
      // UTC, which is already tomorrow for a dispatcher west of Greenwich after
      // early evening.
      const r = await apiService.getTechnicianDaySheet(technicianId, date);
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar la jornada');
      return r.data;
    },
    enabled: !!technicianId,
  });

  const technicianOptions = useMemo(
    () =>
      technicians.map((t) => ({
        value: t.id,
        // Inactive technicians stay selectable: they can still have a day that
        // was scheduled before they came off the rota.
        label: t.isActive ? `${t.fullName} — ${t.phone}` : `${t.fullName} (inactivo)`,
      })),
    [technicians]
  );

  const urgentCount = sheet?.tickets.filter((t) => t.priority === 'URGENT').length ?? 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageHeader
        title="Jornada"
        subtitle="Las tareas de un técnico para un día, en el orden en que debe trabajarlas"
        onRefresh={technicianId ? () => refetch() : undefined}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            Imprimir
          </Button>
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Combobox
            label="Técnico"
            options={technicianOptions}
            value={technicianId}
            onChange={setTechnicianId}
            placeholder="Buscar técnico..."
            fullWidth
          />
          <Input
            label="Fecha"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
          />
          <Button variant="outline" onClick={() => setDate(todayISODate())}>
            Hoy
          </Button>
        </div>
      </div>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      {!technicianId ? (
        <Card>
          <Card.Body>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Elige un técnico para ver su jornada.
            </p>
          </Card.Body>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" message="Cargando jornada..." />
        </div>
      ) : sheet ? (
        <div className="space-y-4">
          <Card>
            <Card.Body>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {sheet.technician.fullName}
                  </h2>
                  <a
                    href={`tel:${sheet.technician.phone}`}
                    className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {sheet.technician.phone}
                  </a>
                </div>
                <div className="text-right">
                  <Badge variant={technicianActiveVariant(sheet.technician.isActive)}>
                    {technicianActiveLabel(sheet.technician.isActive)}
                  </Badge>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 first-letter:uppercase">
                    {formatCalendarDayLong(sheet.date)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {sheet.total} {sheet.total === 1 ? 'tarea' : 'tareas'}
                    {urgentCount > 0 && ` · ${urgentCount} urgente${urgentCount === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>
            </Card.Body>
          </Card>

          {sheet.tickets.length === 0 ? (
            <Card>
              <Card.Body>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Sin tareas programadas para este día.
                </p>
              </Card.Body>
            </Card>
          ) : (
            /*
             * The backend hands these back in dispatch order — URGENT → HIGH →
             * NORMAL → LOW, oldest first within a priority. That ordering is the
             * instruction, not a default: render as given. Do not sort, do not
             * paginate, and do not offer a sort control. (This is also why the
             * sheet is a stack of cards and not a DataTable, which would ship
             * both of those by default.)
             */
            sheet.tickets.map((ticket, index) => (
              <DayTicketCard
                key={ticket.id}
                ticket={ticket}
                position={index + 1}
                technicians={technicians}
                canWrite={canWrite}
                onUpdated={async () => {
                  await refetch();
                }}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function JornadaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      }
    >
      <JornadaPageContent />
    </Suspense>
  );
}
