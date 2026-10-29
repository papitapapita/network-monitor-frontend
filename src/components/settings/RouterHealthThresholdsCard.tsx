'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/contexts/toast.context';
import { Button, Input, LoadingSpinner, SectionTitle, Switch } from '@/components/ui';
import { ROUTER_HEALTH_LIMITS } from '@/constants/router-system.constants';
import type { RouterHealthThresholdsValues } from '@/types/router-system.types';

const QUERY_KEY = ['router-health-thresholds'] as const;

type Field = keyof RouterHealthThresholdsValues;

/** Every value as typed; the two switches stand for the nullable ones. */
interface Draft {
  values: Record<Field, string>;
  voltageAlert: boolean;
  sfpAlert: boolean;
}

const FIELDS: Field[] = [
  'cpuPercent',
  'minFreeMemoryPercent',
  'minFreeDiskPercent',
  'maxTemperatureC',
  'minVoltage',
  'flapLinkDowns',
  'minSfpRxPowerDbm',
];

const toDraft = (t: RouterHealthThresholdsValues, fallback: RouterHealthThresholdsValues): Draft => ({
  values: Object.fromEntries(FIELDS.map((f) => [f, String(t[f] ?? fallback[f] ?? '')])) as Record<Field, string>,
  voltageAlert: t.minVoltage != null,
  sfpAlert: t.minSfpRxPowerDbm != null,
});

const fromDraft = (d: Draft): RouterHealthThresholdsValues => ({
  cpuPercent: Number(d.values.cpuPercent),
  minFreeMemoryPercent: Number(d.values.minFreeMemoryPercent),
  minFreeDiskPercent: Number(d.values.minFreeDiskPercent),
  maxTemperatureC: Number(d.values.maxTemperatureC),
  minVoltage: d.voltageAlert ? Number(d.values.minVoltage) : null,
  flapLinkDowns: Number(d.values.flapLinkDowns),
  minSfpRxPowerDbm: d.sfpAlert ? Number(d.values.minSfpRxPowerDbm) : null,
});

function validate(d: Draft): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const f of FIELDS) {
    if ((f === 'minVoltage' && !d.voltageAlert) || (f === 'minSfpRxPowerDbm' && !d.sfpAlert)) continue;
    const { min, max, whole } = ROUTER_HEALTH_LIMITS[f];
    const raw = d.values[f].trim().replace(',', '.');
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n < min || n > max || (whole && !Number.isInteger(n))) {
      errors[f] = `${whole ? 'Un número entero' : 'Un número'} de ${min} a ${max}`;
    }
  }
  return errors;
}

/**
 * The limits a MikroTik's health and ports are judged against
 * (`/routers/health-thresholds`, MON-172, MON-196). Everyone reads them; only
 * an administrator saves them (`manage-settings`). Used from the next
 * scheduled check on.
 */
export function RouterHealthThresholdsCard() {
  const { isAuthenticated } = useAuth();
  const { isAdmin: canEdit } = usePermissions();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const { data: saved, isLoading, error: loadError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getRouterHealthThresholds();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los límites de salud de routers');
      return r.data;
    },
    enabled: isAuthenticated,
  });

  // Null until the user edits: the form follows what is saved until then.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);

  const savedDraft = saved ? toDraft(saved.thresholds, saved.defaults) : null;
  const form = draft ?? savedDraft;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const edit = (next: Draft) => {
    setDraft(next);
    setErrors({});
  };
  const setValue = (f: Field, v: string) => form && edit({ ...form, values: { ...form.values, [f]: v } });

  const handleSave = async () => {
    if (!form) return;
    const normalized: Draft = {
      ...form,
      values: Object.fromEntries(FIELDS.map((f) => [f, form.values[f].trim().replace(',', '.')])) as Record<Field, string>,
    };
    const found = validate(normalized);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      showError('Revisa los campos marcados.');
      return;
    }
    setSaving(true);
    const r = await apiService.saveRouterHealthThresholds(fromDraft(normalized));
    setSaving(false);
    if (r.success && r.data) {
      queryClient.setQueryData(QUERY_KEY, r.data);
      setDraft(null);
      showSuccess('Límites de salud de routers guardados.');
    } else {
      showError(r.error || 'Error al guardar los límites de salud de routers');
    }
  };

  const field = (f: Field, label: string, opts: { disabled?: boolean; step?: string } = {}) => (
    <Input
      label={label}
      type="number"
      inputMode="decimal"
      step={opts.step ?? '1'}
      min={ROUTER_HEALTH_LIMITS[f].min}
      max={ROUTER_HEALTH_LIMITS[f].max}
      value={form!.values[f]}
      onChange={(e) => setValue(f, e.target.value)}
      error={errors[f]}
      disabled={!canEdit || opts.disabled}
      fullWidth
    />
  );

  return (
    <section aria-label="Salud de routers" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <SectionTitle
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
          info="Cada 10 minutos el servidor lee los MikroTik de la empresa y avisa cuando un valor cruza su límite (la CPU, en dos lecturas seguidas), y de nuevo cuando se normaliza. Los cambios aplican desde la siguiente revisión."
        >
          Salud de routers
        </SectionTitle>
      </div>
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner message="Cargando..." />
          </div>
        ) : loadError || !form ? (
          <p className="text-sm text-center text-red-600 dark:text-red-400 py-4">
            {loadError?.message || 'Error al cargar los límites de salud de routers'}
          </p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {field('cpuPercent', 'CPU máxima (%)')}
              {field('minFreeMemoryPercent', 'Memoria libre mínima (%)')}
              {field('minFreeDiskPercent', 'Disco libre mínimo (%)')}
              {field('maxTemperatureC', 'Temperatura máxima (°C)')}
            </div>

            <div className="space-y-2">
              <Switch
                id="routerVoltageAlert"
                checked={form.voltageAlert}
                onChange={(e) => edit({ ...form, voltageAlert: e.target.checked })}
                disabled={!canEdit}
                label="Alertar por voltaje"
              />
              <div className="sm:w-1/2 sm:pr-2">{field('minVoltage', 'Voltaje mínimo (V)', { disabled: !form.voltageAlert, step: '0.1' })}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                El voltaje depende de la fuente de cada equipo (12, 24 o 48 V), así que un mismo límite no sirve para todos: actívalo
                solo si tus routers comparten fuente.
              </p>
            </div>

            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-5">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Puertos</p>
              <div className="sm:w-1/2 sm:pr-2">{field('flapLinkDowns', 'Caídas de enlace para alertar (por revisión de 10 min)')}</div>
              <div className="space-y-2">
                <Switch
                  id="routerSfpAlert"
                  checked={form.sfpAlert}
                  onChange={(e) => edit({ ...form, sfpAlert: e.target.checked })}
                  disabled={!canEdit}
                  label="Alertar por fibra"
                />
                <div className="sm:w-1/2 sm:pr-2">
                  {field('minSfpRxPowerDbm', 'Potencia mínima de fibra (dBm)', { disabled: !form.sfpAlert, step: '0.1' })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Los módulos de largo alcance trabajan bien por debajo de -20 dBm: ajusta el límite a los que uses.
                </p>
              </div>
            </div>

            {canEdit ? (
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={() => saved && edit(toDraft(saved.defaults, saved.defaults))}>
                  Restaurar valores por defecto
                </Button>
                <div className="flex gap-2">
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
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Solo un administrador puede cambiarlos.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
