'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import { usePermissions } from '@/hooks/usePermissions';
import { useInstallation } from '@/hooks/useInstallation';
import { useAgents } from '@/hooks/useAgents';
import { useToast } from '@/contexts/toast.context';
import { Button, IconButton, Input, LoadingSpinner, SectionTitle, Select, Switch, TrashIcon } from '@/components/ui';
import {
  DISCOVERY_MAX_HOURS,
  DISCOVERY_MAX_PREFIX,
  DISCOVERY_MAX_SEGMENTS,
  DISCOVERY_MIN_HOURS,
  SCAN_FROM_SERVER,
  SCAN_MIN_PREFIX,
  isValidCidr,
} from '@/constants/network-scan.constants';
import type { DiscoverySettingsDTO, SaveDiscoverySettingsDTO } from '@/types/network-scan.types';

export const DISCOVERY_SETTINGS_QUERY_KEY = ['discovery-settings'] as const;

interface Draft {
  enabled: boolean;
  intervalHours: string;
  segments: { cidr: string; from: string }[];
}

const toDraft = (s: DiscoverySettingsDTO): Draft => ({
  enabled: s.enabled,
  intervalHours: String(s.intervalHours),
  segments: s.segments.map((g) => ({ cidr: g.cidr, from: g.agentId ?? SCAN_FROM_SERVER })),
});

const fromDraft = (d: Draft): SaveDiscoverySettingsDTO => ({
  enabled: d.enabled,
  intervalHours: Number(d.intervalHours),
  segments: d.segments.map((g) => ({ cidr: g.cidr.trim(), agentId: g.from === SCAN_FROM_SERVER ? null : g.from })),
});

/** Keyed `interval`, `segment-<i>` or `segment-<i>-from`. */
function validate(d: Draft): Record<string, string> {
  const errors: Record<string, string> = {};
  const hours = Number(d.intervalHours);
  if (!Number.isInteger(hours) || hours < DISCOVERY_MIN_HOURS || hours > DISCOVERY_MAX_HOURS) {
    errors.interval = `Horas enteras, de ${DISCOVERY_MIN_HOURS} a ${DISCOVERY_MAX_HOURS}`;
  }
  const seen = new Set<string>();
  d.segments.forEach((g, i) => {
    if (!isValidCidr(g.cidr, SCAN_MIN_PREFIX, DISCOVERY_MAX_PREFIX)) {
      errors[`segment-${i}`] = `Un bloque CIDR de /${SCAN_MIN_PREFIX} a /${DISCOVERY_MAX_PREFIX}, ej. 192.168.1.0/24`;
    }
    if (!g.from) errors[`segment-${i}-from`] = 'Elige un agente';
    const key = `${g.cidr.trim()}|${g.from}`;
    if (seen.has(key)) errors[`segment-${i}`] = 'Este segmento ya está en la lista con el mismo escáner';
    seen.add(key);
  });
  return errors;
}

/**
 * The scheduled network scan (DEV-210 … DEV-213): which segments are swept,
 * every how many hours, and from where. Each run feeds the same suggestions
 * and inbox notice as a manual scan. Everyone reads it; only an administrator
 * saves it (`manage-settings`).
 */
