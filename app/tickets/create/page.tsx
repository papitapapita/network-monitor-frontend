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
} from '@/constants/ticket.constants';
import {
  AddressForm,
  TicketAddressFields,
  addressPayload,
  emptyAddressForm,
  validateAddress,
} from '@/components/tickets/TicketAddressFields';
import { Card, Button, Input, Select, Textarea, Combobox, LoadingSpinner } from '@/components/ui';

function CreateTicketPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Prefilled from the query string so the customer, device and alert pages can
  // deep-link into a half-written ticket.
  const [formData, setFormData] = useState({
    title: searchParams.get('title') ?? '',
    description: '',
    category: '',
    priority: '',
    customerId: searchParams.get('customerId') ?? '',
    deviceId: searchParams.get('deviceId') ?? '',
    technicianId: '',
    scheduledFor: '',
  });
  const [address, setAddress] = useState<AddressForm>(emptyAddressForm());

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
    // Naming either collaborator satisfies the "customer or device" rule, so
    // clear the complaint from both fields at once.
    if (name === 'customerId' || name === 'deviceId') {
      clearError('customerId');
      clearError('deviceId');
    }
  };

  const handleAddressChange = (field: keyof AddressForm, value: string) => {
    setAddress((p) => ({ ...p, [field]: value }));
    if (formErrors[field]) clearError(field);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'El asunto es requerido';
    else if (formData.title.trim().length > 150)
      errors.title = 'El asunto no puede superar los 150 caracteres';

    if (!formData.description.trim()) errors.description = 'La descripción es requerida';
    else if (formData.description.trim().length > 5000)
      errors.description = 'La descripción no puede superar los 5000 caracteres';

    if (!formData.category) errors.category = 'La categoría es requerida';

    // A ticket has to name something to work on. An internal tower job has no
    // customer; a phoned-in complaint may not name a device yet — but not both.
    if (!formData.customerId && !formData.deviceId) {
      const message = 'Indica al menos un cliente o un dispositivo';
      errors.customerId = message;
      errors.deviceId = message;
    }

    Object.assign(errors, validateAddress(address));

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setError(null);

    const dto: CreateTicketDTO = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category as TicketCategory,
      ...(formData.priority ? { priority: formData.priority as TicketPriority } : {}),
      ...(formData.customerId ? { customerId: formData.customerId } : {}),
      ...(formData.deviceId ? { deviceId: formData.deviceId } : {}),
      ...(formData.technicianId ? { technicianId: formData.technicianId } : {}),
      // Straight from <input type="date">, which already yields 'YYYY-MM-DD'.
      ...(formData.scheduledFor ? { scheduledFor: formData.scheduledFor } : {}),
    };
    const addressDto = addressPayload(address);
    if (addressDto) dto.address = addressDto;

    const result = await apiService.createTicket(dto);
    if (result.success && result.data) {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      router.replace(`/tickets/${result.data.id}`);
    } else {
      const message = result.error || 'Error al crear el ticket';
      if (result.errorField) setFormErrors((prev) => ({ ...prev, [result.errorField!]: message }));
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          ← Atrás
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Nuevo Ticket</h1>
          <p className="text-gray-600 dark:text-gray-400">Registra una orden de trabajo en campo</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

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
                  required
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">A quién afecta</h2>
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
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Indica al menos uno. Un trabajo interno en torre no tiene cliente, y una queja
              telefónica todavía no nombra un equipo.
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
            </div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Asignar un técnico ahora deja el ticket en «Asignado». Solo se ofrecen los técnicos
              activos.
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
            <TicketAddressFields form={address} errors={formErrors} onChange={handleAddressChange} />
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
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
