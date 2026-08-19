'use client';

import React, { useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useTickets } from '@/hooks/useTickets';
import { fetchAllTechnicians } from '@/hooks/useCatalogs';
import { useAuth } from '@/contexts/auth.context';
import { buildTicketColumns } from '@/components/tickets/ticketColumns';
import {
  TICKET_CATEGORY_FILTER_OPTIONS,
  TICKET_PRIORITY_FILTER_OPTIONS,
  TICKET_STATUS_FILTER_OPTIONS,
  UNASSIGNED_VALUE,
  canResolve,
  isTerminal,
} from '@/constants/ticket.constants';
import {
  Button,
  DataTable,
  ErrorBanner,
  FilterBar,
  Input,
  LoadingSpinner,
  PageHeader,
  Select,
  sortRows,
} from '@/components/ui';

const ticketCount = (n: number) => `${n} ${n === 1 ? 'ticket' : 'tickets'}`;

function TicketsPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR';
  const isAdmin = user?.role === 'ADMIN';

  const t = useTickets();

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: fetchAllTechnicians,
  });

  const technicianName = useMemo(() => {
    const byId = new Map(technicians.map((tech) => [tech.id, tech.fullName]));
    return (id: string | null) => (id ? byId.get(id) ?? 'Técnico desconocido' : null);
  }, [technicians]);

  const columns = useMemo(() => buildTicketColumns(technicianName), [technicianName]);

  // Sorting orders the page that was fetched, not the whole backlog — the list
  // endpoint offers no sort parameter. Same limitation the alerts table lives
  // with; the filters are what narrow the query itself.
  const rows = useMemo(
    () => sortRows(t.tickets, columns, t.sortField, t.sortDirection),
    [t.tickets, columns, t.sortField, t.sortDirection]
  );

  const technicianOptions = useMemo(
    () => [
      { value: '', label: 'Todos los técnicos' },
      { value: UNASSIGNED_VALUE, label: 'Sin asignar' },
      ...technicians.map((tech) => ({
        value: tech.id,
        label: tech.isActive ? tech.fullName : `${tech.fullName} (inactivo)`,
      })),
    ],
    [technicians]
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <PageHeader
        title="Tickets"
        subtitle={
          t.hasFilters
            ? `${t.totalTickets} ${t.totalTickets === 1 ? 'coincide' : 'coinciden'} con los filtros`
            : `${t.totalTickets} ${t.totalTickets === 1 ? 'ticket' : 'tickets'} en total`
        }
        onRefresh={() => t.fetchTickets()}
        isRefreshing={t.isFetching}
        lastRefreshed={t.lastRefreshed}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/jornada')}>
              Jornada
            </Button>
            {canWrite && <Button onClick={() => router.push('/tickets/create')}>Nuevo Ticket</Button>}
          </>
        }
      />

      <FilterBar columns={4} hasFilters={t.hasFilters} onClear={t.clearFilters}>
        <Input
          label="Buscar"
          value={t.search}
          onChange={(e) => t.setSearch(e.target.value)}
          placeholder="Código, asunto o descripción..."
          helperText="Filtra los tickets de esta página"
          fullWidth
        />
        {/* "Sin cerrar" is an option here rather than a checkbox beside the
            select, because `openOnly` and `status` contradict each other on the
            backend and the broader one wins silently. One control, one
            parameter, no contradiction to police. */}
        <Select
          label="Estado"
          value={t.statusFilter}
          onChange={(e) => t.setStatusFilter(e.target.value)}
          options={TICKET_STATUS_FILTER_OPTIONS}
          fullWidth
        />
        <Select
          label="Prioridad"
          value={t.priorityFilter}
          onChange={(e) => t.setPriorityFilter(e.target.value)}
          options={TICKET_PRIORITY_FILTER_OPTIONS}
          fullWidth
        />
        <Select
          label="Categoría"
          value={t.categoryFilter}
          onChange={(e) => t.setCategoryFilter(e.target.value)}
          options={TICKET_CATEGORY_FILTER_OPTIONS}
          fullWidth
        />
        {/* Same trick: "Sin asignar" lives inside the technician select, so
            `unassignedOnly` and `technicianId` can never both be sent. */}
        <Select
          label="Técnico"
          value={t.technicianFilter}
          onChange={(e) => t.setTechnicianFilter(e.target.value)}
          options={technicianOptions}
          fullWidth
        />
        <Input
          label="Programado desde"
          type="date"
          value={t.scheduledFrom}
          onChange={(e) => t.setScheduledFrom(e.target.value)}
          max={t.scheduledTo || undefined}
          fullWidth
        />
        <Input
          label="Programado hasta"
          type="date"
          value={t.scheduledTo}
          onChange={(e) => t.setScheduledTo(e.target.value)}
          min={t.scheduledFrom || undefined}
          fullWidth
        />
      </FilterBar>

      {t.error && <ErrorBanner message={t.error} onRetry={() => t.fetchTickets()} />}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `#${row.code} ${row.title}`}
        onRowClick={(row) => router.push(`/tickets/${row.id}`)}
        isLoading={t.isLoading}
        loadingMessage="Cargando tickets..."
        emptyMessage={
          t.hasFilters
            ? 'Ningún ticket coincide con los filtros'
            : 'Sin tickets. Crea el primero, o espera a que el monitoreo abra uno.'
        }
        sort={{ field: t.sortField, direction: t.sortDirection, onSort: t.handleSort }}
        selectionResetKey={`${t.currentPage}|${t.statusFilter}|${t.technicianFilter}|${t.priorityFilter}|${t.categoryFilter}`}
        bulkDelete={
          canWrite
            ? {
                // Deleting stays ADMIN work; resolving is what an OPERATOR is
                // here to do, and it needs the same checkboxes.
                deleteOne: isAdmin ? (id) => apiService.deleteTicket(id) : undefined,
                onFinished: () => {
                  t.fetchTickets();
                },
                entity: { singular: 'ticket', plural: 'tickets', gender: 'm' },
                // Deleting is for tickets raised in error. A closed one is the
                // record of work that happened, so it is cancelled, not erased.
                // Terminal tickets refuse every write, so this gates the whole bar.
                canDelete: (row) => !isTerminal(row.status),
                blockedHint:
                  'Los tickets resueltos o cancelados son historial; ciérralos con «Cancelar», no los borres',
                bulkActions: [
                  {
                    key: 'resolve',
                    label: 'Resolver',
                    confirmTitle: 'Resolver tickets',
                    confirmMessage: (n) =>
                      n === 1
                        ? '¿Resolver 1 ticket? Saldrá de la jornada de su técnico de inmediato.'
                        : `¿Resolver ${ticketCount(n)}? Saldrán de la jornada de su técnico de inmediato, con la misma nota de resolución en todos — si el trabajo no fue el mismo, resuélvelos por separado.`,
                    confirmText: 'Resolver',
                    doneParticiple: 'resuelt',
                    progressVerb: 'Resolviendo',
                    // Resolving straight from ASSIGNED is normal; from OPEN the
                    // backend refuses (TKT-042) — nobody is attached for the
                    // notes to describe.
                    skipRow: (row) =>
                      canResolve(row.status) ? null : 'sin técnico o ya cerrados',
                    prompt: {
                      label: 'Notas de resolución',
                      placeholder: 'Qué se hizo para cerrar estos tickets',
                      helper: 'Se guarda la misma nota en cada ticket.',
                      maxLength: 5000,
                      requiredMessage: 'Las notas de resolución son obligatorias.',
                    },
                    runOne: (id, notes) => apiService.resolveTicket(id, notes ?? ''),
                  },
                ],
              }
            : undefined
        }
        pagination={{
          currentPage: t.currentPage,
          totalPages: t.totalPages,
          totalItems: t.totalTickets,
          itemsPerPage: t.limit,
          onPageChange: t.setCurrentPage,
          pageSizeOptions: t.PAGE_SIZE_OPTIONS,
          onPageSizeChange: t.setLimit,
        }}
      />
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      }
    >
      <TicketsPageContent />
    </Suspense>
  );
}
