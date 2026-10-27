import type { BadgeVariant } from '@/components/ui';
import type { DeviceCategory, DeviceOwnerType, DeviceType } from '@/types/device.types';
import type { BackupFormat, BackupOutcome, BackupTrigger, ConfigBackupDTO } from '@/types/backup.types';

export const BACKUP_FORMAT_LABELS: Record<BackupFormat, string> = {
  AIROS_CFG: 'AirOS (system.cfg)',
  ROUTEROS_EXPORT: 'RouterOS (export)',
};

export const BACKUP_TRIGGER_LABELS: Record<BackupTrigger, string> = {
  SCHEDULED: 'Nocturno',
  MANUAL: 'Manual',
};

export const BACKUP_OUTCOME_LABELS: Record<BackupOutcome, { label: string; variant: BadgeVariant }> = {
  SAVED: { label: 'Configuración nueva guardada', variant: 'success' },
  UNCHANGED: { label: 'Sin cambios', variant: 'success' },
  FAILED: { label: 'Falló', variant: 'danger' },
};

const BACKED_UP_MODEL_TYPES: DeviceType[] = ['ROUTERBOARD', 'SWITCH'];

/**
 * Whether the device is one the nightly run backs up: a company device that
 * is an antenna (AP or station category) or a routerboard or switch by model
 * (BKP-010). A customer's device, one with no owner and a Wi-Fi router model
 * never are. The backend also counts a device wireless monitoring polls as an
 * antenna whatever its category; that case is missed here, and its manual
 * backup still works from the API.
 */
export const isBackupTarget = (
  owner: DeviceOwnerType | null | undefined,
  category: DeviceCategory | null | undefined,
  modelType: DeviceType | undefined
): boolean =>
  owner === 'COMPANY' &&
  (category === 'ACCESS_POINT' || category === 'WIRELESS_CPE' || (!!modelType && BACKED_UP_MODEL_TYPES.includes(modelType)));

export const formatBytes = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`;

/** The name the backend gives the file, for when its header is not readable across origins. */
export function backupFileName(deviceName: string, backup: ConfigBackupDTO): string {
  const iso = new Date(backup.takenAt).toISOString();
  const stamp = `${iso.slice(0, 10).replace(/-/g, '')}-${iso.slice(11, 16).replace(':', '')}Z`;
  const ext = backup.format === 'AIROS_CFG' ? 'cfg' : 'rsc';
  return `${deviceName}-${stamp}.${ext}`;
}

/**
 * The backend's reasons, word for word (DeviceConfigBackupService), in Spanish.
 * They come both after "Cannot back up this device: " / "Backup failed: " on a
 * manual backup and alone in `state.lastError`.
 */
const REASONS: Array<[string, string]> = [
  ['Only company antennas, routerboards and switches are backed up for now', 'Por ahora solo se respaldan las antenas, routerboards y switches de la empresa.'],
  ['Only access points, routers and switches are backed up for now', 'Por ahora solo se respaldan las antenas, routerboards y switches de la empresa.'],
  ['This server cannot reach the device, and it is not behind an on-site agent', 'El servidor está fuera del sitio y este equipo no está detrás de un agente. Asígnale uno en «Sondeado por».'],
  ['The device has no IP address', 'El equipo no tiene dirección IP.'],
  ['No HTTP credentials are configured for this device', 'El equipo no tiene credenciales HTTP. Agrégalas en la pestaña Credenciales.'],
  ['Backups are not supported for this kind of device from this vendor yet', 'Todavía no hay respaldo para este tipo de equipo de este fabricante.'],
  ['The on-site agent is not connected', 'El agente de este equipo no está conectado.'],
  ['must be updated to take backups', 'El agente de este equipo es anterior a la versión 0.5.0 y no toma respaldos. Actualízalo.'],
  ['did not answer in time', 'El agente no respondió a tiempo.'],
];

/** A reason in Spanish; one the backend words otherwise (a refused login, a timeout) comes back as it is. */
export function backupReason(raw: string): string {
  const reason = raw.replace(/^(Cannot back up this device|Backup failed): /, '');
  return REASONS.find(([en]) => reason.includes(en))?.[1] ?? reason;
}

/** What to tell the operator when «Respaldar ahora» did not save anything. */
export function backupNowFailure(status: number | undefined, error: string | undefined): string {
  const raw = error ?? '';
  if (status === 409) return `No se puede respaldar: ${backupReason(raw)}`;
  if (status === 502) return `El respaldo falló: ${backupReason(raw)}`;
  return raw || 'Error al respaldar el equipo';
}
