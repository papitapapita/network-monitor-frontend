/** Same shape the backend's `MutedAlertType.create` enforces (BACKEND_API.md, NOT-193). */
const METRIC_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export function validateMetricKey(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Escribe un identificador de métrica';
  if (!METRIC_KEY_REGEX.test(value)) {
    return 'Solo minúsculas, dígitos y guiones bajos, empezando por una letra';
  }
  return null;
}

/**
 * Known wireless-evaluator metrics (business-rules/wireless-monitoring.md,
 * WLS-081/WLS-082) plus the ICMP down/recovery type — labelled for the mute
 * picker. Not exhaustive and not enforced: the backend accepts any
 * well-formed key, matched or not (NOT-193), so the picker also takes free
 * text for anything missing here.
 */
export const KNOWN_MUTABLE_METRICS: Array<{ key: string; label: string }> = [
  { key: 'device_unreachable', label: 'Dispositivo no disponible (ICMP)' },
  { key: 'signal_rx_dbm', label: 'Señal recibida (dBm)' },
  { key: 'signal_tx_dbm', label: 'Señal transmitida (dBm)' },
  { key: 'snr_db', label: 'Relación señal-ruido (dB)' },
  { key: 'ccq_percent', label: 'Calidad de conexión CCQ (%)' },
  { key: 'cpu_load_percent', label: 'Carga de CPU (%)' },
  { key: 'memory_used_percent', label: 'Memoria usada (%)' },
  { key: 'lan_speed_mbps', label: 'Velocidad LAN (Mbps)' },
  { key: 'latency_ms', label: 'Latencia (ms)' },
  { key: 'capacity_kbps', label: 'Capacidad contratada (kbps)' },
  { key: 'distance_m', label: 'Distancia (m)' },
  { key: 'clock_drift_s', label: 'Desfase de reloj (s)' },
  { key: 'throughput_saturation', label: 'Saturación de throughput' },
  { key: 'clients_connected', label: 'Clientes conectados' },
  { key: 'ssid_changed', label: 'Cambio de SSID' },
  { key: 'mac_address_changed', label: 'Cambio de dirección MAC' },
  { key: 'device_model_changed', label: 'Cambio de modelo de dispositivo' },
  { key: 'remote_ap_mac_changed', label: 'Cambio de AP remoto' },
];

export function metricLabel(key: string): string {
  return KNOWN_MUTABLE_METRICS.find((m) => m.key === key)?.label ?? key;
}
