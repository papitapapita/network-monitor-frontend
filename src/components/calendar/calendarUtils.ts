import type { TicketDTO } from '@/types/ticket.types';
import type { TechnicianDTO } from '@/types/technician.types';
import { timeToMinutes } from '@/constants/ticket.constants';

// ============================================================
// Grid geometry
// ============================================================

export const START_HOUR = 6;
export const END_HOUR = 22;
export const HOUR_PX = 48;
/** Move and resize snap to this; a click-created block starts on the half hour. */
export const SNAP_MIN = 15;
export const CREATE_SNAP_MIN = 30;
export const DEFAULT_BLOCK_MIN = 60;

export const GRID_START_MIN = START_HOUR * 60;
export const GRID_END_MIN = END_HOUR * 60;
export const GRID_HEIGHT_PX = (END_HOUR - START_HOUR) * HOUR_PX;

export const minutesToPx = (minutes: number) => ((minutes - GRID_START_MIN) / 60) * HOUR_PX;
export const pxToMinutes = (px: number) => GRID_START_MIN + (px / HOUR_PX) * 60;

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const snapDown = (minutes: number, step: number) => Math.floor(minutes / step) * step;
export const snapRound = (minutes: number, step: number) => Math.round(minutes / step) * step;

// ============================================================
// Days
// ============================================================
//
// Days are 'YYYY-MM-DD' strings throughout, like `scheduledFor`. The Date
// objects below are local-calendar scratch values built from y/m/d parts — no
// ISO parsing and no toISOString, which would shift a day across midnight UTC.

const toDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const toDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

export const addDays = (day: string, n: number) => {
  const date = toDate(day);
  date.setDate(date.getDate() + n);
  return toDay(date);
};

/** The Monday of the week `day` falls in. */
export const weekStart = (day: string) => {
  const weekday = (toDate(day).getDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
};

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** "lun 22" for a column header. */
export const formatDayHeader = (day: string) => {
  const date = toDate(day);
  return {
    weekday: date.toLocaleDateString('es', { weekday: 'short' }).replace('.', ''),
    date: date.getDate(),
  };
};

/** "22 – 28 de septiembre de 2026", or across months "29 sept – 5 oct 2026". */
export const formatWeekRange = (monday: string) => {
  const start = toDate(monday);
  const end = toDate(addDays(monday, 6));
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.toLocaleDateString('es', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`;
  }
  const short = { day: 'numeric', month: 'short' } as const;
  return `${start.toLocaleDateString('es', short)} – ${end.toLocaleDateString('es', {
    ...short,
    year: 'numeric',
  })}`;
};

// ============================================================
// Technician colors
// ============================================================

export interface TechnicianColor {
  /** The event block itself. */
  block: string;
  /** A solid dot, for the filter chips and the side panel. */
  swatch: string;
}

// Written out in full so Tailwind sees every class at build time.
const PALETTE: TechnicianColor[] = [
  { block: 'bg-blue-100 border-blue-500 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100', swatch: 'bg-blue-500' },
  { block: 'bg-emerald-100 border-emerald-500 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100', swatch: 'bg-emerald-500' },
  { block: 'bg-amber-100 border-amber-500 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100', swatch: 'bg-amber-500' },
  { block: 'bg-rose-100 border-rose-500 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100', swatch: 'bg-rose-500' },
  { block: 'bg-violet-100 border-violet-500 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100', swatch: 'bg-violet-500' },
  { block: 'bg-cyan-100 border-cyan-500 text-cyan-900 dark:bg-cyan-900/60 dark:text-cyan-100', swatch: 'bg-cyan-500' },
  { block: 'bg-orange-100 border-orange-500 text-orange-900 dark:bg-orange-900/60 dark:text-orange-100', swatch: 'bg-orange-500' },
  { block: 'bg-lime-100 border-lime-600 text-lime-900 dark:bg-lime-900/60 dark:text-lime-100', swatch: 'bg-lime-600' },
  { block: 'bg-fuchsia-100 border-fuchsia-500 text-fuchsia-900 dark:bg-fuchsia-900/60 dark:text-fuchsia-100', swatch: 'bg-fuchsia-500' },
  { block: 'bg-teal-100 border-teal-500 text-teal-900 dark:bg-teal-900/60 dark:text-teal-100', swatch: 'bg-teal-500' },
];

export const UNASSIGNED_COLOR: TechnicianColor = {
  block: 'bg-gray-100 border-gray-400 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
  swatch: 'bg-gray-400',
};

/**
 * One color per technician, by hire order so a technician keeps their color
 * as others are added after them. Colors repeat past ten technicians.
 */
export function technicianColors(technicians: TechnicianDTO[]): Map<string, TechnicianColor> {
  const ordered = [...technicians].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
  return new Map(ordered.map((t, i) => [t.id, PALETTE[i % PALETTE.length]]));
}

// ============================================================
// Overlap layout
// ============================================================

export interface PositionedTicket {
  ticket: TicketDTO;
  start: number;
  end: number;
  /** Column within its overlap cluster, and how many columns the cluster has. */
  col: number;
  cols: number;
}

/**
 * Lays one day's timed tickets out side by side where they overlap, the way
 * Google Calendar does: each cluster of transitively overlapping blocks is
 * split into as many columns as it needs at its busiest, and every block takes
 * the first column free at its start. Overlaps are allowed on purpose
 * (TKT-082), so this is only presentation — nothing is flagged.
 */
export function layoutDay(tickets: TicketDTO[]): PositionedTicket[] {
  const items = tickets
    .filter((t) => t.startTime && t.endTime)
    .map((t) => ({ ticket: t, start: timeToMinutes(t.startTime!), end: timeToMinutes(t.endTime!) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: PositionedTicket[] = [];
  let cluster: PositionedTicket[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    cluster.forEach((p) => (p.cols = columnEnds.length));
    result.push(...cluster);
    cluster = [];
    columnEnds = [];
  };

  for (const item of items) {
    if (item.start >= clusterEnd) closeCluster();
    let col = columnEnds.findIndex((end) => end <= item.start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[col] = item.end;
    }
    cluster.push({ ...item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  closeCluster();
  return result;
}

// ============================================================
// Filter
// ============================================================

/** Stands in for "no technician" in the hidden set. */
export const UNASSIGNED_KEY = '__unassigned__';

export const technicianKey = (ticket: TicketDTO) => ticket.technicianId ?? UNASSIGNED_KEY;
