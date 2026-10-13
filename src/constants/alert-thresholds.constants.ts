import { AlertThresholdsDTO } from '@/types/alert-thresholds.types';

export type SeverityGroupKey = 'signalDbm' | 'snrDb' | 'ccqPercent' | 'latencyMs';
export type SingleGroupKey = 'cpuPercent' | 'memoryPercent' | 'clockDriftSeconds' | 'saturationPercent' | 'clientDropPercent';
export type WidthGroupKey = 'minCapacityMbps' | 'maxDistanceKm';
export type ThresholdGroupKey = keyof AlertThresholdsDTO;

interface GroupMeta {
  label: string;
  unit: string;
  min: number;
  max: number;
  info: string;
}

/** The two-severity groups. Every one but latency warns above its critical value. */
export const SEVERITY_GROUPS: Record<SeverityGroupKey, GroupMeta & { warningBelow: boolean }> = {
  signalDbm: { label: 'Señal', unit: 'dBm', min: -100, max: -40, warningBelow: false, info: 'Alerta cuando la señal Rx o Tx cae por debajo. Se limpia 2 dB por encima.' },
  snrDb: { label: 'SNR', unit: 'dB', min: 1, max: 60, warningBelow: false, info: 'Alerta cuando la relación señal/ruido cae por debajo. Se limpia 2 dB por encima.' },
  ccqPercent: { label: 'CCQ', unit: '%', min: 1, max: 95, warningBelow: false, info: 'Solo radios AirOS serie M. Se limpia 3 % (advertencia) o 5 % (crítica) por encima.' },
  latencyMs: { label: 'Latencia', unit: 'ms', min: 1, max: 10000, warningBelow: true, info: 'Alerta cuando la latencia supera el valor.' },
};

export const SINGLE_GROUPS: Record<SingleGroupKey, GroupMeta> = {
  cpuPercent: { label: 'CPU', unit: '%', min: 10, max: 99, info: 'Uso de CPU del radio. Se limpia 5 % por debajo.' },
  memoryPercent: { label: 'Memoria', unit: '%', min: 10, max: 99, info: 'Uso de memoria del radio. Se limpia 5 % por debajo.' },
  clockDriftSeconds: { label: 'Desfase de reloj', unit: 's', min: 10, max: 86400, info: 'Diferencia entre el reloj del radio y el del servidor.' },
  saturationPercent: { label: 'Saturación', unit: '%', min: 10, max: 100, info: 'Parte de la capacidad del enlace en uso.' },
  clientDropPercent: { label: 'Caída de clientes', unit: '%', min: 10, max: 90, info: 'Parte de los clientes de un AP perdidos entre dos sondeos.' },
};

export const WIDTH_GROUPS: Record<WidthGroupKey, GroupMeta & { decimals: boolean }> = {
  minCapacityMbps: { label: 'Capacidad mínima', unit: 'Mbps', min: 1, max: 10000, decimals: false, info: 'Capacidad por debajo de la cual se alerta, según el ancho de canal. Un ancho sin valor no se revisa.' },
  maxDistanceKm: { label: 'Distancia máxima', unit: 'km', min: 0.1, max: 200, decimals: true, info: 'Distancia del enlace por encima de la cual se alerta, según el ancho de canal. Un ancho sin valor no se revisa.' },
};

/** The channel widths (MHz) a width table may carry. */
export const CHANNEL_WIDTHS = ['5', '10', '20', '30', '40', '50', '60', '80', '160'] as const;

export const GROUP_ORDER: ThresholdGroupKey[] = [
  'signalDbm', 'snrDb', 'ccqPercent', 'latencyMs',
  'cpuPercent', 'memoryPercent', 'clockDriftSeconds', 'saturationPercent', 'clientDropPercent',
  'minCapacityMbps', 'maxDistanceKm',
];

export const isSeverityGroup = (k: ThresholdGroupKey): k is SeverityGroupKey => k in SEVERITY_GROUPS;
export const isWidthGroup = (k: ThresholdGroupKey): k is WidthGroupKey => k in WIDTH_GROUPS;

// ── Draft: every value as the text the input holds ───────────

export type WidthRow = { width: string; value: string };

export interface ThresholdsDraft {
  signalDbm: { warning: string; critical: string };
  snrDb: { warning: string; critical: string };
  ccqPercent: { warning: string; critical: string };
  latencyMs: { warning: string; critical: string };
  cpuPercent: string;
  memoryPercent: string;
  clockDriftSeconds: string;
  saturationPercent: string;
  clientDropPercent: string;
  minCapacityMbps: WidthRow[];
  maxDistanceKm: WidthRow[];
}

