'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/contexts/toast.context';
import { BILLING_SETTINGS_QUERY_KEY, useBillingSettings } from '@/hooks/useBillingSettings';
import { Button, ConfirmModal, Input, LoadingSpinner, SectionTitle, Select, Switch } from '@/components/ui';
import {
  BILLING_MODE_OPTIONS,
  GRACE_DAYS_MAX,
  ISSUE_LEAD_DAYS_MAX,
  ISSUE_LEAD_DAYS_MIN,
  validateGraceDays,
  validateIssueLeadDays,
  validateWhatsAppTemplate,
} from '@/constants/billing-settings.constants';
import { BillingMode, BillingSettingsDTO } from '@/types/billing-settings.types';

interface Draft {
  automaticBillingEnabled: boolean;
  billingMode: BillingMode;
  issueLeadDays: string;
  graceDays: string;
  automaticCutEnabled: boolean;
  reminderWhatsAppTemplate: string;
  billWhatsAppTemplate: string;
}

const toDraft = (s: BillingSettingsDTO): Draft => ({
  automaticBillingEnabled: s.automaticBillingEnabled,
  billingMode: s.billingMode,
  issueLeadDays: String(s.issueLeadDays),
  graceDays: String(s.graceDays),
  automaticCutEnabled: s.automaticCutEnabled,
  reminderWhatsAppTemplate: s.reminderWhatsAppTemplate ?? '',
  billWhatsAppTemplate: s.billWhatsAppTemplate ?? '',
});

/**
 * The install's billing cycle (BIL-280): whether bills issue themselves and
 * go overdue on their own, for which month, how early, and whether unpaid
 * customers are cut after the grace days. Everyone reads it; only an
 * administrator saves it (`manage-settings`). A save applies from the next
 * daily run.
 */
