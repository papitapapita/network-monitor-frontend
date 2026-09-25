'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TicketDTO, TimeBlock } from '@/types/ticket.types';
import { canEdit, minutesToTime, timeToMinutes } from '@/constants/ticket.constants';
import {
  CREATE_SNAP_MIN,
  DEFAULT_BLOCK_MIN,
  END_HOUR,
  GRID_END_MIN,
  GRID_HEIGHT_PX,
  GRID_START_MIN,
  HOUR_PX,
  SNAP_MIN,
  START_HOUR,
  TechnicianColor,
  clamp,
  formatDayHeader,
  layoutDay,
  minutesToPx,
  pxToMinutes,
  snapDown,
  snapRound,
} from './calendarUtils';
import type { CalendarSlot } from './QuickCreateModal';

/** Where a dragged ticket would land. */
type DropTarget = { dayIdx: number; allDay: true } | { dayIdx: number; allDay: false; start: number };

type DragState =
  | { kind: 'create'; dayIdx: number; anchor: number; current: number; moved: boolean }
  | {
      kind: 'move';
      ticket: TicketDTO;
      duration: number;
      /** Minutes between the block's start and where it was grabbed. */
      grabOffset: number;
      originX: number;
      originY: number;
      /** False until the pointer travels a few pixels — until then it is a click. */
      started: boolean;
      target: DropTarget | null;
    }
  | { kind: 'resize'; ticket: TicketDTO; start: number; end: number; originalEnd: number };

const DRAG_THRESHOLD_PX = 4;

