'use client';

import React, { Suspense, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import type { TicketDTO, TimeBlock } from '@/types/ticket.types';
import { fetchAllTechnicians } from '@/hooks/useCatalogs';
import { useUrlState } from '@/hooks/useUrlState';
import { useAuth } from '@/contexts/auth.context';
import { useToast } from '@/contexts/toast.context';
import { todayISODate } from '@/constants/ticket.constants';
import { Button, ErrorBanner, LoadingSpinner, PageHeader } from '@/components/ui';
import { WeekCalendar } from '@/components/calendar/WeekCalendar';
import { UnscheduledPanel } from '@/components/calendar/UnscheduledPanel';
import { CalendarSlot, QuickCreateModal } from '@/components/calendar/QuickCreateModal';
import {
  UNASSIGNED_COLOR,
  UNASSIGNED_KEY,
  addDays,
  formatWeekRange,
  technicianColors,
  technicianKey,
  weekDays,
  weekStart,
} from '@/components/calendar/calendarUtils';

const REFRESH_MS = 60_000;
const PAGE_SIZE = 100; // the list endpoint's cap

const HIDDEN_KEY = 'nms:calendar-hidden';
const PANEL_KEY = 'nms:calendar-panel';
const LAST_TECHNICIAN_KEY = 'nms:calendar-last-technician';

// Per-browser conveniences only — the page works the same without them. Same
// external-store shape as the sidebar's collapse preference in AppShell.
const storageListeners = new Set<() => void>();
const subscribeStorage = (onChange: () => void) => {
  storageListeners.add(onChange);
  return () => {
    storageListeners.delete(onChange);
  };
};
const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
  storageListeners.forEach((onChange) => onChange());
};
/** A stored string; null on the server and until hydration. */
const useStored = (key: string) =>
  useSyncExternalStore(subscribeStorage, () => readStorage(key), () => null);

const parseHidden = (raw: string | null): Set<string> => {
  try {
    return new Set(JSON.parse(raw ?? '[]'));
  } catch {
    return new Set(); // corrupt value — everyone visible
  }
};

