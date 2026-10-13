'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/contexts/toast.context';
import { Button, LoadingSpinner, SectionTitle } from '@/components/ui';
import { AlertThresholdsFields } from '@/components/wireless/AlertThresholdsFields';
import {
  ThresholdErrors,
  ThresholdsDraft,
  fromThresholdsDraft,
  toThresholdsDraft,
  validateThresholdsDraft,
} from '@/constants/alert-thresholds.constants';

export const ALERT_THRESHOLDS_QUERY_KEY = ['wireless-alert-thresholds'] as const;

/**
 * The limits the install's wireless alerts open at (WLS-200). Everyone reads
 * them; only an administrator saves them (`manage-settings`, WLS-202). A save
 * applies from the next poll. A device can override any group from its
 * wireless tab.
 */
export function AlertThresholdsCard() {
  const { isAuthenticated } = useAuth();
  const { isAdmin: canEdit } = usePermissions();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const { data: saved, isLoading, error: loadError } = useQuery({
    queryKey: ALERT_THRESHOLDS_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getAlertThresholds();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los umbrales de alerta');
      return r.data;
    },
    enabled: isAuthenticated,
  });

  // Null until the user edits: the form follows what is saved until then.
  const [draft, setDraft] = useState<ThresholdsDraft | null>(null);
  const [errors, setErrors] = useState<ThresholdErrors>({});
  const [saving, setSaving] = useState(false);

  const savedDraft = saved ? toThresholdsDraft(saved.thresholds) : null;
  const form = draft ?? savedDraft;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const atDefaults = !!saved && !!form && JSON.stringify(form) === JSON.stringify(toThresholdsDraft(saved.defaults));

  const edit = (next: ThresholdsDraft) => {
    setDraft(next);
    setErrors({});
  };

  const handleSave = async () => {
    if (!form) return;
    const found = validateThresholdsDraft(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      showError('Revisa los umbrales marcados.');
      return;
    }
    setSaving(true);
    const r = await apiService.saveAlertThresholds(fromThresholdsDraft(form));
    setSaving(false);
    if (r.success && r.data) {
      queryClient.setQueryData(ALERT_THRESHOLDS_QUERY_KEY, r.data);
      setDraft(null);
      showSuccess('Umbrales guardados. Aplican desde el próximo sondeo.');
    } else {
      showError(r.error || 'Error al guardar los umbrales de alerta');
    }
  };

  return (
    <section aria-label="Umbrales de alerta inalámbrica" className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <SectionTitle
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
          info="Los valores a los que se abren las alertas de los radios. Aplican desde el próximo sondeo, y a los diagnósticos que empiecen después. Una alerta abierta se vuelve a evaluar en el siguiente sondeo. Cada equipo puede personalizar cualquier grupo desde su pestaña inalámbrica."
        >
          Umbrales de alerta inalámbrica
        </SectionTitle>
      </div>
      <div className="px-6 py-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner message="Cargando..." />
          </div>
        ) : loadError || !form ? (
          <p className="text-sm text-center text-red-600 dark:text-red-400 py-4">
            {loadError?.message || 'Error al cargar los umbrales de alerta'}
          </p>
        ) : (
          <div className="mx-auto max-w-xl space-y-6">
            <AlertThresholdsFields draft={form} onChange={edit} errors={errors} disabled={!canEdit} />

            {canEdit ? (
              <div className="flex flex-wrap justify-end gap-2">
                {!atDefaults && saved && (
                  <Button variant="secondary" onClick={() => edit(toThresholdsDraft(saved.defaults))}>
                    Restaurar valores por defecto
                  </Button>
                )}
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
              <p className="text-sm text-gray-500 dark:text-gray-400">Solo un administrador puede cambiarlos.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
