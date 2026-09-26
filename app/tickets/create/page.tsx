'use client';

import React, { useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CreateTicketDTO, TicketCategory, TicketPriority } from '@/types/ticket.types';
import { fetchAllCustomers, fetchAllDevices, fetchAllTechnicians } from '@/hooks/useCatalogs';
import {
  TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_CREATE_OPTIONS,
  timeBlockError,
} from '@/constants/ticket.constants';
import {
  AddressForm,
  TicketAddressFields,
  addressPayload,
  emptyAddressForm,
  useAddressGeocoding,
  validateAddress,
} from '@/components/tickets/TicketAddressFields';
import {
  ContactForm,
  TicketContactFields,
  contactPayload,
  validateContact,
} from '@/components/tickets/TicketContactFields';
import { Card, Button, Input, Select, Textarea, Combobox, LoadingSpinner, BackLink } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { useGoBack } from '@/hooks/useGoBack';

function CreateTicketPageContent() {
  const router = useRouter();
  const goBack = useGoBack('/tickets');
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { showError, showFormErrors } = useToast();

  // Prefilled from the query string so the customer, device and alert pages —
  // and the calendar's quick-create — can deep-link into a half-written ticket.
  const [formData, setFormData] = useState({
    title: searchParams.get('title') ?? '',
    description: searchParams.get('description') ?? '',
    // Most tasks fit «Otro»; the operator changes it when it matters.
    category: searchParams.get('category') ?? 'OTHER',
    priority: searchParams.get('priority') ?? '',
    customerId: searchParams.get('customerId') ?? '',
    deviceId: searchParams.get('deviceId') ?? '',
    technicianId: searchParams.get('technicianId') ?? '',
    scheduledFor: searchParams.get('scheduledFor') ?? '',
    startTime: searchParams.get('startTime') ?? '',
    endTime: searchParams.get('endTime') ?? '',
  });
  const [address, setAddress] = useState<AddressForm>(emptyAddressForm());
  const [contact, setContact] = useState<ContactForm>({
    contactName: searchParams.get('contactName') ?? '',
    contactPhone: searchParams.get('contactPhone') ?? '',
  });
  const { isGeocoding: isAddressGeocoding, onLocationPick } = useAddressGeocoding(setAddress);

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: fetchAllCustomers });
  const { data: devices = [] } = useQuery({ queryKey: ['devicesCatalog'], queryFn: fetchAllDevices });
  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: fetchAllTechnicians,
  });

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: `${c.fullName} — ${c.phone}` })),
    [customers]
  );
  const deviceOptions = useMemo(
    () =>
      devices.map((d) => ({
        value: d.id,
        label: d.ipAddress ? `${d.name} — ${d.ipAddress}` : d.name,
      })),
    [devices]
  );
  const technicianOptions = useMemo(
    () =>
      technicians
        .filter((t) => t.isActive)
        .map((t) => ({ value: t.id, label: `${t.fullName} — ${t.phone}` })),
    [technicians]
  );

  const clearError = (field: string) =>
    setFormErrors((p) => {
      const n = { ...p };
      delete n[field];
      return n;
    });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) clearError(name);
  };

  const setField = (name: string, value: string) => {
    setFormData((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) clearError(name);
  };

  const handleAddressChange = (field: keyof AddressForm, value: string) => {
    setAddress((p) => ({ ...p, [field]: value }));
    if (formErrors[field]) clearError(field);
  };

  const handleContactChange = (field: keyof ContactForm, value: string) => {
    setContact((p) => ({ ...p, [field]: value }));
    clearError('contactName');
    clearError('contactPhone');
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'El asunto es requerido';
    else if (formData.title.trim().length > 150)
      errors.title = 'El asunto no puede superar los 150 caracteres';

    if (formData.description.trim().length > 5000)
      errors.description = 'La descripción no puede superar los 5000 caracteres';

    if (!formData.category) errors.category = 'La categoría es requerida';

    const blockError = timeBlockError(formData.scheduledFor, formData.startTime, formData.endTime);
    if (blockError) errors.startTime = blockError;

    Object.assign(errors, validateAddress(address));
    Object.assign(errors, validateContact(contact));

    setFormErrors(errors);
    return !showFormErrors(errors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    const dto: CreateTicketDTO = {
      title: formData.title.trim(),
      // The backend requires a description; a task that only has a title
      // repeats it rather than making the operator type it twice.
      description: formData.description.trim() || formData.title.trim(),
      category: formData.category as TicketCategory,
      ...(formData.priority ? { priority: formData.priority as TicketPriority } : {}),
      ...(formData.customerId ? { customerId: formData.customerId } : {}),
      ...(formData.deviceId ? { deviceId: formData.deviceId } : {}),
      ...(formData.technicianId ? { technicianId: formData.technicianId } : {}),
      // Straight from <input type="date">, which already yields 'YYYY-MM-DD'.
      ...(formData.scheduledFor ? { scheduledFor: formData.scheduledFor } : {}),
      // 'HH:mm' straight from <input type="time">; validate() made sure the
      // pair is whole and has a day.
      ...(formData.scheduledFor && formData.startTime
        ? { startTime: formData.startTime, endTime: formData.endTime }
        : {}),
    };
    const addressDto = addressPayload(address);
    if (addressDto) dto.address = addressDto;
    const contactDto = contactPayload(contact);
    if (contactDto) dto.contact = contactDto;

    const result = await apiService.createTicket(dto);
    if (result.success && result.data) {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      router.replace(`/tickets/${result.data.id}`);
    } else {
      const message = result.error || 'Error al crear el ticket';
      if (result.errorField) setFormErrors((prev) => ({ ...prev, [result.errorField!]: message }));
      showError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <BackLink label="Tickets" onClick={() => goBack()} className="mb-2" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Nuevo Ticket</h1>
        <p className="text-gray-600 dark:text-gray-400">Registra una orden de trabajo en campo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">El trabajo</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Asunto"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  error={formErrors.title}
                  maxLength={150}
                  placeholder="Sin servicio en el sector"
                  required
                  fullWidth
                />
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Descripción"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  error={formErrors.description}
                  rows={5}
                  maxLength={5000}
                  helperText="Si la dejas vacía se usa el asunto."
                  fullWidth
                />
              </div>
              <Select
                label="Categoría"
                name="category"
                value={formData.category}
                onChange={handleChange}
                error={formErrors.category}
                options={TICKET_CATEGORY_OPTIONS}
                required
                fullWidth
              />
              <Select
                label="Prioridad"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                options={TICKET_PRIORITY_CREATE_OPTIONS}
                fullWidth
              />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              A quién afecta{' '}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(opcional)</span>
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Combobox
                label="Cliente"
                options={customerOptions}
                value={formData.customerId}
                onChange={(v) => setField('customerId', v)}
                error={formErrors.customerId}
                placeholder="Buscar cliente..."
                fullWidth
              />
              <Combobox
                label="Dispositivo"
                options={deviceOptions}
                value={formData.deviceId}
                onChange={(v) => setField('deviceId', v)}
                error={formErrors.deviceId}
                placeholder="Buscar dispositivo..."
                fullWidth
              />
            </div>
            <div className="mt-4">
              <TicketContactFields form={contact} errors={formErrors} onChange={handleContactChange} />
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Todo es opcional: una diligencia interna no nombra a nadie. Para un prospecto que aún
              no es cliente, usa el contacto en sitio; cuando se afilie, vincula el cliente y el
              contacto se conserva como registro de a quién se visitó.
            </p>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              La visita <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(opcional)</span>
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Combobox
                label="Técnico"
                options={technicianOptions}
                value={formData.technicianId}
                onChange={(v) => setField('technicianId', v)}
                placeholder="Buscar técnico..."
                fullWidth
              />
              <Input
                label="Fecha programada"
                name="scheduledFor"
                type="date"
                value={formData.scheduledFor}
                onChange={handleChange}
                error={formErrors.scheduledFor}
                fullWidth
              />
              <Input
                label="Desde"
                name="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => {
                  handleChange(e);
                  clearError('startTime');
                }}
                error={formErrors.startTime}
                fullWidth
              />
              <Input
                label="Hasta"
                name="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => {
                  handleChange(e);
                  clearError('startTime');
                }}
                fullWidth
              />
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Asignar un técnico ahora deja el ticket en «Asignado». Solo se ofrecen los técnicos
              activos. Sin horas, la visita queda para cualquier momento del día.
            </p>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Dirección de la visita{' '}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(opcional)</span>
            </h2>
          </Card.Header>
          <Card.Body>
            <TicketAddressFields
              form={address}
              errors={formErrors}
              onChange={handleAddressChange}
              onLocationPick={onLocationPick}
              isGeocoding={isAddressGeocoding}
            />
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => goBack()} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Crear Ticket
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function CreateTicketPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      }
    >
      <CreateTicketPageContent />
    </Suspense>
  );
}