export function BillingSettingsCard() {
  const { isAdmin: canEdit } = usePermissions();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const { data: saved, isLoading, error: loadError } = useBillingSettings();

  // Null until the user edits: the form follows what is saved until then.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmCut, setConfirmCut] = useState(false);

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
  };

  const validate = (): boolean => {
    if (!form) return false;
    const next: typeof errors = {};
    const lead = validateIssueLeadDays(form.issueLeadDays);
    if (lead) next.issueLeadDays = lead;
    const grace = validateGraceDays(form.graceDays);
    if (grace) next.graceDays = grace;
    const template = validateWhatsAppTemplate(form.reminderWhatsAppTemplate);
    if (template) next.reminderWhatsAppTemplate = template;
    const billTemplate = validateWhatsAppTemplate(form.billWhatsAppTemplate);
    if (billTemplate) next.billWhatsAppTemplate = billTemplate;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!form) return;
    setConfirmCut(false);
    setSaving(true);
    const r = await apiService.saveBillingSettings({
      automaticBillingEnabled: form.automaticBillingEnabled,
      billingMode: form.billingMode,
      issueLeadDays: Number(form.issueLeadDays.trim()),
      graceDays: Number(form.graceDays.trim()),
      automaticCutEnabled: form.automaticCutEnabled,
      reminderWhatsAppTemplate: form.reminderWhatsAppTemplate.trim() || null,
      billWhatsAppTemplate: form.billWhatsAppTemplate.trim() || null,
    });
    setSaving(false);
    if (r.success && r.data) {
      queryClient.setQueryData(BILLING_SETTINGS_QUERY_KEY, r.data);
      setDraft(null);
      showSuccess('Configuración de facturación guardada. Aplica desde la próxima ejecución diaria.');
    } else {
      showError(r.error || 'Error al guardar la configuración de facturación');
    }
  };

  const handleSave = () => {
    if (!form || !validate()) return;
    // Turning the cut on suspends real customers the next morning: say so first.
    if (form.automaticCutEnabled && !saved?.automaticCutEnabled) {
      setConfirmCut(true);
      return;
    }
    save();
  };

  const automatic = !!form?.automaticBillingEnabled;

  return (
    <section aria-label="Facturación" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <ConfirmModal
        isOpen={confirmCut}
        onClose={() => setConfirmCut(false)}
        onConfirm={save}
        title="Activar el corte automático"
        message={`Desde la próxima ejecución diaria, se suspende cada servicio activo con una factura vencida hace más de ${form?.graceDays ?? '—'} días; los demás servicios del cliente siguen activos. ¿Activar el corte?`}
        confirmText="Activar corte"
        cancelText="Cancelar"
        variant="danger"
        isLoading={saving}
      />
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <SectionTitle
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
          info="El ciclo de cobro de esta instalación. La ejecución diaria corre desde las 6:00 (hora de Colombia); los cambios aplican desde la siguiente, sin reiniciar nada."
        >
          Facturación
        </SectionTitle>
      </div>
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner message="Cargando..." />
          </div>
        ) : loadError || !form ? (
          <p className="text-sm text-center text-red-600 dark:text-red-400 py-4">
            {loadError?.message || 'Error al cargar la configuración de facturación'}
          </p>
        ) : (
          <div className="mx-auto max-w-xl space-y-5">
            <Switch
              id="automatic-billing-enabled"
              label="Facturación automática"
              description="Cada servicio activo recibe su propia factura antes de su día de pago, prorrateada si empezó dentro del mes, y las facturas sin pagar pasan a vencidas solas. Apagado, todo se hace a mano."
              checked={form.automaticBillingEnabled}
              onChange={(e) => edit({ automaticBillingEnabled: e.target.checked })}
              disabled={!canEdit}
            />

            <Select
              label="Modalidad de cobro"
              value={form.billingMode}
              onChange={(e) => edit({ billingMode: e.target.value as BillingMode })}
              options={BILLING_MODE_OPTIONS}
              info="Anticipado: el cliente paga el mes que empieza. En anticipado, un servicio que empezó después de la emisión del mes anterior también paga esos días en su primera factura."
              disabled={!canEdit || !automatic}
              fullWidth
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Días de anticipación"
                type="number"
                min={ISSUE_LEAD_DAYS_MIN}
                max={ISSUE_LEAD_DAYS_MAX}
                value={form.issueLeadDays}
                onChange={(e) => edit({ issueLeadDays: e.target.value })}
                error={errors.issueLeadDays}
                info="Cuántos días antes del día de pago se emite la factura. Si una ejecución falla, se emite en un día posterior, hasta el vencimiento."
                disabled={!canEdit || !automatic}
                fullWidth
              />
              <Input
                label="Días de gracia"
                type="number"
                min={0}
                max={GRACE_DAYS_MAX}
                value={form.graceDays}
                onChange={(e) => edit({ graceDays: e.target.value })}
                error={errors.graceDays}
                info="Cuántos días después del vencimiento se espera antes del corte. Los recordatorios salen los dos últimos días de gracia."
                disabled={!canEdit || !automatic}
                fullWidth
              />
            </div>

            <Switch
              id="automatic-cut-enabled"
              label="Corte automático"
              description="El día después del último día de gracia se suspende cada servicio activo con una factura vencida, solo ese servicio y no los demás del cliente. Al registrar el pago, se reactiva el servicio de esa factura si no tiene otra vencida, también si se suspendió a mano."
              checked={form.automaticCutEnabled}
              onChange={(e) => edit({ automaticCutEnabled: e.target.checked })}
              disabled={!canEdit || !automatic}
            />

            <Input
              label="Plantilla de WhatsApp para facturas"
              value={form.billWhatsAppTemplate}
              onChange={(e) => edit({ billWhatsAppTemplate: e.target.value })}
              placeholder="factura_emitida"
              error={errors.billWhatsAppTemplate}
              info="El nombre de una plantilla aprobada en Meta con un documento en el encabezado, donde va el PDF, y cuatro parámetros en el cuerpo: nombre, periodo, monto y último día de pago. Vacío: las facturas van solo por email."
              disabled={!canEdit || !automatic}
              fullWidth
            />

            <Input
              label="Plantilla de WhatsApp para recordatorios"
              value={form.reminderWhatsAppTemplate}
              onChange={(e) => edit({ reminderWhatsAppTemplate: e.target.value })}
              placeholder="recordatorio_pago"
              error={errors.reminderWhatsAppTemplate}
              info="El nombre de una plantilla aprobada en Meta, con cuatro parámetros en el cuerpo: nombre, periodo, monto y día de corte. Vacío: los recordatorios van solo por email. Solo se envían con el corte automático activo."
              disabled={!canEdit || !automatic}
              fullWidth
            />

            {automatic && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cada factura emitida se envía con su PDF a los clientes con email y, con la plantilla de facturas, también por WhatsApp. Un envío fallido no anula la factura. El email requiere la configuración SMTP del servidor.
              </p>
            )}

            {canEdit ? (
              <div className="flex justify-end gap-2">
                {dirty && (
                  <Button variant="secondary" onClick={() => { setDraft(null); setErrors({}); }}>
                    Descartar
                  </Button>
                )}
                <Button onClick={handleSave} isLoading={saving} disabled={!dirty}>
                  Guardar
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Solo un administrador puede cambiarla.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
