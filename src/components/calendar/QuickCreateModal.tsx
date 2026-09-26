'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CreateTicketDTO, TicketCategory, TicketPriority } from '@/types/ticket.types';
import { TechnicianDTO } from '@/types/technician.types';
import { fetchAllCustomers, fetchAllDevices } from '@/hooks/useCatalogs';
import {
  TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  formatCalendarDayLong,
  timeBlockError,
} from '@/constants/ticket.constants';
import { Button, Combobox, Input, Modal, Select, Textarea } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import {
  TicketContactFields,
  contactPayload,
  validateContact,
} from '@/components/tickets/TicketContactFields';

/** What the operator clicked or dragged out on the calendar. */
export interface CalendarSlot {
  day: string;
  /** Both null for a click in the all-day row. */
  startTime: string | null;
  endTime: string | null;
}

interface QuickCreateModalProps {
  slot: CalendarSlot | null;
  technicians: TechnicianDTO[];
  defaultTechnicianId: string;
  onClose: () => void;
  /** Gets the technician picked, so the page can offer it again next time. */
  onCreated: (technicianId: string) => void;
}

const emptyForm = (slot: CalendarSlot | null, technicianId: string) => ({
  title: '',
  description: '',
  // Required by the backend, so a title-only task goes in as «Otro».
  category: 'OTHER',
  priority: 'NORMAL',
  customerId: '',
  deviceId: '',
  technicianId,
  scheduledFor: slot?.day ?? '',
  startTime: slot?.startTime ?? '',
  endTime: slot?.endTime ?? '',
  contactName: '',
  contactPhone: '',
});

/**
 * The calendar's Google-style quick create: a title is enough. Who and when
 * are in view; the rest waits behind «Más detalles», and the visit address
 * behind «Más opciones», which carries what was typed to the full form.
 */
