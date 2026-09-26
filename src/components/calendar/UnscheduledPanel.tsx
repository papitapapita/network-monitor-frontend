'use client';

import React from 'react';
import type { TicketDTO } from '@/types/ticket.types';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_VARIANTS,
} from '@/constants/ticket.constants';
import { Badge, LoadingSpinner, SectionTitle } from '@/components/ui';
import type { TechnicianColor } from './calendarUtils';

interface UnscheduledPanelProps {
  tickets: TicketDTO[];
  isLoading: boolean;
  error: string | null;
  colorFor: (ticket: TicketDTO) => TechnicianColor;
  technicianName: (ticket: TicketDTO) => string;
  canWrite: boolean;
  beginDrag: (ticket: TicketDTO, e: React.PointerEvent) => void;
  onOpenTicket: (ticket: TicketDTO) => void;
  onHide: () => void;
}

/**
 * Open tickets with no visit day, to drag onto the week. Dropping one in the
 * all-day row gives it a day; dropping it on the grid, a one-hour block.
 */
export function UnscheduledPanel({
  tickets,
  isLoading,
  error,
  colorFor,
  technicianName,
  canWrite,
  beginDrag,
  onOpenTicket,
  onHide,
}: UnscheduledPanelProps) {
  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <SectionTitle
          className="text-sm font-semibold text-gray-900 dark:text-gray-100"
          info={
            canWrite
              ? 'Tickets abiertos sin fecha. Arrastra uno al calendario para programarlo.'
              : 'Tickets abiertos sin fecha.'
          }
        >
          Sin programar
        </SectionTitle>
        <button
          type="button"
          onClick={onHide}
          aria-label="Ocultar panel"
          title="Ocultar panel"
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <p className="p-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : tickets.length === 0 ? (
          <p className="p-2 text-sm text-gray-500 dark:text-gray-400">
            Todos los tickets abiertos tienen fecha.
          </p>
        ) : (
          tickets.map((t) => (
            <div
              key={t.id}
              onPointerDown={canWrite ? (e) => beginDrag(t, e) : undefined}
              onClick={canWrite ? undefined : () => onOpenTicket(t)}
              className={`rounded-md border border-gray-200 dark:border-gray-700 p-2 text-sm select-none touch-none hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                canWrite ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorFor(t).swatch}`} />
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">#{t.code}</span>
                <Badge variant={TICKET_PRIORITY_VARIANTS[t.priority]}>
                  {TICKET_PRIORITY_LABELS[t.priority]}
                </Badge>
              </div>
              <p className="mt-1 text-gray-900 dark:text-gray-100 line-clamp-2">{t.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{technicianName(t)}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
