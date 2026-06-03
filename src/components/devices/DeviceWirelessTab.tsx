'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import {
  WirelessConfigDTO,
  WirelessStatusDTO,
  WirelessAlertDTO,
  WirelessClientDTO,
  WirelessDeviceType,
  CreateWirelessConfigDTO,
} from '@/types/wireless.types';
import { DeviceCategory } from '@/types/device.types';
import { Card, Button, Input, Select, LoadingSpinner, Badge } from '@/components/ui';

interface Props {
  deviceId: string;
  category: DeviceCategory | null;
  deviceIpAddress: string | null;
}

function fmt(val: number | null, unit: string, decimals = 1): string {
  if (val === null) return '—';
  return `${val.toFixed(decimals)} ${unit}`;
}

function fmtBps(val: number | null): string {
  if (val === null) return '—';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} Mbps`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} Kbps`;
  return `${val} bps`;
}

function fmtUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function signalBadgeVariant(dbm: number | null): 'success' | 'warning' | 'danger' | 'neutral' {
  if (dbm === null) return 'neutral';
  if (dbm >= -65) return 'success';
  if (dbm >= -75) return 'warning';
  return 'danger';
}

function alertSeverityVariant(severity: string): 'warning' | 'danger' {
  return severity === 'CRITICAL' ? 'danger' : 'warning';
}

function inferDeviceType(category: DeviceCategory | null): WirelessDeviceType {
  return category === 'AP' ? 'ACCESS_POINT' : 'CPE';
}

