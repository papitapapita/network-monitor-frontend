'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  TicketCategory,
  TicketDetailDTO,
  TicketPriority,
  UpdateTicketDTO,
} from '@/types/ticket.types';
import { fetchAllCustomers, fetchAllDevices, fetchAllTechnicians } from '@/hooks/useCatalogs';
import { useAuth } from '@/contexts/auth.context';
import { technicianActiveLabel, technicianActiveVariant } from '@/constants/technician.constants';
import {
  TICKET_CATEGORY_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_VARIANTS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_VARIANTS,
  canEdit,
  formatScheduledFor,
  isAlertOrigin,
  ticketCategoryLabel,
  ticketOriginLabel,
  todayISODate,
} from '@/constants/ticket.constants';
import { TicketActions } from '@/components/tickets/TicketActions';
import {
  AddressForm,
  TicketAddressFields,
  addressFormFrom,
  addressPayload,
  hasAddress,
  validateAddress,
} from '@/components/tickets/TicketAddressFields';
import {
  Card,
  Button,
  Input,
  Select,
  Textarea,
  Combobox,
  LoadingSpinner,
  Badge,
  ConfirmModal,
} from '@/components/ui';

/** Renders a timestamp, or an em dash when the step has not happened. */
const stamp = (iso: string | null): string =>
  iso ? `${new Date(iso).toLocaleDateString('es')} ${new Date(iso).toLocaleTimeString('es')}` : '—';

