'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import { DeviceNotificationPolicyDTO, QuietHoursMode } from '@/types/notification-policy.types';
import {
  Card,
  Input,
  Select,
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
  QUIET_HOURS_MODE_LABELS,
  QUIET_HOURS_MODE_OPTIONS,
  formatQuietHours,
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
  quietHoursMode: QuietHoursMode;
  quietHoursStart: string;
  quietHoursEnd: string;
  alertDelayMinutes: string;
}

const emptyForm: FormState = { quietHoursMode: 'INHERIT', quietHoursStart: '', quietHoursEnd: '', alertDelayMinutes: '' };

const toForm = (policy: DeviceNotificationPolicyDTO): FormState => ({
  quietHoursMode: policy.quietHoursMode,
  quietHoursStart: policy.quietHoursStart ?? '',
  quietHoursEnd: policy.quietHoursEnd ?? '',
  alertDelayMinutes: policy.alertDelayMinutes !== null ? String(policy.alertDelayMinutes) : '',
});

/**
 * Which quiet hours apply to the device (they mute device-down, recovery, and
 * wireless alert *notifications* — the alert record itself still opens/lists
 * normally) and an optional override of the down-alert delay. The device
 * follows the install's window, sets its own, or always notifies (NOT-170).
 */
export function DeviceNotificationPolicyTab({ deviceId }: Props) {
  const { showError, showSuccess, showFormErrors } = useToast();
  const { canWrite } = usePermissions();
  // The install's delay (NOT-200) and quiet hours (NOT-207) apply when the
  // device carries none of its own.
  const installSettings = useNotificationSettings().data;
  const installDelay = installSettings?.downAlertDelayMinutes;
  const installWindow = installSettings
    ? formatQuietHours(installSettings.quietHoursStart, installSettings.quietHoursEnd)
    : null;

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

  const isCustom = form.quietHoursMode === 'CUSTOM';

  const handleSave = async () => {
    const quietHoursError = !isCustom
      ? null
      : !form.quietHoursStart && !form.quietHoursEnd
        ? 'Indica la hora de inicio y fin del horario propio'
        : validateQuietHours(form.quietHoursStart, form.quietHoursEnd);
    const delayError = validateAlertDelayMinutes(form.alertDelayMinutes);
    const nextErrors: Record<string, string> = {};
    if (quietHoursError) nextErrors.quietHoursStart = quietHoursError;
    if (delayError) nextErrors.alertDelayMinutes = delayError;
    setErrors(nextErrors);
    if (showFormErrors(nextErrors)) return;

    setSaving(true);
    // The window goes only with CUSTOM; the backend refuses it with the others.
    const result = await apiService.updateNotificationPolicy(deviceId, {
      quietHoursMode: form.quietHoursMode,
      quietHoursStart: isCustom ? form.quietHoursStart : null,
      quietHoursEnd: isCustom ? form.quietHoursEnd : null,
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

  // What the saved policy actually silences, for the read-only view.
  const effectiveWindow = !policy || policy.quietHoursMode === 'ALWAYS_NOTIFY'
    ? null
    : policy.quietHoursMode === 'CUSTOM'
      ? formatQuietHours(policy.quietHoursStart, policy.quietHoursEnd)
      : installWindow;
  const effectiveWindowText = policy?.quietHoursMode === 'ALWAYS_NOTIFY'
    ? 'Nada: notifica siempre'
    : policy?.quietHoursMode === 'INHERIT'
      ? installWindow ? `${installWindow} (de la instalación)` : 'Nada: la instalación no tiene horario de silencio'
      : effectiveWindow ?? '—';

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleReset}
        title="Restablecer notificaciones"
        message="El dispositivo volverá a seguir el horario de silencio de la instalación y a usar su retraso de alerta."
        confirmText="Restablecer"
        cancelText="Cancelar"
        isLoading={resetting}
      />

      <Card>
        <Card.Header>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <SectionTitle info="Durante el horario de silencio se posponen los avisos de caída, recuperación y alertas inalámbricas de este dispositivo; las alertas se siguen registrando normalmente. «Horario de la red» sigue el de la instalación (en Configuración), «Horario propio» usa uno solo para este dispositivo y «Notificar siempre» no lo silencia nunca, p. ej. el router principal. Un horario que cruza medianoche (p. ej. 22:00–07:00) es válido.">
              Política de Notificaciones
            </SectionTitle>
            <div className="flex flex-wrap items-center gap-2">
              {policy && (
                <Badge variant={effectiveWindow ? 'info' : 'success'}>
                  {QUIET_HOURS_MODE_LABELS[policy.quietHoursMode]}
                </Badge>
              )}
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
              <div className="max-w-xs">
                <Select
                  label="Horario de silencio"
                  value={form.quietHoursMode}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, quietHoursMode: e.target.value as QuietHoursMode }));
                    setErrors((p) => { const n = { ...p }; delete n.quietHoursStart; return n; });
                  }}
                  options={QUIET_HOURS_MODE_OPTIONS}
                  info={form.quietHoursMode === 'INHERIT'
                    ? installWindow
                      ? `Sigue el de la instalación (${installWindow}, en Configuración).`
                      : 'Sigue el de la instalación (en Configuración); ahora no tiene ninguno.'
                    : form.quietHoursMode === 'ALWAYS_NOTIFY'
                      ? 'Nunca se silencia, aunque la instalación tenga horario.'
                      : 'Usa el horario de abajo e ignora el de la instalación.'}
                  fullWidth
                />
              </div>

              {isCustom && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
              )}

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
                <dt className="font-medium text-gray-500 dark:text-gray-400">Horario de silencio</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {policy ? QUIET_HOURS_MODE_LABELS[policy.quietHoursMode] : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Silencia</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{effectiveWindowText}</dd>
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
