import type {
  RouterAuditFinding,
  RouterAuditFindingCode,
  RouterAuditPart,
  RouterHealthIssue,
  RouterHealthThresholdsValues,
} from '@/types/router-system.types';

/** MON-173: the value each open health alert is about. */
export const HEALTH_ISSUE_LABELS: Record<RouterHealthIssue, string> = {
  CPU: 'CPU alta',
  MEMORY: 'Poca memoria libre',
  DISK: 'Poco disco libre',
  TEMPERATURE: 'Temperatura alta',
  VOLTAGE: 'Voltaje bajo',
};

/** 93784 → "1 d 2 h", 7260 → "2 h 1 min". */
export function fmtUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

/** Used share of a total, e.g. "62 % de 1 GB"; null when the router gave neither. */
export function fmtUsed(free: number | null, total: number | null): string | null {
  if (free == null || total == null || total <= 0) return null;
  const used = Math.round(((total - free) / total) * 100);
  const gb = total / 1_073_741_824;
  const size = gb >= 1 ? `${gb.toLocaleString('es', { maximumFractionDigits: 1 })} GB` : `${Math.round(total / 1_048_576)} MB`;
  return `${used} % de ${size}`;
}

export const AUDIT_FINDING_LABELS: Record<RouterAuditFindingCode, string> = {
  FIRMWARE_BEHIND: 'Firmware RouterBOARD pendiente',
  PLAINTEXT_SERVICE: 'Servicio activo sin cifrar',
  UNRESTRICTED_SERVICE: 'Servicio abierto a cualquier dirección',
  ADMIN_USER: 'Usuario "admin" activo',
  DISCOVERY_ON_ALL_INTERFACES: 'Descubrimiento de vecinos en todas las interfaces',
};

/** What to do about each finding, behind the badge. */
export const AUDIT_FINDING_HINTS: Record<RouterAuditFindingCode, string> = {
  FIRMWARE_BEHIND: 'El RouterOS instalado trae un firmware más nuevo: /system routerboard upgrade y reiniciar.',
  PLAINTEXT_SERVICE: 'Telnet, FTP y WWW viajan sin cifrar: desactívalos en /ip service y usa SSH, SFTP o WWW-SSL.',
  UNRESTRICTED_SERVICE: 'Cualquier dirección puede intentar entrar: limita «Available From» en /ip service a la red de gestión.',
  ADMIN_USER: 'El nombre «admin» es el primero que se prueba: crea otro usuario administrador y desactiva este.',
  DISCOVERY_ON_ALL_INTERFACES: 'El router se anuncia también hacia los clientes: limita /ip neighbor discovery-settings a una lista de interfaces internas.',
};

/** The badge's text, naming the service and port where the finding has them. */
export function auditFindingText(f: RouterAuditFinding): string {
  if (f.code === 'PLAINTEXT_SERVICE' && f.service) {
    return `${f.service} activo sin cifrar${f.port != null ? ` (puerto ${f.port})` : ''}`;
  }
  if (f.code === 'UNRESTRICTED_SERVICE' && f.service) return `${f.service} abierto a cualquier dirección`;
  return AUDIT_FINDING_LABELS[f.code];
}

export const AUDIT_PART_LABELS: Record<RouterAuditPart, string> = {
  SERVICES: 'servicios',
  USERS: 'usuarios',
  DISCOVERY: 'descubrimiento',
};

/** MON-172, MON-196: what `PUT /routers/health-thresholds` accepts. */
export const ROUTER_HEALTH_LIMITS: Record<keyof RouterHealthThresholdsValues, { min: number; max: number; whole: boolean }> = {
  cpuPercent: { min: 50, max: 99, whole: true },
  minFreeMemoryPercent: { min: 1, max: 50, whole: true },
  minFreeDiskPercent: { min: 1, max: 50, whole: true },
  maxTemperatureC: { min: 40, max: 110, whole: true },
  minVoltage: { min: 5, max: 60, whole: false },
  flapLinkDowns: { min: 1, max: 100, whole: true },
  minSfpRxPowerDbm: { min: -40, max: 0, whole: false },
};