export function QuickCreateModal({
  slot,
  technicians,
  defaultTechnicianId,
  onClose,
  onCreated,
}: QuickCreateModalProps) {
  const isOpen = slot !== null;
  const [form, setForm] = useState(() => emptyForm(slot, defaultTechnicianId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { showError, showFormErrors, showSuccess } = useToast();

  // Every newly selected slot starts a fresh ticket.
  useEffect(() => {
    if (slot) {
      setForm(emptyForm(slot, defaultTechnicianId));
      setErrors({});
      setShowDetails(false);
    }
    // The technician default is read at the moment the slot opens, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  // Loaded only once someone actually asks for the details.
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchAllCustomers,
    enabled: isOpen && showDetails,
  });
  const { data: devices = [] } = useQuery({
    queryKey: ['devicesCatalog'],
    queryFn: fetchAllDevices,
    enabled: isOpen && showDetails,
  });

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: `${c.fullName} — ${c.phone}` })),
    [customers]
  );
  const deviceOptions = useMemo(
    () =>
      devices.map((d) => ({ value: d.id, label: d.ipAddress ? `${d.name} — ${d.ipAddress}` : d.name })),
    [devices]
  );
  const technicianOptions = useMemo(
    () => technicians.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.fullName })),
    [technicians]
  );

  const setField = (name: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => {
      const n = { ...p };
      delete n[name];
      if (name === 'contactName' || name === 'contactPhone') {
        delete n.contactName;
        delete n.contactPhone;
      }
      if (name === 'startTime' || name === 'endTime' || name === 'scheduledFor') delete n.startTime;
      return n;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'El asunto es requerido';
    if (!form.scheduledFor) e.scheduledFor = 'La fecha es requerida';
    const blockError = timeBlockError(form.scheduledFor, form.startTime, form.endTime);
    if (blockError) e.startTime = blockError;
    Object.assign(e, validateContact(form));
    // A problem in a collapsed field would otherwise be invisible.
    if (e.contactName || e.contactPhone) setShowDetails(true);
    setErrors(e);
    return !showFormErrors(e);
  };

  const submit = async () => {
    if (isSubmitting || !validate()) return;
    setIsSubmitting(true);
    const contact = contactPayload(form);
    const dto: CreateTicketDTO = {
      title: form.title.trim(),
      // The backend requires a description; a title-only task repeats it.
      description: form.description.trim() || form.title.trim(),
      category: (form.category || 'OTHER') as TicketCategory,
      priority: form.priority as TicketPriority,
      ...(form.customerId ? { customerId: form.customerId } : {}),
      ...(form.deviceId ? { deviceId: form.deviceId } : {}),
      // Passing the technician assigns on creation — one call, not create + assign.
      ...(form.technicianId ? { technicianId: form.technicianId } : {}),
      scheduledFor: form.scheduledFor,
      ...(form.startTime ? { startTime: form.startTime, endTime: form.endTime } : {}),
      ...(contact ? { contact } : {}),
    };
    const result = await apiService.createTicket(dto);
    setIsSubmitting(false);
    if (result.success && result.data) {
      showSuccess(`Ticket #${result.data.code} creado`);
      onCreated(form.technicianId);
    } else {
      const message = result.error || 'Error al crear el ticket';
      if (result.errorField) {
        setErrors((p) => ({ ...p, [result.errorField!]: message }));
        setShowDetails(true);
      }
      showError(message);
    }
  };

  // Hand everything typed so far to the full form, which also takes the address.
  const moreOptionsHref = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(form).forEach(([k, v]) => {
      if (v && v.trim()) params.set(k, v.trim());
    });
    return `/tickets/create?${params.toString()}`;
  }, [form]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="Nueva tarea"
      transparentBackdrop
      onSubmit={submit}
    >
      <div className="space-y-4">
        <Input
          label="Asunto"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          error={errors.title}
          maxLength={150}
          placeholder="Sin servicio en el sector"
          required
          autoFocus
          fullWidth
        />

        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Fecha"
              type="date"
              value={form.scheduledFor}
              onChange={(e) => setField('scheduledFor', e.target.value)}
              error={errors.scheduledFor}
              fullWidth
            />
            <Input
              label="Desde"
              type="time"
              value={form.startTime}
              onChange={(e) => setField('startTime', e.target.value)}
              error={errors.startTime}
              fullWidth
            />
            <Input
              label="Hasta"
              type="time"
              value={form.endTime}
              onChange={(e) => setField('endTime', e.target.value)}
              fullWidth
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 first-letter:uppercase">
            {form.scheduledFor && formatCalendarDayLong(form.scheduledFor)}
            {form.scheduledFor && !form.startTime && !form.endTime && ' · cualquier hora del día'}
          </p>
        </div>

        <Combobox
          label="Técnico"
          options={technicianOptions}
          value={form.technicianId}
          onChange={(v) => setField('technicianId', v)}
          placeholder="Sin asignar"
          fullWidth
        />

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Más detalles
        </button>

        {showDetails && (
          <div className="space-y-4">
            <Textarea
              label="Descripción"
              name="description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              error={errors.description}
              rows={3}
              maxLength={5000}
              helperText="Si la dejas vacía se usa el asunto."
              fullWidth
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Categoría"
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                error={errors.category}
                options={TICKET_CATEGORY_OPTIONS.filter((o) => o.value)}
                fullWidth
              />
              <Select
                label="Prioridad"
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value)}
                options={TICKET_PRIORITY_OPTIONS}
                fullWidth
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Combobox
                label="Cliente"
                options={customerOptions}
                value={form.customerId}
                onChange={(v) => setField('customerId', v)}
                error={errors.customerId}
                placeholder="Buscar cliente..."
                fullWidth
              />
              <Combobox
                label="Dispositivo"
                options={deviceOptions}
                value={form.deviceId}
                onChange={(v) => setField('deviceId', v)}
                error={errors.deviceId}
                placeholder="Buscar dispositivo..."
                fullWidth
              />
            </div>

            <TicketContactFields form={form} errors={errors} onChange={setField} />
          </div>
        )}
      </div>
      <Modal.Footer className="justify-between">
        <Link
          href={moreOptionsHref}
          className="mr-auto text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          Más opciones
        </Link>
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button onClick={submit} isLoading={isSubmitting}>
          Guardar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
