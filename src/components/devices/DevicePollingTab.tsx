'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import {
  PollingStatusDTO,
  PollingHistoryResponse,
  ManualPollResultDTO,
} from '@/types/polling.types';
import {
  Card,
  Button,
  Input,
  Select,
  LoadingSpinner,
  Badge,
  ConfirmModal,
  getPollingStatusBadgeVariant
} from '@/components/ui';
import { useAuth } from '@/contexts/auth.context';
import {
  POLLING_INTERVAL_MIN_SECONDS,
  INTERVAL_MAX_SECONDS,
  FAILURES_BEFORE_DOWN_MIN,
  FAILURES_BEFORE_DOWN_MAX,
  validateIntervalSeconds,
  validateFailuresBeforeDown,
} from '@/constants/polling.constants';
import {
  canEnableMonitoring,
  monitoringBlockedReason,
  isWirelessCategory,
} from '@/constants/device.constants';
import { WIRELESS_INDEPENDENT_OF_ICMP_NOTE } from '@/constants/wireless.constants';
import { DeviceResponseDTO } from '@/types/device.types';

function toISOWithOffset(dateStr: string, endOfDay = false): string {
  const time = endOfDay ? 'T23:59:59' : 'T00:00:00';
  const d = new Date(dateStr + time);
  const off = d.getTimezoneOffset();
  const sign = off <= 0 ? '+' : '-';
  const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const m = String(Math.abs(off) % 60).padStart(2, '0');
  return `${dateStr}${time}${sign}${h}:${m}`;
}

const CONNECTIVITY_LABELS: Record<string, string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Desconectado',
  UNKNOWN: 'Desconocido',
};