export default function TicketDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id: ticketId } = useParams() as { id: string };

  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR';
  const isAdmin = user?.role === 'ADMIN';

  const [ticket, setTicket] = useState<TicketDetailDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    priority: '',
    customerId: '',
    deviceId: '',
  });
  const [address, setAddress] = useState<AddressForm>(addressFormFrom(null));

  const { data: technicians = [] } = useQuery({
    queryKey: ['technicians'],
    queryFn: fetchAllTechnicians,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchAllCustomers,
    enabled: isEditing,
  });
  const { data: devices = [] } = useQuery({
    queryKey: ['devicesCatalog'],
    queryFn: fetchAllDevices,
    enabled: isEditing,
  });

  const makeForm = (t: TicketDetailDTO) => ({
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    customerId: t.customerId ?? '',
    deviceId: t.deviceId ?? '',
  });

  const fetchTicket = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const r = await apiService.getTicket(ticketId);
    if (r.success && r.data) {
      setTicket(r.data);
      setForm(makeForm(r.data));
      setAddress(addressFormFrom(r.data.address));
    } else {
      setLoadError(r.error || 'Error al cargar el ticket');
    }
    setIsLoading(false);
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  /**
   * Every action endpoint answers with the flat `TicketDTO`, while this page
   * renders the enriched one, so refetch instead of merging — otherwise the
   * technician card keeps the old name right after a reassignment.
   */
  const reload = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
    queryClient.invalidateQueries({ queryKey: ['daySheet'] });
    await fetchTicket();
  }, [queryClient, fetchTicket]);

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
    setForm((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) clearError(name);
  };

  const setField = (name: string, value: string) => {
    setForm((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) clearError(name);
    if (name === 'customerId' || name === 'deviceId') {
      clearError('customerId');
      clearError('deviceId');
    }
  };

  const handleAddressChange = (field: keyof AddressForm, value: string) => {
    setAddress((p) => ({ ...p, [field]: value }));
    if (formErrors[field]) clearError(field);
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = 'El asunto es requerido';
    else if (form.title.trim().length > 150)
      errors.title = 'El asunto no puede superar los 150 caracteres';
    if (!form.description.trim()) errors.description = 'La descripción es requerida';

    // The rule holds on the end state: a ticket can never end up naming neither.
    if (!form.customerId && !form.deviceId) {
      const message = 'Indica al menos un cliente o un dispositivo';
      errors.customerId = message;
      errors.deviceId = message;
    }

    Object.assign(errors, validateAddress(address));
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setSaveError(null);
    const dto: UpdateTicketDTO = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category as TicketCategory,
      priority: form.priority as TicketPriority,
      customerId: form.customerId || null,
      deviceId: form.deviceId || null,
      address: hasAddress(address) ? addressPayload(address) : null,
    };

    const r = await apiService.updateTicket(ticketId, dto);
    if (r.success) {
      setIsEditing(false);
      await reload();
    } else {
      const message = r.error || 'Error al actualizar el ticket';
      if (r.errorField) setFormErrors((prev) => ({ ...prev, [r.errorField!]: message }));
      setSaveError(message);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const r = await apiService.deleteTicket(ticketId);
    setIsDeleting(false);
    if (r.success) {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      router.push('/tickets');
    } else {
      setShowDeleteModal(false);
      setLoadError(r.error || 'Error al eliminar el ticket');
    }
  };

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

  if (isLoading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Cargando ticket..." />
      </div>
    );

  if (loadError && !ticket)
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{loadError}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Volver
            </Button>
            <Button onClick={fetchTicket}>Reintentar</Button>
          </div>
        </div>
      </div>
    );

  if (!ticket) return null;

  const mapsUrl =
    ticket.address?.latitude != null && ticket.address?.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${ticket.address.latitude},${ticket.address.longitude}`
      : ticket.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${ticket.address.street}, ${ticket.address.neighborhood}, ${ticket.address.municipality}`
          )}`
        : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Atrás
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere mb-2">
              <span className="font-mono text-gray-500 dark:text-gray-400">#{ticket.code}</span>{' '}
              {ticket.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={TICKET_STATUS_VARIANTS[ticket.status]}>
                {TICKET_STATUS_LABELS[ticket.status]}
              </Badge>
              <Badge variant={TICKET_PRIORITY_VARIANTS[ticket.priority]}>
                {TICKET_PRIORITY_LABELS[ticket.priority]}
              </Badge>
              <Badge variant="info">{ticketCategoryLabel(ticket.category)}</Badge>
              {isAlertOrigin(ticket.origin) && (
                <Badge variant="warning">{ticketOriginLabel(ticket.origin)}</Badge>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            Eliminar
          </Button>
        )}
      </div>

      {loadError && ticket && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{loadError}</p>
        </div>
      )}

      {isAlertOrigin(ticket.origin) && ticket.originAlertId && (
        <div className="p-3 rounded-md text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 flex justify-between items-center gap-3">
          <span>El monitoreo abrió este ticket a partir de una alerta.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/alerts/${ticket.originAlertId}`)}
          >
            Ver alerta
          </Button>
        </div>
      )}

      <Card>
        <Card.Body>
          <TicketActions
            ticket={ticket}
            technicians={technicians}
            canWrite={canWrite}
            onUpdated={reload}
            size="md"
          />
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalles</h2>
            {canWrite &&
              canEdit(ticket.status) &&
              (!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setForm(makeForm(ticket));
                      setAddress(addressFormFrom(ticket.address));
                      setFormErrors({});
                      setSaveError(null);
                    }}
                    disabled={isSaving}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} isLoading={isSaving}>
                    Guardar
                  </Button>
                </div>
              ))}
          </div>
        </Card.Header>
        <Card.Body>
          {saveError && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{saveError}</p>}

          {isEditing ? (
            <div className="space-y-4">
              {/* This form is the descriptive half of the ticket only. Status,
                  técnico and the visit day move through the buttons above. */}
              <Input
                label="Asunto"
                name="title"
                value={form.title}
                onChange={handleChange}
                error={formErrors.title}
                maxLength={150}
                required
                fullWidth
              />
              <Textarea
                label="Descripción"
                name="description"
                value={form.description}
                onChange={handleChange}
                error={formErrors.description}
                rows={5}
                maxLength={5000}
                required
                fullWidth
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Categoría"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  error={formErrors.category}
                  options={TICKET_CATEGORY_OPTIONS}
                  fullWidth
                />
                <Select
                  label="Prioridad"
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  options={TICKET_PRIORITY_OPTIONS}
                  fullWidth
                />
                <Combobox
                  label="Cliente"
                  options={customerOptions}
                  value={form.customerId}
                  onChange={(v) => setField('customerId', v)}
                  error={formErrors.customerId}
                  placeholder="Buscar cliente..."
                  fullWidth
                />
                <Combobox
                  label="Dispositivo"
                  options={deviceOptions}
                  value={form.deviceId}
                  onChange={(v) => setField('deviceId', v)}
                  error={formErrors.deviceId}
                  placeholder="Buscar dispositivo..."
                  fullWidth
                />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Dirección de la visita
                </h3>
                <TicketAddressFields
                  form={address}
                  errors={formErrors}
                  onChange={handleAddressChange}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-gray-900 dark:text-gray-100 mb-6">
                {ticket.description}
              </p>
              <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Código', value: `#${ticket.code}`, mono: true },
                  { label: 'Estado', value: TICKET_STATUS_LABELS[ticket.status] },
                  { label: 'Prioridad', value: TICKET_PRIORITY_LABELS[ticket.priority] },
                  { label: 'Categoría', value: ticketCategoryLabel(ticket.category) },
                  { label: 'Origen', value: ticketOriginLabel(ticket.origin) },
                  { label: 'Programado para', value: formatScheduledFor(ticket.scheduledFor) },
                  { label: 'Creado', value: stamp(ticket.createdAt) },
                  { label: 'Asignado', value: stamp(ticket.assignedAt) },
                  { label: 'Iniciado', value: stamp(ticket.startedAt) },
                  {
                    label: ticket.cancelledAt ? 'Cancelado' : 'Resuelto',
                    value: stamp(ticket.cancelledAt ?? ticket.resolvedAt),
                  },
                  { label: 'ID', value: ticket.id, mono: true, small: true },
                ].map(({ label, value, mono, small }) => (
                  <div key={label}>
                    <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd
                      className={`mt-1 text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : ''}`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Card.Body>
      </Card>

      {ticket.resolutionNotes && (
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resolución</h2>
          </Card.Header>
          <Card.Body>
            <p className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">
              {ticket.resolutionNotes}
            </p>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Resuelto el {stamp(ticket.resolvedAt)}
            </p>
          </Card.Body>
        </Card>
      )}

      {ticket.cancelReason && (
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cancelación</h2>
          </Card.Header>
          <Card.Body>
            <p className="text-gray-900 dark:text-gray-100">{ticket.cancelReason}</p>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Cancelado el {stamp(ticket.cancelledAt)}
            </p>
          </Card.Body>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cliente</h2>
          </Card.Header>
          <Card.Body>
            {ticket.customer ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {ticket.customer.fullName}
                </p>
                <a
                  href={`tel:${ticket.customer.phone}`}
                  className="block font-mono text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {ticket.customer.phone}
                </a>
                {ticket.customer.email && (
                  <a
                    href={`mailto:${ticket.customer.email}`}
                    className="block text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {ticket.customer.email}
                  </a>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/customers/${ticket.customer!.id}`)}
                >
                  Ver Cliente
                </Button>
              </div>
            ) : ticket.customerId ? (
              // The FKs are SET NULL, so a deleted customer leaves the id behind
              // and the ticket survives — say so rather than showing nothing.
              <p className="text-sm text-gray-500 dark:text-gray-400">
                El cliente referenciado ya no existe.
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin cliente asociado.</p>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dispositivo</h2>
          </Card.Header>
          <Card.Body>
            {ticket.device ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100">{ticket.device.name}</p>
                {ticket.device.ipAddress && (
                  <p className="font-mono text-gray-700 dark:text-gray-300">
                    {ticket.device.ipAddress}
                  </p>
                )}
                <p className="text-gray-600 dark:text-gray-400">
                  {[ticket.device.vendorName, ticket.device.modelName].filter(Boolean).join(' ') ||
                    '—'}
                </p>
                {ticket.device.locationName && (
                  <p className="text-gray-600 dark:text-gray-400">{ticket.device.locationName}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/devices/${ticket.device!.id}`)}
                >
                  Ver Dispositivo
                </Button>
              </div>
            ) : ticket.deviceId ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                El dispositivo referenciado ya no existe.
              </p>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin dispositivo asociado.</p>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Técnico</h2>
          </Card.Header>
          <Card.Body>
            {ticket.technician ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {ticket.technician.fullName}
                  </span>
                  <Badge variant={technicianActiveVariant(ticket.technician.isActive)}>
                    {technicianActiveLabel(ticket.technician.isActive)}
                  </Badge>
                </div>
                <a
                  href={`tel:${ticket.technician.phone}`}
                  className="block font-mono text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {ticket.technician.phone}
                </a>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/technicians/${ticket.technician!.id}`)}
                  >
                    Ver Técnico
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/jornada?technicianId=${ticket.technician!.id}&date=${ticket.scheduledFor ?? todayISODate()}`
                      )
                    }
                  >
                    Ver jornada
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin asignar.</p>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Dirección de la visita
            </h2>
          </Card.Header>
          <Card.Body>
            {ticket.address ? (
              <div className="space-y-2 text-sm">
                <p className="text-gray-900 dark:text-gray-100">{ticket.address.street}</p>
                <p className="text-gray-700 dark:text-gray-300">
                  {ticket.address.neighborhood}, {ticket.address.municipality}
                </p>
                {ticket.address.reference && (
                  <p className="text-gray-600 dark:text-gray-400">{ticket.address.reference}</p>
                )}
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Abrir en Google Maps
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin dirección registrada.</p>
            )}
          </Card.Body>
        </Card>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar ticket"
        message={`¿Eliminar el ticket #${ticket.code}? Desaparece del historial y no se puede deshacer. Para cerrar un ticket que no se va a trabajar, usa «Cancelar ticket» — así se conservan el registro y el motivo.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
