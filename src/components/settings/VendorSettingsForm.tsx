'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useToast } from '@/contexts/toast.context';
import { SUBSCRIPTION_QUERY_KEY, useSubscription } from '@/hooks/useSubscription';
import { Button, Combobox, ConfirmModal, Input, LoadingSpinner, SectionTitle, Switch } from '@/components/ui';
import {
  EMPTY_ISSUER,
  EMPTY_ROUTER,
  EMPTY_WHATSAPP,
  ISSUER_FIELDS,
  RETENTION_DAYS_MAX,
  RETENTION_FIELDS,
  STAGE_DAYS_MAX,
  WHATSAPP_FIELDS,
  VendorSettingsDraft,
  addMonth,
  formatDayValue,
  formatLongDay,
  fromVendorDraft,
  parseDay,
  previewStages,
  shortenedRetention,
  toVendorDraft,
  validateVendorDraft,
} from '@/constants/vendor-settings.constants';
import { VendorSettingsDTO } from '@/types/vendor-settings.types';

export const VENDOR_SETTINGS_QUERY_KEY = ['vendor-settings'] as const;

const STATE_LABELS: Record<string, string> = {
  NOT_ENFORCED: 'Sin cobro por suscripción',
  ACTIVE: 'Al día',
  GRACE: 'En período de gracia',
  READ_ONLY: 'Solo lectura',
  LOCKED: 'Bloqueada',
};

/** Today in Colombia (UTC-5, no daylight saving), where the paid days are counted. */
const colombianToday = () => formatDayValue(new Date(Date.now() - 5 * 3_600_000));

