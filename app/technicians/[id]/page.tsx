'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { TechnicianDTO, UpdateTechnicianDTO } from '@/types/technician.types';
import { TicketDTO } from '@/types/ticket.types';
import { useAuth } from '@/contexts/auth.context';
import {
  technicianActiveLabel,
  technicianActiveVariant,
} from '@/constants/technician.constants';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_VARIANTS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_VARIANTS,
  formatScheduledFor,
  todayISODate,
} from '@/constants/ticket.constants';
import { Card, Button, Input, LoadingSpinner, Badge, ConfirmModal } from '@/components/ui';

export default function TechnicianDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id: technicianId } = useParams() as { id: string };

  const { user } = useAuth();
  const canWrite = user?.role === 'ADMIN' || user?.role === 'OPERATOR';
  const isAdmin = user?.role === 'ADMIN';

  const [technician, setTechnician] = useState<TechnicianDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showActiveModal, setShowActiveModal] = useState(false);
  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '' });

  const makeForm = (t: TechnicianDTO) => ({
    fullName: t.fullName,
    phone: t.phone,
    email: t.email ?? '',
  });

  const fetchTechnician = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const r = await apiService.getTechnician(technicianId);
    if (r.success && r.data) {
      setTechnician(r.data);
      setForm(makeForm(r.data));
    } else {
      setLoadError(r.error || 'Error al cargar el técnico');
    }
    setIsLoading(false);
  }, [technicianId]);

  useEffect(() => {
    fetchTechnician();
  }, [fetchTechnician]);

  // ── Their open work ────────────────────────────────────────
  const [tickets, setTickets] = useState<TicketDTO[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    setTicketsLoading(true);
    const r = await apiService.listTickets({ technicianId, openOnly: true, limit: 20 });
    if (r.success && r.data) setTickets(r.data.tickets);
    setTicketsLoading(false);
  }, [technicianId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (formErrors[name])
      setFormErrors((p) => {
        const n = { ...p };
        delete n[name];
        return n;
      });
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) errors.fullName = 'El nombre es requerido';
    else if (form.fullName.trim().length > 150)
      errors.fullName = 'El nombre no puede superar los 150 caracteres';

    const digits = form.phone.replace(/\D/g, '');
    if (!form.phone.trim()) errors.phone = 'El teléfono es requerido';
    else if (digits.length < 7 || digits.length > 15)
      errors.phone = 'El teléfono debe tener entre 7 y 15 dígitos';

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = 'El email no tiene un formato válido';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    setSaveError(null);
    const dto: UpdateTechnicianDTO = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
    };
    const r = await apiService.updateTechnician(technicianId, dto);
    if (r.success && r.data) {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      setTechnician(r.data);
      setIsEditing(false);
    } else {
      const message = r.error || 'Error al actualizar el técnico';
      if (r.errorField) setFormErrors((prev) => ({ ...prev, [r.errorField!]: message }));
      setSaveError(message);
    }
    setIsSaving(false);
  };

  /** Retiring someone is an update, not a delete — see the modal copy below. */
  const handleToggleActive = async () => {
    if (!technician) return;
    setIsTogglingActive(true);
    const r = await apiService.updateTechnician(technicianId, { isActive: !technician.isActive });
    setIsTogglingActive(false);
    setShowActiveModal(false);
    if (r.success && r.data) {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      setTechnician(r.data);
    } else {
      setSaveError(r.error || 'Error al cambiar el estado del técnico');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const r = await apiService.deleteTechnician(technicianId);
    setIsDeleting(false);
    if (r.success) {
      queryClient.invalidateQueries({ queryKey: ['technicians'] });
      router.push('/technicians');
    } else {
      setShowDeleteModal(false);
      // The 409 for a technician who has tickets lands here, already translated
      // into the suggestion to deactivate instead.
      setLoadError(r.error || 'Error al eliminar el técnico');
    }
  };

  if (isLoading)
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Cargando técnico..." />
      </div>
    );

  if (loadError && !technician)
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{loadError}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Volver
            </Button>
            <Button onClick={fetchTechnician}>Reintentar</Button>
          </div>
        </div>
      </div>
    );

  if (!technician) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Atrás
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere mb-2">
              {technician.fullName}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant={technicianActiveVariant(technician.isActive)}>
                {technicianActiveLabel(technician.isActive)}
              </Badge>
              <span className="text-gray-500 dark:text-gray-400 text-sm font-mono">
                {technician.phone}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/jornada?technicianId=${technician.id}&date=${todayISODate()}`)}
          >
            Ver jornada
          </Button>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => setShowActiveModal(true)}>
              {technician.isActive ? 'Desactivar' : 'Reactivar'}
            </Button>
          )}
          {isAdmin && (
            <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {loadError && technician && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{loadError}</p>
        </div>
      )}

      {!technician.isActive && (
        <div className="p-3 rounded-md text-sm bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
          Este técnico está inactivo: no aparece al asignar tickets. Su historial se conserva
          intacto.
        </div>
      )}

      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Datos</h2>
            {canWrite &&
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
                      setForm(makeForm(technician));
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
          {saveError && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">{saveError}</p>
          )}

          {isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Nombre Completo"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  error={formErrors.fullName}
                  maxLength={150}
                  required
                  fullWidth
                />
              </div>
              <Input
                label="Teléfono"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                error={formErrors.phone}
                required
                fullWidth
              />
              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={formErrors.email}
                fullWidth
              />
            </div>
          ) : (
            <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Nombre', value: technician.fullName },
                { label: 'Teléfono', value: technician.phone, mono: true },
                { label: 'Email', value: technician.email ?? '—' },
                { label: 'Estado', value: technicianActiveLabel(technician.isActive) },
                {
                  label: 'Cuenta de acceso',
                  value: technician.userId ?? 'Sin cuenta',
                  mono: !!technician.userId,
                  small: !!technician.userId,
                },
                {
                  label: 'Registrado',
                  value: new Date(technician.createdAt).toLocaleDateString('es'),
                },
                { label: 'ID', value: technician.id, mono: true, small: true },
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
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Tickets sin cerrar
              {tickets.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                  ({tickets.length})
                </span>
              )}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/tickets?technicianId=${technician.id}`)}
            >
              Ver todos
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          {ticketsLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Cargando tickets..." />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Sin tickets abiertos a su nombre.
            </p>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/tickets/${t.id}`)}
                  className="w-full text-left border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                      #{t.code}
                    </span>
                    <Badge variant={TICKET_STATUS_VARIANTS[t.status]}>
                      {TICKET_STATUS_LABELS[t.status]}
                    </Badge>
                    <Badge variant={TICKET_PRIORITY_VARIANTS[t.priority]}>
                      {TICKET_PRIORITY_LABELS[t.priority]}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{t.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Programado: {formatScheduledFor(t.scheduledFor)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>

      <ConfirmModal
        isOpen={showActiveModal}
        onClose={() => setShowActiveModal(false)}
        onConfirm={handleToggleActive}
        title={technician.isActive ? 'Desactivar técnico' : 'Reactivar técnico'}
        message={
          technician.isActive
            ? `¿Desactivar a "${technician.fullName}"? Dejará de aparecer al asignar tickets. Los tickets que ya trabajó conservan su nombre y su historial queda intacto.`
            : `¿Reactivar a "${technician.fullName}"? Volverá a estar disponible para recibir trabajo.`
        }
        confirmText={technician.isActive ? 'Desactivar' : 'Reactivar'}
        cancelText="Cancelar"
        variant={technician.isActive ? 'danger' : 'primary'}
        isLoading={isTogglingActive}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar técnico"
        message={`¿Eliminar a "${technician.fullName}"? Solo se puede eliminar un técnico que nunca ha tenido un ticket. Si ya trabajó alguno, desactívalo en su lugar.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