const byWidth = (a: WidthRow, b: WidthRow) => Number(a.width) - Number(b.width);

export const widthRows = (table: Record<string, number>): WidthRow[] =>
  Object.entries(table).map(([width, value]) => ({ width, value: String(value) })).sort(byWidth);

const sev = (s: { warning: number; critical: number }) => ({ warning: String(s.warning), critical: String(s.critical) });

export const toThresholdsDraft = (t: AlertThresholdsDTO): ThresholdsDraft => ({
  signalDbm: sev(t.signalDbm),
  snrDb: sev(t.snrDb),
  ccqPercent: sev(t.ccqPercent),
  latencyMs: sev(t.latencyMs),
  cpuPercent: String(t.cpuPercent),
  memoryPercent: String(t.memoryPercent),
  clockDriftSeconds: String(t.clockDriftSeconds),
  saturationPercent: String(t.saturationPercent),
  clientDropPercent: String(t.clientDropPercent),
  minCapacityMbps: widthRows(t.minCapacityMbps),
  maxDistanceKm: widthRows(t.maxDistanceKm),
});

/** Only valid once `validateThresholdsDraft` found nothing wrong. */
export const fromThresholdsDraft = (d: ThresholdsDraft): AlertThresholdsDTO => {
  const sevNum = (s: { warning: string; critical: string }) => ({ warning: Number(s.warning), critical: Number(s.critical) });
  const table = (rows: WidthRow[]) => Object.fromEntries(rows.map((r) => [r.width, Number(r.value)]));
  return {
    signalDbm: sevNum(d.signalDbm),
    snrDb: sevNum(d.snrDb),
    ccqPercent: sevNum(d.ccqPercent),
    latencyMs: sevNum(d.latencyMs),
    cpuPercent: Number(d.cpuPercent),
    memoryPercent: Number(d.memoryPercent),
    clockDriftSeconds: Number(d.clockDriftSeconds),
    saturationPercent: Number(d.saturationPercent),
    clientDropPercent: Number(d.clientDropPercent),
    minCapacityMbps: table(d.minCapacityMbps),
    maxDistanceKm: table(d.maxDistanceKm),
  };
};

// ── Validation: the backend's rules, so a refusal never needs the round trip ──

/** Field path (`signalDbm.warning`, `maxDistanceKm.40`, `cpuPercent`) → message. */
export type ThresholdErrors = Record<string, string>;

function checkNumber(raw: string, min: number, max: number, decimals: boolean): string | null {
  const text = raw.trim();
  if (!text) return 'Obligatorio.';
  const n = Number(text);
  if (!Number.isFinite(n)) return 'Debe ser un número.';
  if (!decimals && !Number.isInteger(n)) return 'Debe ser un número entero.';
  if (n < min || n > max) return `Debe estar entre ${min} y ${max}.`;
  return null;
}

export function validateGroup(key: ThresholdGroupKey, d: ThresholdsDraft, errors: ThresholdErrors): void {
  if (isSeverityGroup(key)) {
    const meta = SEVERITY_GROUPS[key];
    const { warning, critical } = d[key];
    const w = checkNumber(warning, meta.min, meta.max, false);
    const c = checkNumber(critical, meta.min, meta.max, false);
    if (w) errors[`${key}.warning`] = w;
    if (c) errors[`${key}.critical`] = c;
    if (!w && !c) {
      const wn = Number(warning);
      const cn = Number(critical);
      if (meta.warningBelow ? wn >= cn : wn <= cn) {
        errors[`${key}.warning`] = meta.warningBelow
          ? 'La advertencia debe ser menor que la crítica.'
          : 'La advertencia debe ser mayor que la crítica.';
      }
    }
  } else if (isWidthGroup(key)) {
    const meta = WIDTH_GROUPS[key];
    for (const row of d[key]) {
      const e = checkNumber(row.value, meta.min, meta.max, meta.decimals);
      if (e) errors[`${key}.${row.width}`] = e;
    }
  } else {
    const meta = SINGLE_GROUPS[key];
    const e = checkNumber(d[key], meta.min, meta.max, false);
    if (e) errors[key] = e;
  }
}

export function validateThresholdsDraft(d: ThresholdsDraft, groups: ThresholdGroupKey[] = GROUP_ORDER): ThresholdErrors {
  const errors: ThresholdErrors = {};
  for (const key of groups) validateGroup(key, d, errors);
  return errors;
}
