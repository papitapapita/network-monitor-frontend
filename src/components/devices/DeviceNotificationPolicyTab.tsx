'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import { DeviceNotificationPolicyDTO } from '@/types/notification-policy.types';
import {
  Card,
  Input,
  Badge,
  LoadingSpinner,
  ConfirmModal,
  IconButton,
  EditToggleButton,
  EditFormActions,
  SectionTitle,
} from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import {
  validateQuietHours,
  validateAlertDelayMinutes,
} from '@/constants/notification-policy.constants';

interface Props {
  deviceId: string;
}

function ResetIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 010 10H9m-6-10l4-4m-4 4l4 4" />
    </svg>
  );
}

interface FormState {
  quietHoursStart: string;
  quietHoursEnd: string;
  alertDelayMinutes: string;
}

const emptyForm: FormState = { quietHoursStart: '', quietHoursEnd: '', alertDelayMinutes: '' };

const toForm = (policy: DeviceNotificationPolicyDTO): FormState => ({
  quietHoursStart: policy.quietHoursStart ?? '',
  quietHoursEnd: policy.quietHoursEnd ?? '',
  alertDelayMinutes: policy.alertDelayMinutes !== null ? String(policy.alertDelayMinutes) : '',
});

/**
 * Per-device quiet hours (mutes device-down, recovery, and wireless alert
 * *notifications* — the alert record itself still opens/lists normally) and
 * an optional override of the down-alert delay. No window configured means
 * always-notify; there is no separate "important device" flag (BACKEND_API.md).
 */
export function DeviceNotificationPolicyTab({ deviceId }: Props) {
  const { showError, showSuccess, showFormErrors } = useToast();
  const { canWrite } = usePermissions();
  // The install's delay (NOT-200) applies when the device carries none of its own.
  const installDelay = useNotificationSettings().data?.downAlertDelayMinutes;

  const [policy, setPolicy] = useState<DeviceNotificationPolicyDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchPolicy = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await apiService.getNotificationPolicy(deviceId);
    if (result.success && result.data) {
      setPolicy(result.data);
      setForm(toForm(result.data));
    } else {
      setLoadError(result.error || 'Error al cargar la política de notificaciones');
    }
    setLoading(false);
  }, [deviceId]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const alwaysNotifies = !form.quietHoursStart && !form.quietHoursEnd;

  const handleSave = async () => {
    const quietHoursError = validateQuietHours(form.quietHoursStart, form.quietHoursEnd);
    const delayError = validateAlertDelayMinutes(form.alertDelayMinutes);
    const nextErrors: Record<string, string> = {};
    if (quietHoursError) nextErrors.quietHoursStart = quietHoursError;
    if (delayError) nextErrors.alertDelayMinutes = delayError;
    setErrors(nextErrors);
    if (showFormErrors(nextErrors)) return;

    setSaving(true);
    const result = await apiService.updateNotificationPolicy(deviceId, {
      quietHoursStart: form.quietHoursStart || null,
      quietHoursEnd: form.quietHoursEnd || null,
      alertDelayMinutes: form.alertDelayMinutes ? parseInt(form.alertDelayMinutes, 10) : null,
    });
    setSaving(false);

    if (result.success && result.data) {
      setPolicy(result.data);
      setForm(toForm(result.data));
      setIsEditing(false);
      showSuccess('Política de notificaciones guardada.');
    } else {
      const message = result.error || 'Error al guardar la política de notificaciones';
      showError(message);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setErrors({});
    if (policy) setForm(toForm(policy));
  };

  const handleReset = async () => {
    setResetting(true);
    const result = await apiService.resetNotificationPolicy(deviceId);
    setResetting(false);
    setShowResetModal(false);

    if (result.success) {
      showSuccess('Política de notificaciones restablecida a los valores por defecto.');
      await fetchPolicy();
    } else {
      showError(result.error || 'Error al restablecer la política de notificaciones');
    }
  };

  const hasCustomPolicy = policy?.updatedAt != null;

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleReset}
        title="Restablecer notificaciones"
        message="El dispositivo volverá a notificar siempre, sin horario de silencio, y usará el retraso de alerta por defecto del sistema."
        confirmText="Restablecer"
        cancelText="Cancelar"
        isLoading={resetting}
      />

      <Card>
        <Card.Header>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <SectionTitle info="Silencia las notificaciones de caída, recuperación y alertas inalámbricas de este dispositivo durante el horario indicado: las alertas se siguen registrando normalmente, solo se posponen los avisos. Deja ambos campos vacíos para que notifique siempre. Un horario que cruza medianoche (p. ej. 22:00–07:00) es válido.">
              Política de Notificaciones
            </SectionTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={alwaysNotifies ? 'success' : 'info'}>
                {alwaysNotifies ? 'Siempre notifica' : 'Horario de silencio activo'}
              </Badge>
              {!loading && !loadError && (
                <>
                  <EditToggleButton isEditing={isEditing} onEdit={() => setIsEditing(true)} onCancel={cancelEdit} />
                  {hasCustomPolicy && !isEditing && canWrite && (
                    <IconButton
                      icon={<ResetIcon />}
                      label="Restablecer a valores por defecto"
                      onClick={() => setShowResetModal(true)}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Cargando política..." />
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          ) : isEditing ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Inicio del silencio"
                  type="time"
                  value={form.quietHoursStart}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, quietHoursStart: e.target.value }));
                    setErrors((p) => { const n = { ...p }; delete n.quietHoursStart; return n; });
                  }}
                  error={errors.quietHoursStart}
                  fullWidth
                />
                <Input
                  label="Fin del silencio"
                  type="time"
                  value={form.quietHoursEnd}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, quietHoursEnd: e.target.value }));
                    setErrors((p) => { const n = { ...p }; delete n.quietHoursStart; return n; });
                  }}
                  fullWidth
                />
              </div>

              <div className="mt-4 max-w-xs">
                <Input
                  label="Retraso de alerta de caída (minutos)"
                  type="number"
                  min={0}
                  placeholder={installDelay != null ? String(installDelay) : undefined}
                  value={form.alertDelayMinutes}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, alertDelayMinutes: e.target.value }));
                    setErrors((p) => { const n = { ...p }; delete n.alertDelayMinutes; return n; });
                  }}
                  error={errors.alertDelayMinutes}
                  info={installDelay != null
                    ? `Vacío usa el de la instalación (${installDelay} min, en Configuración).`
                    : 'Vacío usa el de la instalación (en Configuración).'}
                  fullWidth
                />
              </div>
            </>
          ) : (
            <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Inicio del silencio</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{policy?.quietHoursStart ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Fin del silencio</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{policy?.quietHoursEnd ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Retraso de alerta de caída</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {policy?.alertDelayMinutes != null
                    ? `${policy.alertDelayMinutes} min`
                    : installDelay != null ? `${installDelay} min (de la instalación)` : 'El de la instalación'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Última actualización</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {policy?.updatedAt ? new Date(policy.updatedAt).toLocaleString('es') : '—'}
                </dd>
              </div>
            </dl>
          )}
        </Card.Body>
        {isEditing && (
          <Card.Footer>
            <EditFormActions onCancel={cancelEdit} onSave={handleSave} isSaving={saving} hideCancel />
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}
