'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import { TicketDTO } from '@/types/ticket.types';
import { TechnicianDTO } from '@/types/technician.types';
import {
  canAssign,
  canCancel,
  canEdit,
  canResolve,
  canStart,
  isTerminal,
  terminalNotice,
  timeBlockError,
} from '@/constants/ticket.constants';
import { Button, Input, Modal, Textarea, Combobox } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';

type PendingAction = 'assign' | 'schedule' | 'start' | 'resolve' | 'cancel';

interface TicketActionsProps {
  ticket: TicketDTO;
  /** Assignment candidates. Inactive technicians are filtered out here. */
  technicians: TechnicianDTO[];
  canWrite: boolean;
  /**
   * Called after a successful action. The host refetches rather than merging
   * the response: these endpoints return the flat `TicketDTO`, while both
   * callers render the enriched one, so merging would leave the technician
   * block showing the previous name right after an assignment.
   */
  onUpdated: () => void | Promise<void>;
  size?: 'sm' | 'md';
}

/**
 * The ticket state machine, as buttons.
 *
 * Every button is rendered from a predicate in `ticket.constants`, so an action
 * the backend would refuse is never on screen — the 409s stay unreachable by
 * clicking. Buttons disappear rather than grey out, matching the bill detail
 * page; the exception is a terminal ticket, where five disabled buttons would
 * be noise and one sentence is the honest answer.
 */
