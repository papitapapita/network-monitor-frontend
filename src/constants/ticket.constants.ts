import type { BadgeVariant } from '@/components/ui';
import type {
  TicketCategory,
  TicketOrigin,
  TicketPriority,
  TicketStatus,
} from '@/types/ticket.types';

// ============================================================
// Status
// ============================================================

const TICKET_STATUS_CORE: { value: TicketStatus; label: string }[] = [
  { value: 'OPEN', label: 'Abierto' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'RESOLVED', label: 'Resuelto' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export const TICKET_STATUS_LABELS = Object.fromEntries(
  TICKET_STATUS_CORE.map(({ value, label }) => [value, label])
) as Record<TicketStatus, string>;

export const ticketStatusLabel = (status: TicketStatus | null | undefined): string =>
  status ? TICKET_STATUS_LABELS[status] ?? status.replace(/_/g, ' ') : '—';

export const TICKET_STATUS_VARIANTS: Record<TicketStatus, BadgeVariant> = {
  OPEN: 'info',
  ASSIGNED: 'draft',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CANCELLED: 'neutral',
};

/** Lifecycle order, so the Estado column sorts by progress rather than alphabet. */
export const TICKET_STATUS_RANK: Record<TicketStatus, number> = {
  OPEN: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
  CANCELLED: 4,
};

/**
 * `openOnly` and `status` contradict each other on the list endpoint, and the
 * backend resolves it silently in favour of `openOnly`. Rather than offer two
 * controls and police the combination, the Estado filter is one select and
 * "sin cerrar" is an option within it — so the pair cannot both be set.
 * Same idea for `unassignedOnly` vs `technicianId` below.
 */
export const OPEN_ONLY_VALUE = '__open__';

export const TICKET_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: OPEN_ONLY_VALUE, label: 'Sin cerrar (abierto, asignado o en progreso)' },
  ...TICKET_STATUS_CORE,
];

/** The dispatcher's inbox, as an option on the Técnico filter. */
export const UNASSIGNED_VALUE = '__unassigned__';

// ============================================================
// Priority
// ============================================================

// Ordered least to most urgent, which is also the order a picker should read in.
const TICKET_PRIORITY_CORE: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Baja' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

export const TICKET_PRIORITY_LABELS = Object.fromEntries(
  TICKET_PRIORITY_CORE.map(({ value, label }) => [value, label])
) as Record<TicketPriority, string>;

export const ticketPriorityLabel = (priority: TicketPriority | null | undefined): string =>
  priority ? TICKET_PRIORITY_LABELS[priority] ?? priority : '—';

export const TICKET_PRIORITY_VARIANTS: Record<TicketPriority, BadgeVariant> = {
  LOW: 'neutral',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

export const TICKET_PRIORITY_OPTIONS = TICKET_PRIORITY_CORE;

export const TICKET_PRIORITY_CREATE_OPTIONS = [
  { value: '', label: 'Por defecto (Normal)' },
  ...TICKET_PRIORITY_CORE,
];

export const TICKET_PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'Todas las prioridades' },
  ...TICKET_PRIORITY_CORE,
];

/**
 * Rank used only to *read* the day sheet's ordering back — never to re-sort it.
 * The backend's order is the dispatcher's instruction; see the note in
 * `app/jornada/page.tsx`.
 */
export const TICKET_PRIORITY_RANK: Record<TicketPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

// ============================================================
// Category
// ============================================================

const TICKET_CATEGORY_CORE: { value: TicketCategory; label: string }[] = [
  { value: 'CONNECTIVITY', label: 'Conectividad' },
  { value: 'INSTALLATION', label: 'Instalación' },
  { value: 'HARDWARE_FAILURE', label: 'Falla de hardware' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'RELOCATION', label: 'Reubicación' },
  { value: 'OTHER', label: 'Otro' },
];

export const TICKET_CATEGORY_LABELS = Object.fromEntries(
  TICKET_CATEGORY_CORE.map(({ value, label }) => [value, label])
) as Record<TicketCategory, string>;

export const ticketCategoryLabel = (category: TicketCategory | null | undefined): string =>
  category ? TICKET_CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ') : '—';