function Section({ id, title, info, action, children }: {
  id: string;
  title: string;
  info?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-2">
        <SectionTitle className="text-base font-semibold text-gray-900 dark:text-gray-100" info={info}>
          <span id={`${id}-title`}>{title}</span>
        </SectionTitle>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

const muted = 'text-sm text-gray-500 dark:text-gray-400';

/**
 * What the vendor runs the install with (INS-028). Replaced as a whole: one
 * save sends all eight fields, each optional group complete or null. The
 * route answers even on a locked install, so this is also where a payment is
 * recorded — after a save the subscription is re-read, and the app unlocks.
 */
export function VendorSettingsForm() {
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const subscription = useSubscription();

  const { data: saved, isLoading, error: loadError } = useQuery({
    queryKey: VENDOR_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getVendorSettings();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar la configuración del proveedor');
      return r.data;
    },
  });

  // Null until the vendor edits something, so the form follows what is saved.
  const [draft, setDraft] = useState<VendorSettingsDraft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmShorter, setConfirmShorter] = useState(false);

  const form = draft ?? (saved ? toVendorDraft(saved) : null);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(toVendorDraft(saved));

  // The enforcement router is picked from the inventory. A locked install
  // refuses the device list (402), so the id can still be typed there.
  const routerOn = !!form?.enforcementRouter;
  const { data: routers, isError: routersFailed } = useQuery({
    queryKey: ['vendor-settings', 'routers'],
    queryFn: async () => {
      const r = await apiService.listDevices({ category: 'GATEWAY', limit: 100 });
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los routers');
      return r.data.devices;
    },
    enabled: routerOn,
    retry: false,
  });

  // A link to one section (#emisor, from a PDF refused for want of one)
  // lands before the form exists; scroll there once it does.
  const loaded = !!saved;
  useEffect(() => {
    if (!loaded || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [loaded]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="Cargando..." />
      </div>
    );
  }
  if (loadError || !form || !saved) {
    return (
      <p className="text-sm text-center text-red-600 dark:text-red-400 py-8">
        {loadError?.message || 'Error al cargar la configuración del proveedor'}
      </p>
    );
  }

  const edit = (next: VendorSettingsDraft, ...touched: string[]) => {
    setDraft(next);
    if (touched.length) {
      setErrors((prev) => {
        const left = { ...prev };
        for (const key of Object.keys(left)) {
          if (touched.some((t) => key === t || key.startsWith(`${t}.`))) delete left[key];
        }
        return left;
      });
    }
  };

  const save = async () => {
    setConfirmShorter(false);
    setSaving(true);
    const r = await apiService.saveVendorSettings(fromVendorDraft(form));
    setSaving(false);
    if (r.success && r.data) {
      queryClient.setQueryData<VendorSettingsDTO>(VENDOR_SETTINGS_QUERY_KEY, r.data);
      // A recorded payment moves the stage at once (GET /api/subscription).
      await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      setDraft(null);
      setErrors({});
      showSuccess('Configuración del proveedor guardada.');
    } else {
      showError(r.error || 'Error al guardar la configuración del proveedor');
    }
  };

  const handleSave = () => {
    const found = validateVendorDraft(form);
    setErrors(found);
    if (Object.keys(found).length) {
      showError('Revisa los campos marcados.');
      return;
    }
    // A shorter window deletes older data at the next purge.
    if (shortenedRetention(saved, form).length) {
      setConfirmShorter(true);
      return;
    }
    save();
  };

  const billing = form.subscriptionPaidUntil !== '';
  const preview = billing ? previewStages(form.subscriptionPaidUntil, form.subscriptionGraceDays, form.subscriptionReadOnlyDays) : null;
  const shorter = shortenedRetention(saved, form);

  /** One more month from the last paid day — or from today, if that has passed. */
  const addPaidMonth = () => {
    const today = parseDay(colombianToday())!;
    const current = parseDay(form.subscriptionPaidUntil);
    const from = current && current >= today ? current : today;
    edit({ ...form, subscriptionPaidUntil: formatDayValue(addMonth(from)) }, 'subscriptionPaidUntil');
  };

  const routerOptions = (routers ?? []).map((d) => ({ value: d.id, label: d.name, sublabel: d.ipAddress ?? undefined }));
  const routerId = form.enforcementRouter?.deviceId ?? '';
  if (routerId && routers && !routers.some((d) => d.id === routerId)) {
    routerOptions.unshift({ value: routerId, label: routerId, sublabel: undefined });
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={confirmShorter}
        onClose={() => setConfirmShorter(false)}
        onConfirm={save}
        title="Acortar la retención de datos"
        message={`Lo que supere el nuevo período se borrará en la próxima depuración: ${shorter
          .map(({ key, label }) => `${label.toLowerCase()} (de ${saved[key]} a ${form.retention[key]} días)`)
          .join(', ')}. No se puede deshacer.`}
        confirmText="Guardar y acortar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={saving}
      />

      <Section
        id="suscripcion"
        title="Suscripción"
        info="Las condiciones de la suscripción de este cliente. Para registrar un pago, mueve el último día pagado; el estado cambia en cuanto guardas."
        action={<span className={muted}>Estado actual: <strong>{STATE_LABELS[subscription.state] ?? subscription.state}</strong></span>}
      >
        <div className="space-y-4">
          <Switch
            id="vendor-billing"
            label="Cobrar por suscripción"
            description="Apagado, la instalación nunca pasa a solo lectura ni se bloquea."
            checked={billing}
            onChange={(e) => edit({ ...form, subscriptionPaidUntil: e.target.checked ? colombianToday() : '' }, 'subscriptionPaidUntil')}
          />
          {billing && (
            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
              <div className="flex-1">
                <Input
                  label="Último día pagado"
                  type="date"
                  value={form.subscriptionPaidUntil}
                  onChange={(e) => edit({ ...form, subscriptionPaidUntil: e.target.value }, 'subscriptionPaidUntil')}
                  error={errors.subscriptionPaidUntil}
                  info="Cubierto hasta el final de ese día, hora de Colombia."
                  fullWidth
                />
              </div>
              <Button variant="secondary" onClick={addPaidMonth} className="sm:mt-6">
                Registrar un mes
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Días de gracia"
              type="number"
              min={0}
              max={STAGE_DAYS_MAX}
              value={form.subscriptionGraceDays}
              onChange={(e) => edit({ ...form, subscriptionGraceDays: e.target.value }, 'subscriptionGraceDays')}
              error={errors.subscriptionGraceDays}
              info="Días con servicio completo después del último día pagado."
              fullWidth
            />
            <Input
              label="Días en solo lectura"
              type="number"
              min={0}
              max={STAGE_DAYS_MAX}
              value={form.subscriptionReadOnlyDays}
              onChange={(e) => edit({ ...form, subscriptionReadOnlyDays: e.target.value }, 'subscriptionReadOnlyDays')}
              error={errors.subscriptionReadOnlyDays}
              info="Después de la gracia: se puede consultar pero no modificar, y no se monitorea. Luego se bloquea."
              fullWidth
            />
          </div>
          {preview && (
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1" aria-label="Etapas">
              <li>Servicio completo hasta el {formatLongDay(preview.paidUntil)}.</li>
              {preview.graceLast && <li>Gracia hasta el {formatLongDay(preview.graceLast)}.</li>}
              {preview.readOnlyLast && <li>Solo lectura hasta el {formatLongDay(preview.readOnlyLast)}.</li>}
              <li>Bloqueada desde el {formatLongDay(preview.lockedFrom)}.</li>
            </ul>
          )}
        </div>
      </Section>

      <Section
        id="alertas-proveedor"
        title="Alertas del proveedor"
        info="Tu propio chat de Telegram para los avisos de agentes desconectados y reconectados. Vacío, esos avisos llegan solo al chat de la instalación."
      >
        <Input
          label="Chat de Telegram del proveedor"
          value={form.vendorTelegramChatId}
          onChange={(e) => edit({ ...form, vendorTelegramChatId: e.target.value }, 'vendorTelegramChatId')}
          placeholder="8468052749 o @canal"
          error={errors.vendorTelegramChatId}
          fullWidth
        />
      </Section>

      <Section
        id="retencion"
        title="Retención de datos"
        info="Cuántos días se guarda cada tipo de dato antes de la depuración diaria. Las alertas abiertas no se borran nunca."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {RETENTION_FIELDS.map(({ key, label }) => (
            <Input
              key={key}
              label={`${label} (días)`}
              type="number"
              min={1}
              max={RETENTION_DAYS_MAX}
              value={form.retention[key]}
              onChange={(e) => edit({ ...form, retention: { ...form.retention, [key]: e.target.value } }, `retention.${key}`)}
              error={errors[`retention.${key}`]}
              fullWidth
            />
          ))}
        </div>
        {shorter.length > 0 && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
            Acortar un período borra los datos más antiguos en la próxima depuración.
          </p>
        )}
      </Section>

      <Section
        id="emisor"
        title="Emisor"
        info="Quién aparece como emisor en las cuentas de cobro. Sin emisor, no se pueden imprimir."
        action={
          <Switch
            id="vendor-issuer"
            label="Configurado"
            checked={!!form.issuer}
            onChange={(e) => edit({ ...form, issuer: e.target.checked ? (saved.issuer ?? EMPTY_ISSUER) : null }, 'issuer')}
          />
        }
      >
        {form.issuer ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ISSUER_FIELDS.map(({ key, label, placeholder }) => (
              <Input
                key={key}
                label={label}
                type={key === 'contactEmail' ? 'email' : 'text'}
                value={form.issuer![key]}
                placeholder={placeholder}
                onChange={(e) => edit({ ...form, issuer: { ...form.issuer!, [key]: e.target.value } }, `issuer.${key}`)}
                error={errors[`issuer.${key}`]}
                icon={key === 'accentColorHex' && /^#[0-9A-Fa-f]{6}$/.test(form.issuer!.accentColorHex) ? (
                  <span className="block h-4 w-4 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: form.issuer!.accentColorHex }} />
                ) : undefined}
                fullWidth
              />
            ))}
          </div>
        ) : (
          <p className={muted}>Sin emisor: las cuentas de cobro no se pueden imprimir.</p>
        )}
      </Section>

      <Section
        id="whatsapp"
        title="WhatsApp"
        info="La cuenta de WhatsApp Business que envía los avisos a los suscriptores. El token de acceso se queda en el servidor."
        action={
          <Switch
            id="vendor-whatsapp"
            label="Configurado"
            checked={!!form.whatsApp}
            onChange={(e) => edit({ ...form, whatsApp: e.target.checked ? (saved.whatsApp ?? EMPTY_WHATSAPP) : null }, 'whatsApp')}
          />
        }
      >
        {form.whatsApp ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {WHATSAPP_FIELDS.map(({ key, label, placeholder }) => (
              <Input
                key={key}
                label={label}
                value={form.whatsApp![key]}
                placeholder={placeholder}
                onChange={(e) => edit({ ...form, whatsApp: { ...form.whatsApp!, [key]: e.target.value } }, `whatsApp.${key}`)}
                error={errors[`whatsApp.${key}`]}
                fullWidth
              />
            ))}
          </div>
        ) : (
          <p className={muted}>Sin WhatsApp: los avisos a suscriptores no se envían (quedan en el registro del servidor).</p>
        )}
      </Section>

      <Section
        id="router-cumplimiento"
        title="Router de cumplimiento"
        info="El MikroTik que corta y restablece el servicio de los suscriptores morosos."
        action={
          <Switch
            id="vendor-router"
            label="Configurado"
            checked={routerOn}
            onChange={(e) => edit({ ...form, enforcementRouter: e.target.checked ? (saved.enforcementRouter ? toVendorDraft(saved).enforcementRouter : EMPTY_ROUTER) : null }, 'enforcementRouter')}
          />
        }
      >
        {form.enforcementRouter ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {routersFailed ? (
              <Input
                label="ID del router"
                value={form.enforcementRouter.deviceId}
                onChange={(e) => edit({ ...form, enforcementRouter: { ...form.enforcementRouter!, deviceId: e.target.value } }, 'enforcementRouter.deviceId')}
                error={errors['enforcementRouter.deviceId']}
                info="No se pudo cargar el inventario; pega el ID del dispositivo."
                fullWidth
              />
            ) : (
              <Combobox
                label="Router"
                options={routerOptions}
                value={form.enforcementRouter.deviceId}
                onChange={(value) => edit({ ...form, enforcementRouter: { ...form.enforcementRouter!, deviceId: value } }, 'enforcementRouter.deviceId')}
                placeholder={routers ? 'Buscar router…' : 'Cargando…'}
                error={errors['enforcementRouter.deviceId']}
                info="Los dispositivos de tipo Gateway del inventario."
                fullWidth
              />
            )}
            <Input
              label="Puerto de la API"
              type="number"
              min={1}
              max={65535}
              value={form.enforcementRouter.apiPort}
              onChange={(e) => edit({ ...form, enforcementRouter: { ...form.enforcementRouter!, apiPort: e.target.value } }, 'enforcementRouter.apiPort')}
              error={errors['enforcementRouter.apiPort']}
              fullWidth
            />
          </div>
        ) : (
          <p className={muted}>Sin router: los cortes y restablecimientos de servicio no están disponibles.</p>
        )}
      </Section>

      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-gray-50/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-end items-center gap-2">
        {dirty && <span className={`${muted} mr-auto`}>Cambios sin guardar</span>}
        {dirty && (
          <Button variant="secondary" onClick={() => { setDraft(null); setErrors({}); }}>
            Descartar
          </Button>
        )}
        <Button onClick={handleSave} isLoading={saving} disabled={!dirty}>
          Guardar
        </Button>
      </div>
    </div>
  );
}
