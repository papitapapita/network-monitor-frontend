import React from 'react';
import { Badge } from '@/components/ui';
import type { DataTableColumn, PickableColumn } from '@/components/ui';
import { TicketDTO } from '@/types/ticket.types';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_RANK,
  TICKET_PRIORITY_VARIANTS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_RANK,
  TICKET_STATUS_VARIANTS,
  formatScheduledFor,
  isAlertOrigin,
  ticketCategoryLabel,
} from '@/constants/ticket.constants';

type TicketColumn = DataTableColumn<TicketDTO> & { label: string; locked?: boolean };

/**
 * The list endpoint returns flat tickets — no technician object — so the page
 * resolves the id against the technician catalog it already holds and passes
 * the lookup in.
 */
export function ticketColumnCatalog(
  technicianName: (id: string | null) => string | null
): TicketColumn[] {
  return [
    {
      key: 'code',
      label: 'Código',
      locked: true,
      header: 'Código',
      sortValue: (t) => t.code,
      cell: (t) => (
        <span className="font-mono font-medium text-gray-900 dark:text-gray-100">#{t.code}</span>
      ),
    },
    {
      key: 'title',
      label: 'Asunto',
      header: 'Asunto',
      sortValue: (t) => t.title.toLowerCase(),
      cell: (t) => (
        <div className="max-w-xs">
          <div className="font-medium text-gray-900 dark:text-gray-100">{t.title}</div>
          {isAlertOrigin(t.origin) && (
            <div className="text-xs text-gray-500 dark:text-gray-400">Abierto por una alerta</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      header: 'Estado',
      // Ranked, so the column orders by progress through the lifecycle rather
      // than alphabetically by its Spanish label.
      sortValue: (t) => TICKET_STATUS_RANK[t.status],
      cell: (t) => (
        <Badge variant={TICKET_STATUS_VARIANTS[t.status]}>{TICKET_STATUS_LABELS[t.status]}</Badge>
      ),
    },
    {
      key: 'priority',
      label: 'Prioridad',
      header: 'Prioridad',
      sortValue: (t) => TICKET_PRIORITY_RANK[t.priority],
      cell: (t) => (
        <Badge variant={TICKET_PRIORITY_VARIANTS[t.priority]}>
          {TICKET_PRIORITY_LABELS[t.priority]}
        </Badge>
      ),
    },
    {
      key: 'category',
      label: 'Categoría',
      header: 'Categoría',
      sortValue: (t) => ticketCategoryLabel(t.category),
      className: 'hidden lg:table-cell',
      cell: (t) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {ticketCategoryLabel(t.category)}
        </span>
      ),
    },
    {
      key: 'technician',
      label: 'Técnico',
      header: 'Técnico',
      sortValue: (t) => technicianName(t.technicianId),
      className: 'hidden md:table-cell',
      cell: (t) => {
        const name = technicianName(t.technicianId);
        return name ? (
          <span className="text-gray-700 dark:text-gray-300 text-sm">{name}</span>
        ) : (
          <span className="italic text-gray-400 dark:text-gray-500 text-sm">Sin asignar</span>
        );
      },
    },
    {
      key: 'scheduledFor',
      label: 'Programado',
      header: 'Programado',
      // The raw 'YYYY-MM-DD' sorts chronologically as a string, which is the
      // whole point of the format — no parsing needed.
      sortValue: (t) => t.scheduledFor,
      className: 'hidden sm:table-cell',
      cell: (t) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {formatScheduledFor(t.scheduledFor)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Creado',
      header: 'Creado',
      sortValue: (t) => t.createdAt,
      className: 'hidden xl:table-cell',
      cell: (t) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {new Date(t.createdAt).toLocaleDateString('es')}
        </span>
      ),
    },
  ];
}

export const TICKET_COLUMN_OPTIONS: PickableColumn[] = ticketColumnCatalog(() => null).map(
  ({ key, label, locked }) => ({ key, label, locked })
);
export const DEFAULT_TICKET_COLUMNS = ticketColumnCatalog(() => null).map((c) => c.key);

export function buildTicketColumns(
  technicianName: (id: string | null) => string | null,
  visibleKeys: string[]
): DataTableColumn<TicketDTO>[] {
  return ticketColumnCatalog(technicianName).filter(
    (c) => c.locked || visibleKeys.includes(c.key)
  );
}
