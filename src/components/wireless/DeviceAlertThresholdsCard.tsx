'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useToast } from '@/contexts/toast.context';
import { Badge, Button, Card, LoadingSpinner, SectionTitle } from '@/components/ui';
import { AlertThresholdsFields } from '@/components/wireless/AlertThresholdsFields';
import {
  GROUP_ORDER,
  ThresholdErrors,
  ThresholdGroupKey,
  ThresholdsDraft,
  fromThresholdsDraft,
  isWidthGroup,
  toThresholdsDraft,
  validateThresholdsDraft,
} from '@/constants/alert-thresholds.constants';
import { AlertThresholdsDTO, DeviceAlertThresholdsDTO } from '@/types/alert-thresholds.types';

type Overridden = Partial<Record<ThresholdGroupKey, boolean>>;

const overriddenOf = (dto: DeviceAlertThresholdsDTO): Overridden =>
  Object.fromEntries(Object.keys(dto.overrides).map((k) => [k, true]));

/**
 * The overrides to send: every overridden group whole, except the width tables,
 * which merge per width (WLS-201) — so only the widths that differ from the
 * install go, and a table equal to the install's is left out.
 */
function buildOverrides(draft: ThresholdsDraft, overridden: Overridden, install: AlertThresholdsDTO): Partial<AlertThresholdsDTO> {
  const full = fromThresholdsDraft(draft);
  const out: Partial<AlertThresholdsDTO> = {};
  for (const key of GROUP_ORDER) {
    if (!overridden[key]) continue;
    if (isWidthGroup(key)) {
      const diff = Object.fromEntries(Object.entries(full[key]).filter(([w, v]) => install[key][w] !== v));
      if (Object.keys(diff).length > 0) out[key] = diff;
    } else {
      (out as Record<string, unknown>)[key] = full[key];
    }
  }
  return out;
}

interface Props {
  deviceId: string;
  /** ADMIN and OPERATOR (`update`); a VIEWER only reads. */
  canWrite: boolean;
}

/**
 * The limits this radio's alerts open at: the install's set, with any group
 * overridden for this device alone (WLS-201) — e.g. a long backhaul allowed
 * more distance. Collapsed by default: most devices follow the install.
 * Renders nothing until the radio has a wireless config (the backend 404s).
 */
export function DeviceAlertThresholdsCard({ deviceId, canWrite }: Props) {
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ['device-alert-thresholds', deviceId];
  const [open, setOpen] = useState(false);
  const { data, isLoading: loading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await apiService.getDeviceAlertThresholds(deviceId);
      // No wireless config yet: the radio has no thresholds to show.
      if (r.status === 404) return null;
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los umbrales de alerta');
      return r.data;
    },
  });
  const loadError = error?.message ?? null;

  // Null until the user edits: the form follows what is saved until then.
  const [edits, setEdits] = useState<{ draft: ThresholdsDraft; overridden: Overridden } | null>(null);
  const [errors, setErrors] = useState<ThresholdErrors>({});
  const [saving, setSaving] = useState(false);

  const draft = edits?.draft ?? (data ? toThresholdsDraft(data.effective) : null);
  const overridden = edits?.overridden ?? (data ? overriddenOf(data) : {});
  const inherited = data ? toThresholdsDraft(data.install) : null;
  const overrideCount = data ? Object.keys(data.overrides).length : 0;
  const dirty =
    !!data &&
    !!edits &&
    (JSON.stringify(edits.draft) !== JSON.stringify(toThresholdsDraft(data.effective)) ||
      JSON.stringify(edits.overridden) !== JSON.stringify(overriddenOf(data)));

  const discard = () => {
    setEdits(null);
    setErrors({});
  };

  // Turning a group on starts from the install's values; off returns to them.
  const toggle = (key: ThresholdGroupKey, on: boolean) => {
    if (!draft || !inherited) return;
    setEdits({ draft: { ...draft, [key]: inherited[key] }, overridden: { ...overridden, [key]: on || undefined } });
    setErrors({});
  };

  const save = async (overrides: Partial<AlertThresholdsDTO>, message: string) => {
    setSaving(true);
    const r = await apiService.saveDeviceAlertThresholds(deviceId, overrides);
    setSaving(false);
    if (r.success && r.data) {
      queryClient.setQueryData(queryKey, r.data);
      discard();
      showSuccess(message);
    } else {
      showError(r.error || 'Error al guardar los umbrales de alerta');
    }
  };

  const handleSave = () => {
    if (!draft || !data) return;
    const groups = GROUP_ORDER.filter((k) => overridden[k]);
    const found = validateThresholdsDraft(draft, groups);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      showError('Revisa los umbrales marcados.');
      return;
    }
    save(buildOverrides(draft, overridden, data.install), 'Umbrales del equipo guardados. Aplican desde el próximo sondeo.');
  };

  if (data === null) return null;

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle info="Los valores a los que se abren las alertas de este radio. Cada grupo sigue los de la instalación (Configuración) hasta personalizarlo aquí. Aplican desde el próximo sondeo.">
            Umbrales de alerta
          </SectionTitle>
          <div className="flex items-center gap-2">
            {data && (
              <Badge variant={overrideCount > 0 ? 'info' : 'neutral'}>
                {overrideCount > 0
                  ? `${overrideCount} personalizado${overrideCount === 1 ? '' : 's'}`
                  : 'Los de la instalación'}
              </Badge>
            )}
            <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? 'Ocultar' : 'Ver'}
            </Button>
          </div>
        </div>
      </Card.Header>
      {open && (
        <Card.Body>
          {loading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Cargando umbrales..." />
            </div>
          ) : loadError || !draft || !inherited ? (
            <p className="text-sm text-red-600 dark:text-red-400">{loadError || 'Error al cargar los umbrales de alerta'}</p>
          ) : (
            <div className="space-y-6">
              <AlertThresholdsFields
                draft={draft}
                onChange={(next) => { setEdits({ draft: next, overridden }); setErrors({}); }}
                errors={errors}
                disabled={!canWrite}
                override={{ inherited, overridden, onToggle: toggle }}
              />
              {canWrite && (
                <div className="flex flex-wrap justify-end gap-2">
                  {overrideCount > 0 && !dirty && (
                    <Button
                      variant="secondary"
                      onClick={() => save({}, 'El equipo vuelve a los umbrales de la instalación.')}
                      disabled={saving}
                    >
                      Volver a los de la instalación
                    </Button>
                  )}
                  {dirty && (
                    <Button variant="secondary" onClick={discard}>
                      Descartar
                    </Button>
                  )}
                  <Button onClick={handleSave} isLoading={saving} disabled={!dirty}>
                    Guardar
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      )}
    </Card>
  );
}