/** Minutes since midnight in the browser's clock — business time, for now (Colombia only). */
function useNowMinutes() {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setNow(read()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

interface WeekCalendarProps {
  days: string[];
  today: string;
  /** Scheduled tickets for `days`, already filtered by technician. */
  tickets: TicketDTO[];
  colorFor: (ticket: TicketDTO) => TechnicianColor;
  canWrite: boolean;
  /** The slot the quick-create form is open on, kept highlighted behind it. */
  pendingSlot: CalendarSlot | null;
  onCreateSlot: (slot: CalendarSlot) => void;
  onOpenTicket: (ticket: TicketDTO) => void;
  /** A drop: the new day plus its block, or `null` for "any time that day". */
  onReschedule: (ticket: TicketDTO, day: string, block: TimeBlock | null) => void;
  /** Renders beside the grid; gets a starter so its items can be dragged in. */
  renderSidePanel?: (beginDrag: (ticket: TicketDTO, e: React.PointerEvent) => void) => React.ReactNode;
}

/**
 * A Google Calendar–style week: seven day columns over a 06:00–22:00 grid,
 * with an all-day row on top for tickets scheduled without a time block.
 *
 * - Click an empty slot for a one-hour block; drag down a column for a custom
 *   range. Clicking the all-day row creates a ticket with no block.
 * - Drag a block to move it, including into or out of the all-day row; drag its
 *   bottom edge to resize. Each drop is exactly one `schedule` call.
 * - Resolved and cancelled tickets are dimmed and fixed in place — the backend
 *   refuses any change to them.
 *
 * Times never pass through Date: every position is minutes since midnight,
 * converted to and from the ticket's 'HH:mm' strings.
 */
export function WeekCalendar({
  days,
  today,
  tickets,
  colorFor,
  canWrite,
  pendingSlot,
  onCreateSlot,
  onOpenTicket,
  onReschedule,
  renderSidePanel,
}: WeekCalendarProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const allDayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  // A drag that ends over the all-day row would otherwise also land as a click
  // on it and open the create form.
  const suppressClickUntil = useRef(0);
  const nowMinutes = useNowMinutes();
  // The window listeners are bound once per drag; they read the latest props
  // through here rather than the ones captured when the drag began.
  const latest = useRef({ days, onCreateSlot, onReschedule, onOpenTicket });
  latest.current = { days, onCreateSlot, onReschedule, onOpenTicket };

  const { timedByDay, allDayByDay } = useMemo(() => {
    const timed = days.map((day) => layoutDay(tickets.filter((t) => t.scheduledFor === day)));
    const allDay = days.map((day) =>
      tickets.filter((t) => t.scheduledFor === day && !t.startTime)
    );
    return { timedByDay: timed, allDayByDay: allDay };
  }, [days, tickets]);

  // ---------- Geometry ----------

  const dayIndexAt = (rect: DOMRect, x: number) =>
    clamp(Math.floor(((x - rect.left) / rect.width) * 7), 0, 6);

  const minutesAt = (y: number) => {
    const rect = gridRef.current!.getBoundingClientRect();
    return pxToMinutes(y - rect.top);
  };

  const locate = useCallback((x: number, y: number) => {
    const allDay = allDayRef.current?.getBoundingClientRect();
    if (allDay && x >= allDay.left && x <= allDay.right && y >= allDay.top && y <= allDay.bottom) {
      return { dayIdx: dayIndexAt(allDay, x), allDay: true as const };
    }
    const grid = gridRef.current?.getBoundingClientRect();
    if (grid && x >= grid.left && x <= grid.right && y >= grid.top && y <= grid.bottom) {
      return { dayIdx: dayIndexAt(grid, x), allDay: false as const, minutes: pxToMinutes(y - grid.top) };
    }
    return null;
  }, []);

  // ---------- Drag lifecycle ----------

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === 'create') {
        const current = clamp(
          snapDown(minutesAt(e.clientY), CREATE_SNAP_MIN),
          GRID_START_MIN,
          GRID_END_MIN - CREATE_SNAP_MIN
        );
        setDrag({ ...d, current, moved: d.moved || current !== d.anchor });
      } else if (d.kind === 'resize') {
        const end = clamp(snapRound(minutesAt(e.clientY), SNAP_MIN), d.start + SNAP_MIN, GRID_END_MIN);
        if (end !== d.end) setDrag({ ...d, end });
      } else {
        const started =
          d.started ||
          Math.hypot(e.clientX - d.originX, e.clientY - d.originY) >= DRAG_THRESHOLD_PX;
        if (!started) return;
        const loc = locate(e.clientX, e.clientY);
        let target: DropTarget | null = null;
        if (loc?.allDay) target = { dayIdx: loc.dayIdx, allDay: true };
        else if (loc) {
          const start = clamp(
            snapRound(loc.minutes - d.grabOffset, SNAP_MIN),
            GRID_START_MIN,
            Math.max(GRID_START_MIN, GRID_END_MIN - d.duration)
          );
          target = { dayIdx: loc.dayIdx, allDay: false, start };
        }
        setDrag({ ...d, started, target });
      }
    };

    const onUp = () => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      const { days, onCreateSlot, onReschedule, onOpenTicket } = latest.current;

      if (d.kind === 'create') {
        let start: number;
        let end: number;
        if (d.moved) {
          start = Math.min(d.anchor, d.current);
          end = Math.max(d.anchor, d.current) + CREATE_SNAP_MIN;
        } else {
          start = Math.min(d.anchor, GRID_END_MIN - DEFAULT_BLOCK_MIN);
          end = start + DEFAULT_BLOCK_MIN;
        }
        onCreateSlot({ day: days[d.dayIdx], startTime: minutesToTime(start), endTime: minutesToTime(end) });
        return;
      }

      if (d.kind === 'resize') {
        if (d.end !== d.originalEnd) {
          onReschedule(d.ticket, d.ticket.scheduledFor!, {
            startTime: minutesToTime(d.start),
            endTime: minutesToTime(d.end),
          });
        }
        return;
      }

      if (!d.started) {
        onOpenTicket(d.ticket);
        return;
      }
      suppressClickUntil.current = Date.now() + 100;
      if (!d.target) return;
      const day = days[d.target.dayIdx];
      const t = d.ticket;
      if (d.target.allDay) {
        if (t.scheduledFor === day && !t.startTime) return;
        onReschedule(t, day, null);
      } else {
        const startTime = minutesToTime(d.target.start);
        if (t.scheduledFor === day && t.startTime === startTime) return;
        onReschedule(t, day, { startTime, endTime: minutesToTime(d.target.start + d.duration) });
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrag(null);
    };
    const onCancel = () => setDrag(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      document.body.style.userSelect = '';
    };
    // The handlers read the live drag through dragRef; re-binding on every
    // pointer move would be wasted work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const beginCreate = (dayIdx: number, e: React.PointerEvent) => {
    if (!canWrite || e.button !== 0) return;
    const anchor = clamp(
      snapDown(minutesAt(e.clientY), CREATE_SNAP_MIN),
      GRID_START_MIN,
      GRID_END_MIN - CREATE_SNAP_MIN
    );
    setDrag({ kind: 'create', dayIdx, anchor, current: anchor, moved: false });
  };

  /** Starts a (possible) move. Until the pointer travels, releasing it is a click. */
  const beginMove = useCallback(
    (ticket: TicketDTO, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const timed = !!ticket.startTime && !!ticket.endTime;
      const start = timed ? timeToMinutes(ticket.startTime!) : 0;
      const duration = timed ? timeToMinutes(ticket.endTime!) - start : DEFAULT_BLOCK_MIN;
      const grabOffset =
        timed && gridRef.current ? clamp(minutesAt(e.clientY) - start, 0, duration) : 0;
      setDrag({
        kind: 'move',
        ticket,
        duration,
        grabOffset,
        originX: e.clientX,
        originY: e.clientY,
        started: false,
        target: null,
      });
    },
    []
  );

  const beginResize = (ticket: TicketDTO, start: number, end: number, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setDrag({ kind: 'resize', ticket, start, end, originalEnd: end });
  };

  const editable = (t: TicketDTO) => canWrite && canEdit(t.status);

  // ---------- Rendering ----------

  const movingId = drag?.kind === 'move' && drag.started ? drag.ticket.id : null;
  const resizing = drag?.kind === 'resize' ? drag : null;

  // The slot being dragged out, or the one the create form is open on.
  let selection: { dayIdx: number; start: number; end: number } | null = null;
  if (drag?.kind === 'create') {
    selection = {
      dayIdx: drag.dayIdx,
      start: Math.min(drag.anchor, drag.current),
      end: Math.max(drag.anchor, drag.current) + CREATE_SNAP_MIN,
    };
  } else if (pendingSlot?.startTime && pendingSlot.endTime) {
    const dayIdx = days.indexOf(pendingSlot.day);
    if (dayIdx !== -1) {
      selection = {
        dayIdx,
        start: timeToMinutes(pendingSlot.startTime),
        end: timeToMinutes(pendingSlot.endTime),
      };
    }
  }

  const ticketLabel = (t: TicketDTO) => `#${t.code} ${t.title}`;
  const stateClasses = (t: TicketDTO) =>
    t.status === 'CANCELLED' ? 'opacity-50 line-through' : t.status === 'RESOLVED' ? 'opacity-50' : '';

  const todayIdx = days.indexOf(today);
  const showNow = todayIdx !== -1 && nowMinutes >= GRID_START_MIN && nowMinutes <= GRID_END_MIN;
  const colsTemplate = 'grid grid-cols-[3.5rem_minmax(0,1fr)]';

  return (
    <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Day headers */}
          <div className={`${colsTemplate} border-b border-gray-200 dark:border-gray-700`}>
            <div />
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const { weekday, date } = formatDayHeader(day);
                const isToday = day === today;
                return (
                  <div key={day} className="py-2 text-center border-l border-gray-200 dark:border-gray-700">
                    <div
                      className={`text-xs uppercase ${
                        isToday ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {weekday}
                    </div>
                    <div
                      className={`mx-auto mt-0.5 w-8 h-8 flex items-center justify-center rounded-full text-lg ${
                        isToday
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All-day row: tickets scheduled for the day with no time block */}
          <div className={`${colsTemplate} border-b border-gray-200 dark:border-gray-700`}>
            <div className="px-1 py-1 text-[10px] leading-tight text-right text-gray-500 dark:text-gray-400 self-center">
              Todo el día
            </div>
            <div ref={allDayRef} className="grid grid-cols-7">
              {days.map((day, dayIdx) => {
                const isTarget =
                  drag?.kind === 'move' && drag.started && drag.target?.allDay && drag.target.dayIdx === dayIdx;
                return (
                  <div
                    key={day}
                    onClick={() => {
                      if (!canWrite || Date.now() < suppressClickUntil.current) return;
                      onCreateSlot({ day, startTime: null, endTime: null });
                    }}
                    className={`min-h-10 p-1 space-y-1 border-l border-gray-200 dark:border-gray-700 ${
                      canWrite ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40' : ''
                    } ${isTarget ? 'bg-blue-50 dark:bg-blue-900/30' : ''} ${
                      pendingSlot && !pendingSlot.startTime && pendingSlot.day === day
                        ? 'ring-2 ring-inset ring-blue-500'
                        : ''
                    }`}
                  >
                    {allDayByDay[dayIdx].map((t) => (
                      <div
                        key={t.id}
                        title={ticketLabel(t)}
                        onPointerDown={editable(t) ? (e) => beginMove(t, e) : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!editable(t)) onOpenTicket(t);
                        }}
                        className={`truncate rounded border-l-4 px-1.5 py-0.5 text-xs cursor-pointer select-none touch-none ${
                          colorFor(t).block
                        } ${stateClasses(t)} ${movingId === t.id ? 'opacity-40' : ''}`}
                      >
                        {ticketLabel(t)}
                      </div>
                    ))}
                    {isTarget && drag?.kind === 'move' && (
                      <div className="truncate rounded border-2 border-dashed border-blue-500 px-1.5 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                        {ticketLabel(drag.ticket)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time grid */}
          <div className={colsTemplate}>
            {/* Hour gutter */}
            <div className="relative" style={{ height: GRID_HEIGHT_PX }}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <div
                  key={i}
                  className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-500 dark:text-gray-400"
                  style={{ top: i * HOUR_PX }}
                >
                  {i === 0 ? '' : `${String(START_HOUR + i).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            <div ref={gridRef} className="relative grid grid-cols-7" style={{ height: GRID_HEIGHT_PX }}>
              {/* Hour and half-hour lines */}
              {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                <React.Fragment key={i}>
                  <div
                    className="absolute inset-x-0 border-t border-gray-200 dark:border-gray-700 pointer-events-none"
                    style={{ top: i * HOUR_PX }}
                  />
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-gray-100 dark:border-gray-700/50 pointer-events-none"
                    style={{ top: i * HOUR_PX + HOUR_PX / 2 }}
                  />
                </React.Fragment>
              ))}

              {days.map((day, dayIdx) => (
                <div
                  key={day}
                  onPointerDown={(e) => beginCreate(dayIdx, e)}
                  className={`relative border-l border-gray-200 dark:border-gray-700 ${
                    canWrite ? 'cursor-cell' : ''
                  } ${dayIdx === todayIdx ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                >
                  {timedByDay[dayIdx].map(({ ticket: t, start, end, col, cols }) => {
                    const isResizing = resizing?.ticket.id === t.id;
                    const shownEnd = isResizing ? resizing.end : end;
                    const top = minutesToPx(clamp(start, GRID_START_MIN, GRID_END_MIN - SNAP_MIN));
                    const height = Math.max(
                      minutesToPx(clamp(shownEnd, GRID_START_MIN + SNAP_MIN, GRID_END_MIN)) - top,
                      18
                    );
                    const compact = height < 36;
                    const canChange = editable(t);
                    return (
                      <div
                        key={t.id}
                        title={`${t.startTime}–${isResizing ? minutesToTime(shownEnd) : t.endTime} ${ticketLabel(t)}`}
                        onPointerDown={canChange ? (e) => beginMove(t, e) : (e) => e.stopPropagation()}
                        onClick={canChange ? undefined : () => onOpenTicket(t)}
                        className={`absolute rounded-md border-l-4 px-1.5 py-0.5 text-xs overflow-hidden cursor-pointer select-none touch-none shadow-sm ${
                          colorFor(t).block
                        } ${stateClasses(t)} ${movingId === t.id ? 'opacity-40' : ''} ${
                          isResizing ? 'z-20 ring-2 ring-blue-500' : 'z-10'
                        }`}
                        style={{
                          top,
                          height,
                          left: `calc(${(col / cols) * 100}% + 1px)`,
                          width: `calc(${100 / cols}% - 3px)`,
                        }}
                      >
                        {compact ? (
                          <div className="truncate">
                            <span className="font-semibold">{t.startTime}</span> {ticketLabel(t)}
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold truncate">{t.title}</div>
                            <div className="truncate opacity-80">
                              {t.startTime}–{isResizing ? minutesToTime(shownEnd) : t.endTime} · #{t.code}
                            </div>
                          </>
                        )}
                        {canChange && (
                          <div
                            onPointerDown={(e) => beginResize(t, start, end, e)}
                            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Move preview */}
                  {drag?.kind === 'move' &&
                    drag.started &&
                    drag.target &&
                    !drag.target.allDay &&
                    drag.target.dayIdx === dayIdx && (
                      <div
                        className={`absolute inset-x-0.5 z-30 rounded-md border-2 border-dashed border-blue-500 px-1.5 py-0.5 text-xs pointer-events-none ${
                          colorFor(drag.ticket).block
                        }`}
                        style={{
                          top: minutesToPx(drag.target.start),
                          height: Math.max((drag.duration / 60) * HOUR_PX, 18),
                        }}
                      >
                        <div className="truncate font-semibold">
                          {minutesToTime(drag.target.start)}–{minutesToTime(drag.target.start + drag.duration)}
                        </div>
                        <div className="truncate">{ticketLabel(drag.ticket)}</div>
                      </div>
                    )}

                  {/* New-ticket selection */}
                  {selection?.dayIdx === dayIdx && (
                    <div
                      className="absolute inset-x-0.5 z-30 rounded-md bg-blue-600/80 text-white px-1.5 py-0.5 text-xs pointer-events-none shadow"
                      style={{
                        top: minutesToPx(selection.start),
                        height: minutesToPx(selection.end) - minutesToPx(selection.start),
                      }}
                    >
                      {minutesToTime(selection.start)}–{minutesToTime(selection.end)}
                    </div>
                  )}

                  {/* Current time */}
                  {showNow && dayIdx === todayIdx && (
                    <div
                      className="absolute inset-x-0 z-20 border-t-2 border-red-500 pointer-events-none"
                      style={{ top: minutesToPx(nowMinutes) }}
                    >
                      <div className="absolute -left-1.5 -top-[5px] w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {renderSidePanel?.(beginMove)}
    </div>
  );
}
