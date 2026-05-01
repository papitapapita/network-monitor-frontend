'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import {
  PollingStatusDTO,
  PollingHistoryResponse,
  ManualPollResultDTO
} from '@/types/device.types';
import {
  Card,
  Button,
  Input,
  Select,
  LoadingSpinner,
  Badge,
  getPollingStatusBadgeVariant
} from '@/components/ui';

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

interface Props {
  deviceId: string;
}

export function DevicePollingTab({ deviceId }: Props) {
  // ── Status ────────────────────────────────────────────────
  const [pollingStatus, setPollingStatus] = useState<PollingStatusDTO | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [noConfig, setNoConfig] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollResult, setPollResult] = useState<ManualPollResultDTO | null>(null);

  // ── Config ────────────────────────────────────────────────
  const [configForm, setConfigForm] = useState({
    intervalSeconds: '60',
    failuresBeforeDown: '3'
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
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
    } else {
      setStatusError(result.error || 'Error en el sondeo');
    }
    setIsPolling(false);
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(false);

    const intervalSeconds = configForm.intervalSeconds ? parseInt(configForm.intervalSeconds) : undefined;
    const failuresBeforeDown = configForm.failuresBeforeDown ? parseInt(configForm.failuresBeforeDown) : undefined;

    let result;
    if (noConfig) {
      result = await apiService.createPollingConfig(deviceId, {
        intervalSeconds,
        failuresBeforeDown
      });
    } else {
      result = await apiService.updatePollingConfig(deviceId, {
        intervalSeconds,
        failuresBeforeDown
      });
    }

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

  return (
    <div className="space-y-6">

      {/* Status */}
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Estado del Sondeo</h2>
            {!noConfig && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={fetchPollingStatus} disabled={statusLoading}>
                  Actualizar
                </Button>
                <Button size="sm" onClick={handlePollNow} isLoading={isPolling}>
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
          ) : noConfig ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Este dispositivo aún no tiene configuración de sondeo. Configure una a continuación.
            </p>
          ) : pollingStatus ? (
            <>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
            {noConfig ? 'Crear Configuración de Sondeo' : 'Configuración de Sondeo'}
          </h2>
        </Card.Header>
        <Card.Body>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Intervalo (segundos)"
              type="number"
              value={configForm.intervalSeconds}
              onChange={(e) => setConfigForm((p) => ({ ...p, intervalSeconds: e.target.value }))}
              fullWidth
            />
            <Input
              label="Fallos Antes de Caída"
              type="number"
              value={configForm.failuresBeforeDown}
              onChange={(e) => setConfigForm((p) => ({ ...p, failuresBeforeDown: e.target.value }))}
              fullWidth
            />
          </div>
          <div className="mt-4">
            <Button onClick={handleSaveConfig} isLoading={configSaving}>
              {noConfig ? 'Crear Configuración' : 'Guardar Configuración'}
            </Button>
          </div>
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
          <Button size="sm" onClick={() => fetchHistory(0)} isLoading={historyLoading}>
            Obtener Historial
          </Button>

          {historyError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{historyError}</p>
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