export function TicketActions({
  ticket,
  technicians,
  canWrite,
  onUpdated,
  size = 'sm',
}: TicketActionsProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [technicianId, setTechnicianId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const { showError } = useToast();

  const notice = terminalNotice(ticket.status);
  if (notice) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{notice}</p>;
  }

  if (!canWrite) return null;

  const openAction = (action: PendingAction) => {
    setActionError(null);
    setFieldError(null);
    if (action === 'assign') {
      setTechnicianId(ticket.technicianId ?? '');
      setScheduledFor(ticket.scheduledFor ?? '');
    }
    if (action === 'schedule') {
      setScheduledFor(ticket.scheduledFor ?? '');
      setStartTime(ticket.startTime ?? '');
      setEndTime(ticket.endTime ?? '');
    }
    if (action === 'resolve') setResolutionNotes('');
    if (action === 'cancel') setCancelReason('');
    setPending(action);
  };

  const closeAction = () => {
    if (isActing) return;
    setPending(null);
    setActionError(null);
    setFieldError(null);
  };

  /** Runs an action, then hands control back to the host to refetch. */
  const run = async (call: () => Promise<{ success: boolean; error?: string; errorField?: string }>) => {
    setIsActing(true);
    setActionError(null);
    setFieldError(null);
    const result = await call();
    setIsActing(false);
    if (result.success) {
      setPending(null);
      await onUpdated();
    } else {
      const message = result.error || 'No se pudo completar la acción';
      if (result.errorField) setFieldError(message);
      setActionError(message);
      showError(message);
    }
  };

  /** A guard the operator has to fix before the call is worth making. */
  const rejectField = (message: string) => {
    setFieldError(message);
    showError(message);
  };

  const submitAssign = () => {
    if (!technicianId) {
      rejectField('Elige un técnico');
      return;
    }
    // Sending a day replaces the whole schedule (TKT-081), so an unchanged day
    // is left out — resending it would silently drop the ticket's time block.
    const dayChanged = !!scheduledFor && scheduledFor !== ticket.scheduledFor;
    return run(() =>
      apiService.assignTicket(ticket.id, {
        technicianId,
        ...(dayChanged ? { scheduledFor } : {}),
      })
    );
  };

  const submitSchedule = () => {
    if (!scheduledFor) {
      rejectField('Elige una fecha, o usa «Quitar fecha»');
      return;
    }
    const blockError = timeBlockError(scheduledFor, startTime, endTime);
    if (blockError) {
      rejectField(blockError);
      return;
    }
    // The value of an <input type="date"> is already 'YYYY-MM-DD', and of an
    // <input type="time"> 'HH:mm'. Passing either through a Date would turn
    // wall-clock values into an instant and shift them.
    return run(() =>
      apiService.scheduleTicket(ticket.id, scheduledFor, startTime ? { startTime, endTime } : null)
    );
  };

  const submitResolve = () => {
    if (!resolutionNotes.trim()) {
      rejectField('Las notas de resolución son obligatorias');
      return;
    }
    return run(() => apiService.resolveTicket(ticket.id, resolutionNotes.trim()));
  };

  const submitCancel = () => {
    if (!cancelReason.trim()) {
      rejectField('Indica el motivo de la cancelación');
      return;
    }
    return run(() => apiService.cancelTicket(ticket.id, cancelReason.trim()));
  };

  // Only active technicians can hold work; offering an inactive one would set up
  // a request the backend refuses.
  const technicianOptions = technicians
    .filter((t) => t.isActive)
    .map((t) => ({ value: t.id, label: `${t.fullName} — ${t.phone}` }));

  const assignedToInactive =
    ticket.technicianId && !technicians.some((t) => t.id === ticket.technicianId && t.isActive);

  return (
    <div className="space-y-2">
      {actionError && !pending && (
        <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {canStart(ticket.status) && (
          <Button size={size} onClick={() => openAction('start')}>
            Iniciar trabajo
          </Button>
        )}
        {canResolve(ticket.status) && (
          <Button
            size={size}
            variant={ticket.status === 'IN_PROGRESS' ? 'primary' : 'outline'}
            onClick={() => openAction('resolve')}
          >
            Resolver
          </Button>
        )}
        {canAssign(ticket.status) && (
          <Button
            size={size}
            variant={ticket.technicianId ? 'outline' : 'primary'}
            onClick={() => openAction('assign')}
          >
            {ticket.technicianId ? 'Reasignar' : 'Asignar'}
          </Button>
        )}
        {canEdit(ticket.status) && (
          <Button size={size} variant="outline" onClick={() => openAction('schedule')}>
            {ticket.scheduledFor ? 'Reprogramar' : 'Programar'}
          </Button>
        )}
        {canCancel(ticket.status) && (
          <Button size={size} variant="danger" onClick={() => openAction('cancel')}>
            Cancelar ticket
          </Button>
        )}
      </div>

      {/* Assign / reassign */}
      <Modal
        isOpen={pending === 'assign'}
        onClose={closeAction}
        title={ticket.technicianId ? 'Reasignar ticket' : 'Asignar ticket'}
        info="Asignar mueve el ticket a «Asignado». Se puede reasignar hasta que el trabajo empiece."
      >
        <div className="space-y-4">
          {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
          {assignedToInactive && (
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              El técnico asignado actualmente está inactivo y no aparece en la lista.
            </p>
          )}
          <Combobox
            label="Técnico"
            options={technicianOptions}
            value={technicianId}
            onChange={setTechnicianId}
            error={fieldError ?? undefined}
            placeholder="Buscar técnico..."
            required
            fullWidth
          />
          <Input
            label="Fecha de la visita (opcional)"
            type="date"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            fullWidth
          />
          {ticket.startTime && (
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Cambiar la fecha aquí quita la franja horaria; usa «Reprogramar» para conservarla.
            </p>
          )}
        </div>
        <Modal.Footer>
          <Button variant="outline" onClick={closeAction} disabled={isActing}>
            Cancelar
          </Button>
          <Button onClick={submitAssign} isLoading={isActing}>
            {ticket.technicianId ? 'Reasignar' : 'Asignar'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Schedule */}
      <Modal
        isOpen={pending === 'schedule'}
        onClose={closeAction}
        title={ticket.scheduledFor ? 'Reprogramar visita' : 'Programar visita'}
        info="Sin horas, la visita queda para cualquier momento del día. Se acepta una fecha pasada: sirve para registrar trabajo hecho fuera del sistema."
      >
        <div className="space-y-4">
          {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
          <Input
            label="Fecha de la visita"
            type="date"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            error={fieldError ?? undefined}
            fullWidth
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Desde (opcional)"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              fullWidth
            />
            <Input
              label="Hasta (opcional)"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              fullWidth
            />
          </div>
        </div>
        <Modal.Footer>
          {ticket.scheduledFor && (
            <Button
              variant="outline"
              onClick={() => run(() => apiService.scheduleTicket(ticket.id, null))}
              disabled={isActing}
            >
              Quitar fecha
            </Button>
          )}
          <Button variant="outline" onClick={closeAction} disabled={isActing}>
            Cancelar
          </Button>
          <Button onClick={submitSchedule} isLoading={isActing}>
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Start */}
      <Modal isOpen={pending === 'start'} onClose={closeAction} title="Iniciar trabajo">
        <div className="space-y-4">
          {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
          <p className="text-gray-700 dark:text-gray-300">
            ¿Marcar este ticket como en progreso? Se registra la hora de inicio y ya no podrá
            reasignarse a otro técnico.
          </p>
        </div>
        <Modal.Footer>
          <Button variant="outline" onClick={closeAction} disabled={isActing}>
            Cancelar
          </Button>
          <Button onClick={() => run(() => apiService.startTicket(ticket.id))} isLoading={isActing}>
            Iniciar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Resolve */}
      <Modal isOpen={pending === 'resolve'} onClose={closeAction} title="Resolver ticket">
        <div className="space-y-4">
          {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
          <Textarea
            label="Notas de resolución"
            name="resolutionNotes"
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            error={fieldError ?? undefined}
            rows={5}
            maxLength={5000}
            required
            info="Son el único registro de lo que se hizo. Al resolver, el ticket sale de la jornada del técnico de inmediato."
            fullWidth
          />
        </div>
        <Modal.Footer>
          <Button variant="outline" onClick={closeAction} disabled={isActing}>
            Cancelar
          </Button>
          <Button onClick={submitResolve} isLoading={isActing}>
            Resolver
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel */}
      <Modal isOpen={pending === 'cancel'} onClose={closeAction} title="Cancelar ticket">
        <div className="space-y-4">
          {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
          <Input
            label="Motivo"
            name="reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            error={fieldError ?? undefined}
            maxLength={255}
            required
            info="Cancelar conserva el ticket y el motivo. Sin un motivo, un ticket cancelado no se distingue de uno abandonado por error y la misma falla se reporta otra vez."
            fullWidth
          />
        </div>
        <Modal.Footer>
          <Button variant="outline" onClick={closeAction} disabled={isActing}>
            Volver
          </Button>
          <Button variant="danger" onClick={submitCancel} isLoading={isActing}>
            Cancelar ticket
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

/** Whether the action bar would render anything at all, for hosts that lay out around it. */
export const hasTicketActions = (status: TicketDTO['status']): boolean => !isTerminal(status);
