'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import { useToast } from '@/contexts/toast.context';
import { Button, Input, Switch, LoadingSpinner, Badge } from '@/components/ui';
import {
  KNOWN_MUTABLE_METRICS,
  validateMetricKey,
} from '@/constants/notification-mutes.constants';

/**
 * Global list of alert-type keys silenced everywhere — never per device and
 * never a schedule, in contrast to the per-device quiet hours tab. Only the
 * outbound push is affected: a muted condition still opens/lists normally on
 * the alerts screen (BACKEND_API.md, NOT-190).
 */
export function NotificationMutesCard() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'OPERATOR';
  const { showError, showSuccess } = useToast();

  const [muted, setMuted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customKey, setCustomKey] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const fetchMutes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await apiService.getNotificationMutes();
    if (result.success && result.data) {
      setMuted(result.data.metrics);
    } else {
      setLoadError(result.error || 'Error al cargar los silenciamientos');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMutes();
  }, [fetchMutes]);

  const save = async (next: string[]) => {
    const previous = muted;
    setMuted(next);
    setSaving(true);
    const result = await apiService.updateNotificationMutes({ metrics: next });
    setSaving(false);
    if (result.success && result.data) {
      setMuted(result.data.metrics);
      showSuccess('Silenciamientos actualizados.');
    } else {
      setMuted(previous);
      showError(result.error || 'Error al actualizar los silenciamientos');
    }
  };

  const toggleKnown = (key: string, checked: boolean) => {
    const next = checked ? Array.from(new Set([...muted, key])) : muted.filter((m) => m !== key);
    save(next);
  };

  const removeCustom = (key: string) => {
    save(muted.filter((m) => m !== key));
  };

  const addCustom = () => {
    const value = customKey.trim();
    const error = validateMetricKey(value);
    if (error) {
      setCustomError(error);
      return;
    }
    if (muted.includes(value)) {
      setCustomError('Esa métrica ya está silenciada');
      return;
    }
    setCustomError(null);
    setCustomKey('');
    save([...muted, value]);
  };

  const knownKeys = new Set(KNOWN_MUTABLE_METRICS.map((m) => m.key));
  const customMuted = muted.filter((m) => !knownKeys.has(m));

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Notificaciones silenciadas
        </h2>
        {muted.length > 0 && <Badge variant="info">{muted.length} silenciada{muted.length === 1 ? '' : 's'}</Badge>}
      </div>
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner message="Cargando..." />
          </div>
        ) : loadError ? (
          <p className="text-sm text-center text-red-600 dark:text-red-400 py-4">{loadError}</p>
        ) : (
          <div className="mx-auto max-w-xl">
            <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
              Silencia el aviso de Telegram para un tipo de condición, en todos los dispositivos y
              para siempre — la alerta se sigue registrando y listando normalmente, solo deja de
              notificarse. Silenciar una métrica apaga sus avisos de advertencia y crítico a la vez.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 rounded-lg border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 sm:divide-y-0 overflow-hidden">
              {KNOWN_MUTABLE_METRICS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <label
                    htmlFor={`mute-${key}`}
                    className={`text-sm select-none ${
                      canEdit
                        ? 'text-gray-700 dark:text-gray-300 cursor-pointer'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {label}
                  </label>
                  <Switch
                    id={`mute-${key}`}
                    checked={muted.includes(key)}
                    disabled={!canEdit || saving}
                    onChange={(e) => toggleKnown(key, e.target.checked)}
                  />
                </div>
              ))}
            </div>

            {customMuted.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700 text-center">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
                  Otras métricas silenciadas
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {customMuted.map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-mono text-gray-700 dark:text-gray-200"
                    >
                      {key}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeCustom(key)}
                          disabled={saving}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          aria-label={`Quitar silenciamiento de ${key}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {canEdit && (
              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700 flex items-end justify-center gap-2">
                <div className="w-64">
                  <Input
                    label="Silenciar otra métrica"
                    placeholder="p. ej. rx_crc_errors"
                    value={customKey}
                    onChange={(e) => {
                      setCustomKey(e.target.value);
                      setCustomError(null);
                    }}
                    error={customError ?? undefined}
                    fullWidth
                  />
                </div>
                <Button variant="outline" onClick={addCustom} disabled={saving || !customKey.trim()}>
                  Añadir
                </Button>
              </div>
            )}

            {!canEdit && (
              <p className="mt-6 text-xs text-center text-gray-500 dark:text-gray-400">
                Tu rol solo permite ver los silenciamientos actuales.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
