'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/contexts/toast.context';
import { AlertListItemDTO } from '@/types/alert.types';
import { Button } from '@/components/ui';

interface Props {
  alert: Pick<AlertListItemDTO, 'id' | 'ticket' | 'ticketSuggested'>;
  /**
   * A closed ticket the alert once opened. The list only carries a live one,
   * so a caller that already holds the device's tickets can still link it.
   */
  fallbackTicket?: { id: string; code: number } | null;
  /** Re-fetch the alerts: the new ticket, or the one a 409 names, shows on the next read. */
  onChanged: () => void;
}

/**
 * The alert's own ticket as a link, or — when the install only suggests
 * tickets (NOT-205/206) — the button that opens one. Rows are often links
 * themselves, so both stop the click from reaching them.
 */
export function AlertTicketAction({ alert, fallbackTicket, onChanged }: Props) {
  const { canWrite } = usePermissions();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const ticket = alert.ticket ?? fallbackTicket;
  if (ticket) {
    return (
      <Link
        href={`/tickets/${ticket.id}`}
        onClick={(e) => e.stopPropagation()}
        className="whitespace-nowrap text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
      >
        Ticket #{ticket.code}
      </Link>
    );
  }

  if (!alert.ticketSuggested || !canWrite) return null;

  const create = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCreating(true);
    const r = await apiService.createTicketFromAlert(alert.id);
    setCreating(false);
    if (r.success && r.data) {
      showSuccess(`Ticket #${r.data.code} creado.`);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    } else {
      showError(r.error || 'No se pudo crear el ticket');
    }
    // A 409 means someone else got there first: the re-read links their ticket.
    onChanged();
  };

  return (
    <Button variant="outline" size="sm" onClick={create} isLoading={creating} className="whitespace-nowrap">
      Crear ticket
    </Button>
  );
}