export function validatePollingConfigForm(form: {
  intervalSeconds: string;
  failuresBeforeDown: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  const interval = validateIntervalSeconds(form.intervalSeconds, {
    min: POLLING_INTERVAL_MIN_SECONDS,
    max: INTERVAL_MAX_SECONDS,
  });
  if (interval) errors.intervalSeconds = interval;

  const failures = validateFailuresBeforeDown(form.failuresBeforeDown);
  if (failures) errors.failuresBeforeDown = failures;

  return errors;
}

interface Props {
  device: DeviceResponseDTO;
  /** Enabling monitoring writes to the device, so the page's copy has to catch up. */
  onDeviceUpdated: (device: DeviceResponseDTO) => void;
}

export function DevicePollingTab({ device, onDeviceUpdated }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const deviceId = device.id;
  // Polling targets the device IP, so nothing can be configured or triggered without one.
  const hasIp = !!device.ipAddress;

  // ── Status ────────────────────────────────────────────────
  const [pollingStatus, setPollingStatus] = useState<PollingStatusDTO | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [noConfig, setNoConfig] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollResult, setPollResult] = useState<ManualPollResultDTO | null>(null);
  const [isEnabling, setIsEnabling] = useState(false);

  /**
   * Nothing is being polled — the device flag is off, there is no polling config
   * at all, or the config exists but is disabled. The three differ only in how
   * they got there, so the tab reports one state: no monitoring, no schedule,
   * and an unknown connectivity status rather than a reading left over from
   * whenever monitoring was last on.
   */
  const monitoringOff =
    !device.monitoringEnabled || noConfig || pollingStatus?.pollingEnabled === false;

  /** Null while monitoring can be turned on from here — the same rule the details form applies. */
  const blockedReason = monitoringBlockedReason(device.status, device.ipAddress);

  /** The last ping on record, whether or not one is still scheduled. */
  const lastPolledAt = pollingStatus?.lastPolled ?? pollingStatus?.lastResult?.timestamp ?? null;

  // ── Config ────────────────────────────────────────────────
  const [configForm, setConfigForm] = useState({
    intervalSeconds: '60',
    failuresBeforeDown: '3'
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configErrors, setConfigErrors] = useState<Record<string, string>>({});
  const [configSuccess, setConfigSuccess] = useState(false);

  // ── History ───────────────────────────────────────────────
  const [historyQuery, setHistoryQuery] = useState({
    fromDate: '',
    toDate: '',
    status: '',
    limit: '50',
    offset: 0
  });
  const [pollingHistory, setPollingHistory] = useState<PollingHistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ── History deletion (ADMIN) ──────────────────────────────
  const [showDeleteHistoryModal, setShowDeleteHistoryModal] = useState(false);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [deleteHistoryNotice, setDeleteHistoryNotice] = useState<string | null>(null);

  const fetchPollingStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    setNoConfig(false);
    const result = await apiService.getPollingStatus(deviceId);
    if (result.success && result.data) {
      const s = result.data;
      setPollingStatus(s);
      setConfigForm({
        intervalSeconds: String(s.intervalSeconds),
        failuresBeforeDown: String(s.failuresBeforeDown)
      });
    } else {
      const isNotFound =
        result.error?.toLowerCase().includes('no polling configuration') ||
        result.error?.toLowerCase().includes('not found');
      if (isNotFound) {
        setNoConfig(true);
        setPollingStatus(null);
      } else {
        setStatusError(result.error || 'Error al cargar el estado de sondeo');
      }
    }
    setStatusLoading(false);
  }, [deviceId]);

  useEffect(() => {
    fetchPollingStatus();
  }, [fetchPollingStatus]);

  const handlePollNow = async () => {
    setIsPolling(true);
    setPollResult(null);
    const result = await apiService.triggerPoll(deviceId);
    if (result.success && result.data) {
      setPollResult(result.data);
      fetchPollingStatus();
    } else if (result.status === 409) {
      // A device nobody is watching cannot be polled on demand: the reading
      // would sit there with nothing scheduled to correct it. Only reachable
      // if monitoring was turned off elsewhere while this tab was open — so
      // catch the card up first, then say why the click did nothing.
      await fetchPollingStatus();
      setStatusError('El monitoreo está deshabilitado para este dispositivo; habilítelo antes de sondearlo.');
    } else {
      setStatusError(result.error || 'Error en el sondeo');
    }
    setIsPolling(false);
  };

  /**
   * Turning monitoring on takes two writes: the device flag the rest of the UI
   * reads, and the polling config the scheduler reads. `POST .../polling/config`
   * upserts, so this both creates a missing config and re-enables a disabled
   * one, leaving any interval already stored untouched.
   */
  const handleEnableMonitoring = async () => {
    setIsEnabling(true);
    setConfigError(null);
    setConfigSuccess(false);

    const updated = await apiService.updateDevice(deviceId, { monitoringEnabled: true });
    if (!updated.success || !updated.data) {
      setConfigError(updated.error || 'Error al habilitar el monitoreo');
      setIsEnabling(false);
      return;
    }

    const config = await apiService.createPollingConfig(deviceId, {
      enabled: true,
      ipAddress: device.ipAddress,
    });
    if (!config.success) {
      setConfigError(config.error || 'Error al crear la configuración de sondeo');
    }

    onDeviceUpdated(updated.data);
    await fetchPollingStatus();
    setIsEnabling(false);
  };

  const handleSaveConfig = async () => {
    if (!hasIp) {
      setConfigError('El dispositivo necesita una dirección IP para configurar el sondeo.');
      return;
    }
    const errors = validatePollingConfigForm(configForm);
    setConfigErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(false);

    const intervalSeconds = configForm.intervalSeconds ? parseInt(configForm.intervalSeconds) : undefined;
    const failuresBeforeDown = configForm.failuresBeforeDown ? parseInt(configForm.failuresBeforeDown) : undefined;

    // The form is only reachable once monitoring is on, which implies a config
    // exists — creating one is "Habilitar Monitoreo"'s job.
    const result = await apiService.updatePollingConfig(deviceId, {
      intervalSeconds,
      failuresBeforeDown
    });

    if (result.success) {
      setConfigSuccess(true);
      setNoConfig(false);
      fetchPollingStatus();
    } else {
      setConfigError(result.error || 'Error al guardar la configuración');
    }
    setConfigSaving(false);
  };

  const fetchHistory = async (offset = 0) => {
    setHistoryLoading(true);
    setHistoryError(null);
    const result = await apiService.getPollingHistory(deviceId, {
      fromDate: historyQuery.fromDate ? toISOWithOffset(historyQuery.fromDate) : undefined,
      toDate: historyQuery.toDate ? toISOWithOffset(historyQuery.toDate, true) : undefined,
      status: historyQuery.status || undefined,
      limit: parseInt(historyQuery.limit),
      offset
    });
    if (result.success && result.data) {
      setPollingHistory(result.data);
      setHistoryQuery((prev) => ({ ...prev, offset }));
    } else {
      setHistoryError(result.error || 'Error al cargar el historial');
    }
    setHistoryLoading(false);
  };

  /**
   * The same window the history filters describe, so what is deleted is what
   * the operator is looking at. `status` is deliberately not passed on: the
   * route deletes by date only, and quietly ignoring a "solo fallidos" filter
   * would delete far more than the screen suggests.
   */
  const deleteWindow = {
    fromDate: historyQuery.fromDate ? toISOWithOffset(historyQuery.fromDate) : undefined,
    toDate: historyQuery.toDate ? toISOWithOffset(historyQuery.toDate, true) : undefined,
  };
  const deletesWholeHistory = !deleteWindow.fromDate && !deleteWindow.toDate;

  const handleDeleteHistory = async () => {
    setDeletingHistory(true);
    setHistoryError(null);
    setDeleteHistoryNotice(null);
    const result = await apiService.deletePollingHistory(deviceId, deleteWindow);
    setDeletingHistory(false);
    setShowDeleteHistoryModal(false);

    if (!result.success || !result.data) {
      setHistoryError(result.error || 'Error al eliminar el historial');
      return;
    }
    const { deletedCount } = result.data;
    setDeleteHistoryNotice(
      `Se eliminaron ${deletedCount} ${deletedCount === 1 ? 'registro' : 'registros'} de sondeo.`
    );
    // Re-reads what is left, from the first page: the rows the current offset
    // pointed at may well be the ones just deleted.
    await fetchHistory(0);
  };

  return (
    <div className="space-y-6">

      <ConfirmModal
        isOpen={showDeleteHistoryModal}
        onClose={() => setShowDeleteHistoryModal(false)}
        onConfirm={handleDeleteHistory}
        title="Eliminar historial de sondeo"
        message={
          deletesWholeHistory
            ? `Se eliminará TODO el historial de ping de ${device.name}, sin filtro de fechas. Es permanente y no se puede deshacer; las estadísticas de disponibilidad se pierden con él. Indica un rango en «Desde»/«Hasta» si solo quieres borrar una parte.`
            : `Se eliminarán permanentemente los registros de ping de ${device.name} entre ${
                historyQuery.fromDate || 'el inicio del historial'
              } y ${historyQuery.toDate || 'hoy'}. No se puede deshacer.`
        }
        confirmText="Eliminar historial"
        cancelText="Cancelar"
        variant="danger"
        isLoading={deletingHistory}
      />

      {/* Status */}
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Estado del Sondeo</h2>
            {!monitoringOff && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={fetchPollingStatus} disabled={statusLoading}>
                  Actualizar
                </Button>
                <Button size="sm" onClick={handlePollNow} isLoading={isPolling} disabled={!hasIp}>
                  Sondear Ahora
                </Button>
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {statusLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Cargando estado..." />
            </div>
          ) : statusError ? (
            <p className="text-red-600 dark:text-red-400 text-sm">{statusError}</p>
          ) : monitoringOff ? (
            <>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Este dispositivo no tiene el monitoreo habilitado, por lo que no se está sondeando.
                Habilítelo en «Configuración de Sondeo» para conocer su conectividad.
              </p>
              {/* Pausing here stops ICMP and nothing else: the radio keeps being
                  read on its own schedule, so an operator who thinks they have
                  stopped all polling has not. */}
              {isWirelessCategory(device.category) && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {WIRELESS_INDEPENDENT_OF_ICMP_NOTE} Para detenerlo, deshabilítalo en la pestaña «Inalámbrico».
                </p>
              )}
              {/* No schedule and no interval to show — only what the last poll, if
                  any, left behind. */}
              <dl className="wrap-anywhere grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-4">
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Estado Actual</dt>
                  <dd className="mt-1">
                    <Badge variant={getPollingStatusBadgeVariant('UNKNOWN')}>
                      {CONNECTIVITY_LABELS.UNKNOWN}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Sondeo Habilitado</dt>
                  <dd className="mt-1">
                    <Badge variant="neutral">No</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Último Sondeo</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">
                    {/* Stopping monitoring clears `lastPolled` — nothing is scheduled to
                        refresh it — but the last ping actually taken stays on record,
                        and that is the one worth dating here. */}
                    {lastPolledAt ? new Date(lastPolledAt).toLocaleString('es') : '—'}
                  </dd>
                </div>
              </dl>
            </>
          ) : pollingStatus ? (
            <>
              <dl className="wrap-anywhere grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Estado Actual</dt>
                  <dd className="mt-1">
                    <Badge variant={getPollingStatusBadgeVariant(pollingStatus.currentStatus)}>
                      {CONNECTIVITY_LABELS[pollingStatus.currentStatus] ?? pollingStatus.currentStatus}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Sondeo Habilitado</dt>
                  <dd className="mt-1">
                    <Badge variant={pollingStatus.pollingEnabled ? 'success' : 'neutral'}>
                      {pollingStatus.pollingEnabled ? 'Sí' : 'No'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Fallos Consecutivos</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{pollingStatus.consecutiveFailures}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Intervalo</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{pollingStatus.intervalSeconds}s</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Fallos Antes de Caída</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{pollingStatus.failuresBeforeDown}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Último Sondeo</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">
                    {pollingStatus.lastPolled ? new Date(pollingStatus.lastPolled).toLocaleString('es') : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Próximo Programado</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">
                    {pollingStatus.nextScheduled ? new Date(pollingStatus.nextScheduled).toLocaleString('es') : '—'}
                  </dd>
                </div>
              </dl>

              {pollResult && (
                <div className={`mt-4 p-3 rounded-md text-sm ${
                  pollResult.status === 'SUCCESS'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                }`}>
                  Resultado: <strong>{pollResult.status === 'SUCCESS' ? 'Exitoso' : 'Fallido'}</strong> — {pollResult.message}
                  {pollResult.metrics && ` (${pollResult.metrics.latencyMs}ms)`}
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Sin estado de sondeo disponible.</p>
          )}
        </Card.Body>
      </Card>

      {/* Config */}
      <Card>
        <Card.Header>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Configuración de Sondeo
          </h2>
        </Card.Header>
        <Card.Body>
          {!hasIp && !monitoringOff && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 mb-4 text-sm text-yellow-800 dark:text-yellow-400">
              Este dispositivo no tiene dirección IP. Asigne una en la pestaña «Detalles» para habilitar el sondeo.
            </div>
          )}
          {configError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-4 text-sm text-red-800 dark:text-red-400">
              {configError}
            </div>
          )}
          {configSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 mb-4 text-sm text-green-800 dark:text-green-400">
              Configuración guardada.
            </div>
          )}
          {monitoringOff ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                El monitoreo está deshabilitado, así que no hay configuración de sondeo que
                ajustar. Al habilitarlo se sondea el dispositivo periódicamente y podrá
                afinar el intervalo aquí mismo.
              </p>
              <div className="mt-4">
                <Button
                  onClick={handleEnableMonitoring}
                  isLoading={isEnabling}
                  disabled={!canEnableMonitoring(device.status, device.ipAddress)}
                >
                  Habilitar Monitoreo
                </Button>
              </div>
              {blockedReason && (
                <p className="mt-3 text-sm text-yellow-700 dark:text-yellow-500">{blockedReason}</p>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Intervalo (segundos)"
                  type="number"
                  min={POLLING_INTERVAL_MIN_SECONDS}
                  max={INTERVAL_MAX_SECONDS}
                  value={configForm.intervalSeconds}
                  onChange={(e) => {
                    setConfigForm((p) => ({ ...p, intervalSeconds: e.target.value }));
                    setConfigErrors((p) => { const n = { ...p }; delete n.intervalSeconds; return n; });
                  }}
                  error={configErrors.intervalSeconds}
                  fullWidth
                />
                <Input
                  label="Fallos Antes de Caída"
                  type="number"
                  min={FAILURES_BEFORE_DOWN_MIN}
                  max={FAILURES_BEFORE_DOWN_MAX}
                  value={configForm.failuresBeforeDown}
                  onChange={(e) => {
                    setConfigForm((p) => ({ ...p, failuresBeforeDown: e.target.value }));
                    setConfigErrors((p) => { const n = { ...p }; delete n.failuresBeforeDown; return n; });
                  }}
                  error={configErrors.failuresBeforeDown}
                  fullWidth
                />
              </div>
              <div className="mt-4">
                <Button onClick={handleSaveConfig} isLoading={configSaving} disabled={!hasIp}>
                  Guardar Configuración
                </Button>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* History */}
      <Card>
        <Card.Header>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Historial de Sondeo</h2>
        </Card.Header>
        <Card.Body>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Input
              label="Desde"
              type="date"
              value={historyQuery.fromDate}
              onChange={(e) => setHistoryQuery((p) => ({ ...p, fromDate: e.target.value }))}
              fullWidth
            />
            <Input
              label="Hasta"
              type="date"
              value={historyQuery.toDate}
              onChange={(e) => setHistoryQuery((p) => ({ ...p, toDate: e.target.value }))}
              fullWidth
            />
            <Select
              label="Estado"
              value={historyQuery.status}
              onChange={(e) => setHistoryQuery((p) => ({ ...p, status: e.target.value }))}
              options={[
                { value: '', label: 'Todos' },
                { value: 'SUCCESS', label: 'Exitoso' },
                { value: 'FAILED', label: 'Fallido' }
              ]}
              fullWidth
            />
            <Select
              label="Límite"
              value={historyQuery.limit}
              onChange={(e) => setHistoryQuery((p) => ({ ...p, limit: e.target.value }))}
              options={[
                { value: '20', label: '20' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
                { value: '500', label: '500' }
              ]}
              fullWidth
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => fetchHistory(0)} isLoading={historyLoading}>
              Obtener Historial
            </Button>
            {/* ADMIN only: one call drops tens of thousands of rows, and the
                retention sweep keeps running either way — this is the scoped,
                on-demand version of it. */}
            {isAdmin && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setShowDeleteHistoryModal(true)}
                disabled={deletingHistory}
              >
                {deletesWholeHistory ? 'Eliminar todo el historial' : 'Eliminar historial del rango'}
              </Button>
            )}
          </div>

          {historyError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{historyError}</p>
          )}

          {deleteHistoryNotice && (
            <p className="mt-3 text-sm text-green-700 dark:text-green-400">{deleteHistoryNotice}</p>
          )}

          {pollingHistory && (
            <div className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                {[
                  { label: 'Tasa de Éxito', value: `${pollingHistory.statistics.successRate.toFixed(1)}%` },
                  { label: 'Disponibilidad', value: `${pollingHistory.statistics.uptimePercentage.toFixed(1)}%` },
                  { label: 'Latencia Prom.', value: `${pollingHistory.statistics.averageResponseTime.toFixed(0)}ms` },
                  { label: 'Latencia Mín.', value: `${pollingHistory.statistics.minResponseTime.toFixed(0)}ms` },
                  { label: 'Latencia Máx.', value: `${pollingHistory.statistics.maxResponseTime.toFixed(0)}ms` }
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{value}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                      <th className="pb-2 pr-4 font-medium">Fecha/Hora</th>
                      <th className="pb-2 pr-4 font-medium">Estado</th>
                      <th className="pb-2 pr-4 font-medium">Latencia</th>
                      <th className="pb-2 font-medium">Dispositivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pollingHistory.results.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-400 dark:text-gray-500">
                          Sin resultados
                        </td>
                      </tr>
                    ) : (
                      pollingHistory.results.map((r) => (
                        <tr key={r.id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {new Date(r.timestamp).toLocaleString('es')}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant={r.status === 'SUCCESS' ? 'success' : 'danger'}>
                              {r.status === 'SUCCESS' ? 'Exitoso' : 'Fallido'}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 font-mono text-gray-900 dark:text-gray-100">
                            {r.metrics ? `${r.metrics.latencyMs}ms` : '—'}
                          </td>
                          <td className="py-2">
                            <Badge variant={getPollingStatusBadgeVariant(r.deviceStatus)}>
                              {CONNECTIVITY_LABELS[r.deviceStatus] ?? r.deviceStatus}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {pollingHistory.totalCount > parseInt(historyQuery.limit) && (
                <div className="flex justify-between items-center mt-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    {historyQuery.offset + 1}–{Math.min(
                      historyQuery.offset + parseInt(historyQuery.limit),
                      pollingHistory.totalCount
                    )} de {pollingHistory.totalCount}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={historyQuery.offset === 0}
                      onClick={() => fetchHistory(Math.max(0, historyQuery.offset - parseInt(historyQuery.limit)))}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={historyQuery.offset + parseInt(historyQuery.limit) >= pollingHistory.totalCount}
                      onClick={() => fetchHistory(historyQuery.offset + parseInt(historyQuery.limit))}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