export function DeviceWirelessTab({ deviceId, category, deviceIpAddress }: Props) {
  const [config, setConfig] = useState<WirelessConfigDTO | null>(null);
  const [noConfig, setNoConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [status, setStatus] = useState<WirelessStatusDTO | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<WirelessAlertDTO[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState<string | null>(null);

  // Config form
  const [configForm, setConfigForm] = useState({
    intervalSecs: '3600',
    enabled: 'true',
    linkCapacityBps: '',
    clientsProvisionedLimit: '',
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaveError, setConfigSaveError] = useState<string | null>(null);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    setNoConfig(false);
    const result = await apiService.getWirelessConfig(deviceId);
    if (result.success && result.data) {
      const c = result.data;
      setConfig(c);
      setConfigForm({
        intervalSecs: String(c.intervalSecs),
        enabled: String(c.enabled),
        linkCapacityBps: c.linkCapacityBps !== null ? String(c.linkCapacityBps) : '',
        clientsProvisionedLimit: c.clientsProvisionedLimit !== null ? String(c.clientsProvisionedLimit) : '',
      });
    } else {
      if (result.error?.toLowerCase().includes('not found') || result.error?.toLowerCase().includes('404')) {
        setNoConfig(true);
      } else {
        setConfigError(result.error || 'Error al cargar configuración inalámbrica');
      }
    }
    setConfigLoading(false);
  }, [deviceId]);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    const result = await apiService.getWirelessStatus(deviceId);
    if (result.success && result.data) {
      setStatus(result.data);
    } else {
      setStatusError(result.error || 'Sin snapshot disponible');
    }
    setStatusLoading(false);
  }, [deviceId]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    const result = await apiService.getWirelessAlerts(deviceId);
    if (result.success && result.data) {
      setAlerts(result.data);
    }
    setAlertsLoading(false);
  }, [deviceId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      fetchStatus();
      fetchAlerts();
    }
  }, [config, fetchStatus, fetchAlerts]);

  const handlePollNow = async () => {
    setPolling(true);
    setPollMsg(null);
    const result = await apiService.triggerWirelessPoll(deviceId);
    if (result.success && result.data) {
      const r = result.data;
      setPollMsg(
        r.skipped
          ? 'Sondeo omitido (monitoreo deshabilitado)'
          : `Sondeo completado — métricas: ${r.metricsCollected ? 'sí' : 'no'}, alertas activadas: ${r.alertsTriggered}, resueltas: ${r.alertsCleared}`
      );
      fetchStatus();
      fetchAlerts();
    } else {
      setPollMsg(`Error: ${result.error}`);
    }
    setPolling(false);
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    setConfigSaveError(null);
    setConfigSaveSuccess(false);

    const payload = {
      ipAddress: deviceIpAddress,
      intervalSecs: configForm.intervalSecs ? parseInt(configForm.intervalSecs) : undefined,
      enabled: configForm.enabled === 'true',
      linkCapacityBps: configForm.linkCapacityBps ? parseInt(configForm.linkCapacityBps) : null,
      clientsProvisionedLimit: configForm.clientsProvisionedLimit ? parseInt(configForm.clientsProvisionedLimit) : null,
    };

    let result;
    if (noConfig) {
      const createPayload: CreateWirelessConfigDTO = {
        deviceType: inferDeviceType(category),
        ...payload,
      };
      result = await apiService.createWirelessConfig(deviceId, createPayload);
    } else {
      result = await apiService.updateWirelessConfig(deviceId, payload);
    }

    if (result.success) {
      setConfigSaveSuccess(true);
      setNoConfig(false);
      setShowConfigForm(false);
      fetchConfig();
    } else {
      setConfigSaveError(result.error || 'Error al guardar configuración');
    }
    setConfigSaving(false);
  };

  const handleDeleteConfig = async () => {
    const result = await apiService.deleteWirelessConfig(deviceId);
    if (result.success) {
      setConfig(null);
      setStatus(null);
      setAlerts([]);
      setNoConfig(true);
    }
  };

  const metrics = status?.metrics;
  const isAP = config?.deviceType === 'ACCESS_POINT' || category === 'AP';

  return (
    <div className="space-y-6">

      {/* Config card */}
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Configuración Inalámbrica</h2>
            {!noConfig && config && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowConfigForm((v) => !v)}>
                  {showConfigForm ? 'Cancelar' : 'Editar'}
                </Button>
                <Button size="sm" variant="danger" onClick={handleDeleteConfig}>
                  Eliminar
                </Button>
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {configLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner message="Cargando configuración..." />
            </div>
          ) : configError ? (
            <p className="text-red-600 dark:text-red-400 text-sm">{configError}</p>
          ) : noConfig ? (
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Este dispositivo no tiene configuración de monitoreo inalámbrico.
              </p>
              {!showConfigForm && (
                <Button size="sm" onClick={() => setShowConfigForm(true)}>
                  Crear Configuración
                </Button>
              )}
            </div>
          ) : config && !showConfigForm ? (
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Tipo</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {config.deviceType === 'ACCESS_POINT' ? 'Access Point' : 'CPE / Estación'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Habilitado</dt>
                <dd className="mt-1">
                  <Badge variant={config.enabled ? 'success' : 'neutral'}>
                    {config.enabled ? 'Sí' : 'No'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Intervalo</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{config.intervalSecs}s</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">IP</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{config.ipAddress ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Último sondeo</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">
                  {config.lastPolledAt ? new Date(config.lastPolledAt).toLocaleString('es') : '—'}
                </dd>
              </div>
              {config.linkCapacityBps !== null && (
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Cap. de enlace</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtBps(config.linkCapacityBps)}</dd>
                </div>
              )}
              {config.clientsProvisionedLimit !== null && (
                <div>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Límite clientes</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{config.clientsProvisionedLimit}</dd>
                </div>
              )}
            </dl>
          ) : null}

          {/* Config form (create or edit) */}
          {showConfigForm && (
            <div className="mt-4 space-y-4">
              {configSaveError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-sm text-red-800 dark:text-red-400">
                  {configSaveError}
                </div>
              )}
              {configSaveSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 text-sm text-green-800 dark:text-green-400">
                  Configuración guardada.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Intervalo (segundos)"
                  type="number"
                  value={configForm.intervalSecs}
                  onChange={(e) => setConfigForm((p) => ({ ...p, intervalSecs: e.target.value }))}
                  fullWidth
                />
                <Select
                  label="Habilitado"
                  value={configForm.enabled}
                  onChange={(e) => setConfigForm((p) => ({ ...p, enabled: e.target.value }))}
                  options={[
                    { value: 'true', label: 'Sí' },
                    { value: 'false', label: 'No' },
                  ]}
                  fullWidth
                />
                <Input
                  label="Capacidad de enlace (bps)"
                  type="number"
                  value={configForm.linkCapacityBps}
                  onChange={(e) => setConfigForm((p) => ({ ...p, linkCapacityBps: e.target.value }))}
                  fullWidth
                />
                {(noConfig ? inferDeviceType(category) === 'ACCESS_POINT' : isAP) && (
                  <Input
                    label="Límite de clientes provisionados"
                    type="number"
                    value={configForm.clientsProvisionedLimit}
                    onChange={(e) => setConfigForm((p) => ({ ...p, clientsProvisionedLimit: e.target.value }))}
                    fullWidth
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveConfig} isLoading={configSaving}>
                  {noConfig ? 'Crear Configuración' : 'Guardar Cambios'}
                </Button>
                <Button variant="outline" onClick={() => setShowConfigForm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Only show status/alerts/clients if config exists */}
      {config && (
        <>
          {/* Latest snapshot */}
          <Card>
            <Card.Header>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Métricas Actuales</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={fetchStatus} disabled={statusLoading}>
                    Actualizar
                  </Button>
                  <Button size="sm" onClick={handlePollNow} isLoading={polling}>
                    Sondear Ahora
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {statusLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner message="Cargando métricas..." />
                </div>
              ) : statusError ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">{statusError}</p>
              ) : metrics ? (
                <>
                  {pollMsg && (
                    <div className="mb-4 p-3 rounded-md text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                      {pollMsg}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Recopilado: {new Date(status!.collectedAt).toLocaleString('es')} — Método: {status!.collectionMethod}
                  </p>

                  {/* Signal section */}
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Señal</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Señal RX</dt>
                      <dd className="mt-1">
                        {metrics.signalRxDbm !== null ? (
                          <Badge variant={signalBadgeVariant(metrics.signalRxDbm)}>
                            {metrics.signalRxDbm} dBm
                          </Badge>
                        ) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Señal TX</dt>
                      <dd className="mt-1">
                        {metrics.signalTxDbm !== null ? (
                          <Badge variant={signalBadgeVariant(metrics.signalTxDbm)}>
                            {metrics.signalTxDbm} dBm
                          </Badge>
                        ) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Piso de ruido</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.noiseFloorDbm, 'dBm', 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">SNR</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.snrDb, 'dB', 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">CCQ</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.ccqPercent, '%', 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Frecuencia</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {metrics.frequencyMhz !== null ? `${metrics.frequencyMhz} MHz` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Ancho de canal</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {metrics.channelWidthMhz !== null ? `${metrics.channelWidthMhz} MHz` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Potencia TX</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.txPowerDbm, 'dBm', 0)}</dd>
                    </div>
                  </div>

                  {/* Throughput */}
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Rendimiento</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-6">
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Tasa TX</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.txRateMbps, 'Mbps')}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Tasa RX</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.rxRateMbps, 'Mbps')}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Throughput TX</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtBps(metrics.throughputTxBps)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Throughput RX</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtBps(metrics.throughputRxBps)}</dd>
                    </div>
                    {metrics.latencyMs !== null && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Latencia</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">{metrics.latencyMs} ms</dd>
                      </div>
                    )}
                    {metrics.distanceM !== null && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Distancia</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">{metrics.distanceM} m</dd>
                      </div>
                    )}
                  </div>

                  {/* System */}
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sistema</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">CPU</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.cpuLoadPercent, '%', 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Memoria</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(metrics.memoryUsedPercent, '%', 1)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Uptime</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmtUptime(metrics.uptimeSeconds)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400">Firmware</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100 text-xs">{metrics.firmwareVersion ?? '—'}</dd>
                    </div>
                    {metrics.lanStatus && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">LAN</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">
                          {metrics.lanStatus}
                          {metrics.lanSpeedMbps !== null ? ` / ${metrics.lanSpeedMbps} Mbps` : ''}
                          {metrics.lanDuplex ? ` ${metrics.lanDuplex}` : ''}
                        </dd>
                      </div>
                    )}
                    {metrics.remoteApName && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">AP Remoto</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">
                          {metrics.remoteApName}
                          {metrics.remoteApMac ? ` (${metrics.remoteApMac})` : ''}
                        </dd>
                      </div>
                    )}
                    {isAP && metrics.clientsConnected !== null && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Clientes conectados</dt>
                        <dd className="mt-1 text-gray-900 dark:text-gray-100">
                          {metrics.clientsConnected}
                          {metrics.clientsProvisioned !== null ? ` / ${metrics.clientsProvisioned}` : ''}
                        </dd>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Sin datos disponibles. Haga clic en &quot;Sondear Ahora&quot; para obtener métricas.
                </p>
              )}
            </Card.Body>
          </Card>

          {/* Active alerts */}
          <Card>
            <Card.Header>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Alertas Activas
                  {alerts.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-red-600 dark:text-red-400">
                      ({alerts.length})
                    </span>
                  )}
                </h2>
                <Button size="sm" variant="outline" onClick={fetchAlerts} disabled={alertsLoading}>
                  Actualizar
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {alertsLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner message="Cargando alertas..." />
                </div>
              ) : alerts.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Sin alertas activas.</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge variant={alertSeverityVariant(alert.severity)} className="mr-2">
                            {alert.severity}
                          </Badge>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {alert.message}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(alert.triggeredAt).toLocaleString('es')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Métrica: <code className="font-mono">{alert.metric}</code> — valor: {alert.lastValue}, umbral: {alert.threshold}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Clients (AP only) */}
          {isAP && status && status.clients.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Clientes Conectados ({status.clients.length})
                </h2>
              </Card.Header>
              <Card.Body>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                        <th className="pb-2 pr-4 font-medium">MAC</th>
                        <th className="pb-2 pr-4 font-medium">IP</th>
                        <th className="pb-2 pr-4 font-medium">Señal RX</th>
                        <th className="pb-2 pr-4 font-medium">SNR</th>
                        <th className="pb-2 pr-4 font-medium">Tasa TX</th>
                        <th className="pb-2 pr-4 font-medium">Tasa RX</th>
                        <th className="pb-2 font-medium">Uptime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {status.clients.map((client: WirelessClientDTO) => (
                        <tr key={client.macAddress} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-2 pr-4 font-mono text-xs text-gray-900 dark:text-gray-100">{client.macAddress}</td>
                          <td className="py-2 pr-4 font-mono text-xs text-gray-600 dark:text-gray-400">{client.ipAddress ?? '—'}</td>
                          <td className="py-2 pr-4">
                            {client.signalRxDbm !== null ? (
                              <Badge variant={signalBadgeVariant(client.signalRxDbm)}>
                                {client.signalRxDbm} dBm
                              </Badge>
                            ) : '—'}
                          </td>
                          <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{fmt(client.snrDb, 'dB', 1)}</td>
                          <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{fmt(client.txRateMbps, 'Mbps')}</td>
                          <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{fmt(client.rxRateMbps, 'Mbps')}</td>
                          <td className="py-2 text-gray-900 dark:text-gray-100">{fmtUptime(client.uptimeSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