export function DiscoverySettingsCard() {
  const { isAuthenticated } = useAuth();
  const { isAdmin: canEdit } = usePermissions();
  const { serverOnSite } = useInstallation();
  const { data: agents = [] } = useAgents(isAuthenticated);
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const { data: saved, isLoading, error: loadError } = useQuery({
    queryKey: DISCOVERY_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getDiscoverySettings();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar el escaneo programado');
      return r.data;
    },
    enabled: isAuthenticated,
  });

  // Null until the user edits: the form follows what is saved until then.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const savedDraft = saved ? toDraft(saved) : null;
  const form = draft ?? savedDraft;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(savedDraft);

  // Off site every segment needs an agent (DEV-212). A revoked agent is kept
  // only where it is already saved, so the row can still show it.
  const fromOptions = (current: string) => [
    ...(serverOnSite || current === SCAN_FROM_SERVER ? [{ value: SCAN_FROM_SERVER, label: 'Servidor' }] : []),
    ...agents
      .filter((a) => a.status !== 'REVOKED' || a.id === current)
      .map((a) => ({ value: a.id, label: a.status === 'REVOKED' ? `${a.name} (revocado)` : a.name })),
  ];
  const defaultFrom = serverOnSite ? SCAN_FROM_SERVER : (agents.find((a) => a.status === 'ACTIVE')?.id ?? '');

  const edit = (next: Draft) => {
    setDraft(next);
    setErrors({});
  };

  const handleSave = async () => {
    if (!form) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      showError('Revisa los campos marcados.');
      return;
    }
    setSaving(true);
    const r = await apiService.saveDiscoverySettings(fromDraft(form));
    setSaving(false);
    if (r.success && r.data) {
      queryClient.setQueryData(DISCOVERY_SETTINGS_QUERY_KEY, r.data);
      setDraft(null);
      showSuccess('Escaneo programado guardado.');
    } else {
      showError(r.status === 409 ? 'Este servidor no está en la red monitoreada: cada segmento necesita un agente.' : r.error || 'Error al guardar el escaneo programado');
    }
  };

  return (
    <section aria-label="Escaneo programado" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <SectionTitle
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
          info="Barre estos segmentos cada tantas horas, uno tras otro, y deja los equipos que el inventario no tiene en «Descubiertos», con un aviso en la bandeja. Un segmento con agente lo barre ese agente (0.9.0 o posterior); si está desconectado, ese segmento se salta y los demás siguen."
        >
          Escaneo programado
        </SectionTitle>
      </div>
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner message="Cargando..." />
          </div>
        ) : loadError || !form ? (
          <p className="text-sm text-center text-red-600 dark:text-red-400 py-4">
            {loadError?.message || 'Error al cargar el escaneo programado'}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
              <div className="pt-7">
                <Switch
                  id="discoveryEnabled"
                  checked={form.enabled}
                  onChange={(e) => edit({ ...form, enabled: e.target.checked })}
                  disabled={!canEdit}
                  label="Activado"
                />
              </div>
              <div className="w-40">
                <Input
                  label="Cada (horas)"
                  type="number"
                  min={DISCOVERY_MIN_HOURS}
                  max={DISCOVERY_MAX_HOURS}
                  value={form.intervalHours}
                  onChange={(e) => edit({ ...form, intervalHours: e.target.value })}
                  error={errors.interval}
                  disabled={!canEdit}
                  fullWidth
                />
              </div>
              <p className="pt-7 text-sm text-gray-500 dark:text-gray-400">
                Última ejecución:{' '}
                {saved?.lastRunAt ? new Date(saved.lastRunAt).toLocaleString('es') : 'nunca'}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Segmentos</p>
              {form.segments.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Ningún segmento todavía.</p>
              )}
              {form.segments.map((g, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                  <Input
                    aria-label="Segmento CIDR"
                    placeholder="192.168.1.0/24"
                    value={g.cidr}
                    onChange={(e) => edit({ ...form, segments: form.segments.map((s, j) => (j === i ? { ...s, cidr: e.target.value } : s)) })}
                    error={errors[`segment-${i}`]}
                    disabled={!canEdit}
                    autoComplete="off"
                    spellCheck={false}
                    fullWidth
                  />
                  <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                    <Select
                      aria-label="Desde"
                      options={fromOptions(g.from)}
                      placeholder="Elige un agente..."
                      value={g.from}
                      onChange={(e) => edit({ ...form, segments: form.segments.map((s, j) => (j === i ? { ...s, from: e.target.value } : s)) })}
                      error={errors[`segment-${i}-from`]}
                      disabled={!canEdit}
                      fullWidth
                    />
                  </div>
                  {canEdit && (
                    <div className="col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto">
                      <IconButton
                        icon={<TrashIcon />}
                        label="Quitar segmento"
                        onClick={() => edit({ ...form, segments: form.segments.filter((_, j) => j !== i) })}
                      />
                    </div>
                  )}
                </div>
              ))}
              {canEdit && form.segments.length < DISCOVERY_MAX_SEGMENTS && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => edit({ ...form, segments: [...form.segments, { cidr: '', from: defaultFrom }] })}
                >
                  Agregar segmento
                </Button>
              )}
            </div>

            {canEdit ? (
              <div className="flex flex-wrap justify-end gap-2">
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Solo un administrador puede cambiarlo.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