export const TICKET_CATEGORY_OPTIONS = [
  { value: '', label: 'Seleccionar categoría' },
  ...TICKET_CATEGORY_CORE,
];

export const TICKET_CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  ...TICKET_CATEGORY_CORE,
];

// ============================================================
// Origin
// ============================================================

export const TICKET_ORIGIN_LABELS: Record<TicketOrigin, string> = {
  MANUAL: 'Manual',
  DEVICE_ALERT: 'Alerta de dispositivo',
  WIRELESS_ALERT: 'Alerta inalámbrica',
};

export const ticketOriginLabel = (origin: TicketOrigin | null | undefined): string =>
  origin ? TICKET_ORIGIN_LABELS[origin] ?? origin : '—';

/** A ticket the system opened for itself, rather than one an operator filed. */
export const isAlertOrigin = (origin: TicketOrigin): boolean => origin !== 'MANUAL';

// ============================================================
// The state machine
// ============================================================
//
// These predicates are the single source of truth for which action a ticket
// admits. Every screen renders its buttons from them, so a transition the
// backend would refuse is never offered — the 409s below stay unreachable by
// clicking, and only show up if the role or the ticket changed underneath.

/** RESOLVED and CANCELLED are history: every write endpoint 409s (TKT-009, TKT-010). */
export const isTerminal = (status: TicketStatus): boolean =>
  status === 'RESOLVED' || status === 'CANCELLED';

/**
 * Reassignment is allowed until work starts (TKT-071) and refused once someone
 * is on site (TKT-072) — swapping the technician mid-visit would lose who did
 * what.
 */
export const canAssign = (status: TicketStatus): boolean =>
  status === 'OPEN' || status === 'ASSIGNED';

/**
 * Only an assigned ticket can be started (TKT-040), and only once (TKT-041) —
 * restarting would overwrite `startedAt`.
 */
export const canStart = (status: TicketStatus): boolean => status === 'ASSIGNED';

/**
 * Resolving straight from ASSIGNED is normal — plenty of faults are fixed
 * remotely without a visit. From OPEN it is refused (TKT-042): nobody is
 * attached, so there is no one whose work the notes describe.
 */
export const canResolve = (status: TicketStatus): boolean =>
  status === 'ASSIGNED' || status === 'IN_PROGRESS';

/** A resolved ticket cannot be cancelled, nor one already cancelled (TKT-045, TKT-046). */
export const canCancel = (status: TicketStatus): boolean => !isTerminal(status);

/** `PUT /:id` and the scheduling endpoint both refuse a terminal ticket (TKT-074). */
export const canEdit = (status: TicketStatus): boolean => !isTerminal(status);

/** Why a terminal ticket shows no actions, phrased for the operator. */
export const terminalNotice = (status: TicketStatus): string | null =>
  status === 'RESOLVED'
    ? 'Este ticket está resuelto y no admite cambios.'
    : status === 'CANCELLED'
      ? 'Este ticket está cancelado y no admite cambios.'
      : null;

// ============================================================
// Calendar days
// ============================================================
//
// `scheduledFor` is a calendar day, not an instant. Both helpers below avoid
// Date's UTC handling on purpose: `new Date('2026-08-05').toISOString()` and
// `new Date().toISOString()` each shift the day by one either side of midnight,
// depending on the offset — which would silently schedule visits for the wrong
// date.

/** Today as 'YYYY-MM-DD' in the operator's own timezone. */
export const todayISODate = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/** Renders a 'YYYY-MM-DD' day in Spanish without reinterpreting it as UTC midnight. */
export const formatScheduledFor = (day: string | null | undefined): string => {
  if (!day) return '—';
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return day;
  return new Date(year, month - 1, date).toLocaleDateString('es');
};

/** "miércoles, 5 de agosto de 2026" — for the day sheet's header. */
export const formatCalendarDayLong = (day: string): string => {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return day;
  return new Date(year, month - 1, date).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** The backend 400s on a reversed range, so the form catches it first. */
export const isReversedDateRange = (from: string, to: string): boolean =>
  !!from && !!to && from > to;