/** Every page of a listing — the endpoint caps `limit` at 100. */
async function fetchAllPages(query: Parameters<typeof apiService.listTickets>[0]) {
  const all: TicketDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listTickets({ ...query, limit: PAGE_SIZE, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los tickets');
    all.push(...r.data.tickets);
    hasMore = r.data.hasMore;
    offset += PAGE_SIZE;
  }
  return all;
}

function CalendarPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showError } = useToast();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR';
  const { get, set } = useUrlState();

  const today = todayISODate();
  const monday = weekStart(get('week', '') || today);
  const days = useMemo(() => weekDays(monday), [monday]);
  const from = days[0];
  const to = days[6];

  const hiddenRaw = useStored(HIDDEN_KEY);
  const hidden = useMemo(() => parseHidden(hiddenRaw), [hiddenRaw]);
  const panelOpen = useStored(PANEL_KEY) !== '0';
  const lastTechnicianId = useStored(LAST_TECHNICIAN_KEY) ?? '';
  const [pendingSlot, setPendingSlot] = useState<CalendarSlot | null>(null);

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: fetchAllTechnicians,
  });

  const weekKey = ['tickets', 'calendar', from, to];
  const {
    data: weekTickets = [],
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    // Under 'tickets' so every page that writes a ticket refreshes this too.
    queryKey: weekKey,
    queryFn: () => fetchAllPages({ scheduledFrom: from, scheduledTo: to }),
    refetchInterval: REFRESH_MS,
  });

  const unscheduledKey = ['tickets', 'calendarUnscheduled'];
  const unscheduledQuery = useQuery({
    queryKey: unscheduledKey,
    // No "unscheduled only" filter exists, so this reads every open ticket and
    // keeps the ones without a day. See TODOS.md.
    queryFn: async () => (await fetchAllPages({ openOnly: true })).filter((t) => !t.scheduledFor),
    enabled: panelOpen,
    refetchInterval: REFRESH_MS,
  });

  // ---------- Technicians: colors and filter ----------

  const colors = useMemo(() => technicianColors(technicians), [technicians]);
  const colorFor = useCallback(
    (t: TicketDTO) => (t.technicianId && colors.get(t.technicianId)) || UNASSIGNED_COLOR,
    [colors]
  );
  const technicianName = useCallback(
    (t: TicketDTO) =>
      t.technicianId
        ? technicians.find((x) => x.id === t.technicianId)?.fullName ?? 'Técnico'
        : 'Sin asignar',
    [technicians]
  );

  // Active technicians, plus an inactive one who still has work this week.
  const filterTechnicians = useMemo(() => {
    const busy = new Set(weekTickets.map((t) => t.technicianId));
    return technicians
      .filter((t) => t.isActive || busy.has(t.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [technicians, weekTickets]);

  const toggleHidden = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    writeStorage(HIDDEN_KEY, JSON.stringify([...next]));
  };
  const showAll = () => writeStorage(HIDDEN_KEY, '[]');

  const visible = useCallback((t: TicketDTO) => !hidden.has(technicianKey(t)), [hidden]);
  const shownWeek = useMemo(() => weekTickets.filter(visible), [weekTickets, visible]);
  const shownUnscheduled = useMemo(
    () => (unscheduledQuery.data ?? []).filter(visible),
    [unscheduledQuery.data, visible]
  );

  const setPanel = (open: boolean) => writeStorage(PANEL_KEY, open ? '1' : '0');

  // ---------- Create ----------

  /**
   * Who a new ticket goes to by default: the one technician the filter is
   * narrowed to, if it is; otherwise whoever was picked last time, while they
   * are still active.
   */
  const defaultTechnicianId = useMemo(() => {
    const shown = filterTechnicians.filter((t) => t.isActive && !hidden.has(t.id));
    if (shown.length === 1 && hidden.has(UNASSIGNED_KEY)) return shown[0].id;
    return technicians.some((t) => t.id === lastTechnicianId && t.isActive) ? lastTechnicianId : '';
  }, [filterTechnicians, hidden, technicians, lastTechnicianId]);

  const handleCreated = (technicianId: string) => {
    setPendingSlot(null);
    if (technicianId) writeStorage(LAST_TECHNICIAN_KEY, technicianId);
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  // ---------- Move / resize ----------

  const handleReschedule = async (ticket: TicketDTO, day: string, block: TimeBlock | null) => {
    const moved: TicketDTO = {
      ...ticket,
      scheduledFor: day,
      startTime: block?.startTime ?? null,
      endTime: block?.endTime ?? null,
    };

    // Show the drop right away; the refetch below settles it either way.
    await queryClient.cancelQueries({ queryKey: weekKey });
    queryClient.setQueryData<TicketDTO[]>(weekKey, (old = []) => [
      ...old.filter((t) => t.id !== ticket.id),
      moved,
    ]);
    queryClient.setQueryData<TicketDTO[]>(unscheduledKey, (old) =>
      old?.filter((t) => t.id !== ticket.id)
    );

    // Resending the block on every drop is required: the call replaces the
    // whole schedule, and a day without times means "any time that day".
    const result = await apiService.scheduleTicket(ticket.id, day, block);
    if (!result.success) showError(result.error || 'No se pudo reprogramar el ticket');
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  const openTicket = (t: TicketDTO) => router.push(`/tickets/${t.id}`);

  const goToWeek = (day: string | null) => set({ week: day });

  return (
    <div className="px-4 py-8 max-w-[1600px] mx-auto">
      <PageHeader
        title="Calendario"
        subtitle="Las visitas programadas de la semana"
        info={
          canWrite
            ? 'Haz clic en una franja para crear una tarea, o arrastra para elegir el rango. Arrastra una tarea para moverla y su borde inferior para cambiar su duración.'
            : undefined
        }
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          !panelOpen && (
            <Button variant="outline" onClick={() => setPanel(true)} className="hidden lg:inline-flex">
              Sin programar
              {unscheduledQuery.data ? ` (${shownUnscheduled.length})` : ''}
            </Button>
          )
        }
      />

      {/* Week navigation */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={() => goToWeek(null)}>
          Hoy
        </Button>
        <button
          type="button"
          onClick={() => goToWeek(addDays(monday, -7))}
          aria-label="Semana anterior"
          title="Semana anterior"
          className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => goToWeek(addDays(monday, 7))}
          aria-label="Semana siguiente"
          title="Semana siguiente"
          className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 first-letter:uppercase">
          {formatWeekRange(monday)}
        </h2>
      </div>

      {/* Technician filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {filterTechnicians.map((t) => {
          const off = hidden.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleHidden(t.id)}
              aria-pressed={!off}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                off
                  ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${off ? 'bg-gray-300 dark:bg-gray-600' : colors.get(t.id)?.swatch}`}
              />
              {t.fullName}
              {!t.isActive && ' (inactivo)'}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => toggleHidden(UNASSIGNED_KEY)}
          aria-pressed={!hidden.has(UNASSIGNED_KEY)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            hidden.has(UNASSIGNED_KEY)
              ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              hidden.has(UNASSIGNED_KEY) ? 'bg-gray-300 dark:bg-gray-600' : UNASSIGNED_COLOR.swatch
            }`}
          />
          Sin asignar
        </button>
        {hidden.size > 0 && (
          <button
            type="button"
            onClick={showAll}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Mostrar todos
          </button>
        )}
      </div>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" message="Cargando calendario..." />
        </div>
      ) : (
        <WeekCalendar
          days={days}
          today={today}
          tickets={shownWeek}
          colorFor={colorFor}
          canWrite={canWrite}
          pendingSlot={pendingSlot}
          onCreateSlot={setPendingSlot}
          onOpenTicket={openTicket}
          onReschedule={handleReschedule}
          renderSidePanel={
            panelOpen
              ? (beginDrag) => (
                  <UnscheduledPanel
                    tickets={shownUnscheduled}
                    isLoading={unscheduledQuery.isLoading}
                    error={unscheduledQuery.error ? (unscheduledQuery.error as Error).message : null}
                    colorFor={colorFor}
                    technicianName={technicianName}
                    canWrite={canWrite}
                    beginDrag={beginDrag}
                    onOpenTicket={openTicket}
                    onHide={() => setPanel(false)}
                  />
                )
              : undefined
          }
        />
      )}

      <QuickCreateModal
        slot={pendingSlot}
        technicians={technicians}
        defaultTechnicianId={defaultTechnicianId}
        onClose={() => setPendingSlot(null)}
        onCreated={handleCreated}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      }
    >
      <CalendarPageContent />
    </Suspense>
  );
}
