'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/contexts/toast.context';
import { NOTIFICATION_SETTINGS_QUERY_KEY, useNotificationSettings } from '@/hooks/useNotificationSettings';
import { Button, ConfirmModal, Input, LoadingSpinner, SectionTitle, Switch } from '@/components/ui';
import {
  DOWN_ALERT_DELAY_MAX_MINUTES,
  validateDownAlertDelay,
  validateTelegramChatId,
} from '@/constants/notification-settings.constants';
import { NotificationSettingsDTO } from '@/types/notification-settings.types';

interface Draft {
  telegramChatId: string;
  downAlertDelayMinutes: string;
  wirelessAlertsEnabled: boolean;
}

const toDraft = (s: NotificationSettingsDTO): Draft => ({
  telegramChatId: s.telegramChatId ?? '',
  downAlertDelayMinutes: String(s.downAlertDelayMinutes),
  wirelessAlertsEnabled: s.wirelessAlertsEnabled,
});

type TestOutcome = { ok: true; chat: string } | { ok: false; message: string };

/**
 * Where the install's alerts go and when (NOT-200): the Telegram chat, how
 * long a device stays down before its alert is sent, and whether wireless
 * alerts are sent at all. Everyone reads them; only an administrator saves
 * them or sends a test message (`manage-settings`). A save applies from the
 * next alert.
 */
export function NotificationSettingsCard() {
  const { isAdmin: canEdit } = usePermissions();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const { data: saved, isLoading, error: loadError } = useNotificationSettings();

  // Null until the user types: the form shows what is saved, and follows it
  // when it changes underneath, until there is something of theirs to keep.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmNoChat, setConfirmNoChat] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOutcome, setTestOutcome] = useState<TestOutcome | null>(null);

  const form = draft ?? (saved ? toDraft(saved) : null);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(toDraft(saved));

  const edit = (patch: Partial<Draft>) => {
    if (!form) return;
    setDraft({ ...form, ...patch });
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof Draft)[]) delete next[key];
      return next;
    });
    if ('telegramChatId' in patch) setTestOutcome(null);
  };

  const validate = (): boolean => {
    if (!form) return false;
    const next: typeof errors = {};
    const chatError = validateTelegramChatId(form.telegramChatId);
    if (chatError) next.telegramChatId = chatError;
    const delayError = validateDownAlertDelay(form.downAlertDelayMinutes);
    if (delayError) next.downAlertDelayMinutes = delayError;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!form) return;
    setConfirmNoChat(false);
    setSaving(true);
    const r = await apiService.saveNotificationSettings({
      telegramChatId: form.telegramChatId.trim() || null,
      downAlertDelayMinutes: Number(form.downAlertDelayMinutes.trim()),
      wirelessAlertsEnabled: form.wirelessAlertsEnabled,
    });
    setSaving(false);
    if (r.success && r.data) {
      queryClient.setQueryData(NOTIFICATION_SETTINGS_QUERY_KEY, r.data);
      setDraft(null);
      showSuccess('Configuración de notificaciones guardada. Aplica desde la próxima alerta.');
    } else {
      showError(r.error || 'Error al guardar la configuración de notificaciones');
    }
  };

  const handleSave = () => {
    if (!form || !validate()) return;
    // Clearing the chat silences every alert: say so before it happens.
    if (!form.telegramChatId.trim() && saved?.telegramChatId) {
      setConfirmNoChat(true);
      return;
    }
    save();
  };

  const sendTest = async () => {
    if (!form) return;
    const chat = form.telegramChatId.trim();
    const chatError = validateTelegramChatId(chat);
    if (chatError) {
      setErrors((prev) => ({ ...prev, telegramChatId: chatError }));
      return;
    }
    setTesting(true);
    setTestOutcome(null);
    // As typed, before saving — empty tests the saved chat.
    const r = await apiService.testNotificationSettings(chat || undefined);
    setTesting(false);
    setTestOutcome(
      r.success && r.data
        ? { ok: true, chat: r.data.telegramChatId }
        : { ok: false, message: r.error || 'No se pudo enviar el mensaje de prueba' }
    );
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <ConfirmModal
        isOpen={confirmNoChat}
        onClose={() => setConfirmNoChat(false)}
        onConfirm={save}
        title="Guardar sin chat de Telegram"
        message="Sin chat, las alertas se siguen registrando pero no se le envían a nadie. ¿Guardar de todos modos?"
        confirmText="Guardar sin chat"
        cancelText="Cancelar"
        variant="danger"
        isLoading={saving}
      />
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <SectionTitle
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
          info="A dónde y cuándo se envían las alertas de esta instalación. Los cambios aplican desde la próxima alerta, sin reiniciar nada."
        >
          Notificaciones
        </SectionTitle>
      </div>
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner message="Cargando..." />
          </div>
        ) : loadError || !form ? (
          <p className="text-sm text-center text-red-600 dark:text-red-400 py-4">
            {loadError?.message || 'Error al cargar la configuración de notificaciones'}
          </p>
        ) : (
          <div className="mx-auto max-w-xl space-y-5">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="flex-1">
                  <Input
                    label="Chat de Telegram"
                    value={form.telegramChatId}
                    onChange={(e) => edit({ telegramChatId: e.target.value })}
                    placeholder="-1001234567890 o @canal"
                    error={errors.telegramChatId}
                    info="El grupo o canal que recibe las alertas. El bot de la instalación debe ser miembro. Vacío: las alertas se registran pero no se envían."
                    disabled={!canEdit}
                    fullWidth
                  />
                </div>
                {canEdit && (
                  <Button variant="secondary" onClick={sendTest} isLoading={testing} className="sm:mt-6">
                    Enviar mensaje de prueba
                  </Button>
                )}
              </div>
              {testOutcome && (
                <p
                  role="status"
                  className={`mt-2 text-sm ${testOutcome.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                >
                  {testOutcome.ok
                    ? `Mensaje de prueba enviado a ${testOutcome.chat}.`
                    : testOutcome.message}
                </p>
              )}
              {!form.telegramChatId.trim() && (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                  Sin chat configurado: las alertas no le llegan a nadie.
                </p>
              )}
            </div>

            <Input
              label="Retraso de alerta de caída (minutos)"
              type="number"
              min={0}
              max={DOWN_ALERT_DELAY_MAX_MINUTES}
              value={form.downAlertDelayMinutes}
              onChange={(e) => edit({ downAlertDelayMinutes: e.target.value })}
              error={errors.downAlertDelayMinutes}
              info="Cuánto tiempo debe seguir caído un dispositivo antes de enviar su alerta. Un dispositivo con su propio retraso (pestaña «Notificaciones») usa el suyo."
              disabled={!canEdit}
              fullWidth
            />

            <Switch
              id="wireless-alerts-enabled"
              label="Enviar alertas inalámbricas"
              description="Apagado, las alertas de enlaces inalámbricos se registran pero no se envían."
              checked={form.wirelessAlertsEnabled}
              onChange={(e) => edit({ wirelessAlertsEnabled: e.target.checked })}
              disabled={!canEdit}
            />

            {canEdit ? (
              <div className="flex justify-end gap-2">
                {dirty && (
                  <Button variant="secondary" onClick={() => { setDraft(null); setErrors({}); setTestOutcome(null); }}>
                    Descartar
                  </Button>
                )}
                <Button onClick={handleSave} isLoading={saving} disabled={!dirty}>
                  Guardar
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Solo un administrador puede cambiarlos.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
