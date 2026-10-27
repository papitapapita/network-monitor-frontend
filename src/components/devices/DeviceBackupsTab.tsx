'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useInstallation } from '@/hooks/useInstallation';
import { useToast } from '@/contexts/toast.context';
import { DeviceResponseDTO } from '@/types/device.types';
import { ConfigBackupDTO, DeviceBackupsDTO } from '@/types/backup.types';
import { Badge, Button, Card, LoadingSpinner, SectionTitle } from '@/components/ui';
import {
  BACKUP_FORMAT_LABELS,
  BACKUP_OUTCOME_LABELS,
  BACKUP_TRIGGER_LABELS,
  backupFileName,
  backupNowFailure,
  backupReason,
  formatBytes,
} from '@/constants/backup.constants';

interface Props {
  device: DeviceResponseDTO;
}

const fmt = (iso: string | null): string => (iso ? new Date(iso).toLocaleString('es') : '—');

/** Hands a downloaded blob to the browser as a file, the way bill PDFs are saved. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * The device's configuration backup: read every night from 03:00, and only
 * the latest configuration is kept, one copy per device (BACKEND_API.md,
 * Device Backups, BKP-030). Everyone reads it; an operator backs up now; the
 * file holds the device's passwords, so only an administrator downloads it
 * (`manage-credentials`, BKP-041).
 */
export function DeviceBackupsTab({ device }: Props) {
  const permissions = usePermissions();
  const canBackUp = permissions.canWrite;
  const canSeeFiles = permissions.isAdmin;
  const { serverOnSite } = useInstallation();
  const { showError, showSuccess } = useToast();

  const [data, setData] = useState<DeviceBackupsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoadError(null);
    const r = await apiService.listDeviceBackups(device.id);
    if (r.success && r.data) setData(r.data);
    else setLoadError(r.error || 'Error al cargar los respaldos');
    setLoading(false);
  }, [device.id]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const backUpNow = async () => {
    setBackingUp(true);
    const r = await apiService.backUpDevice(device.id);
    setBackingUp(false);
    if (r.success && r.data) {
      showSuccess(
        r.data.outcome === 'SAVED'
          ? 'Respaldo guardado: la configuración cambió y reemplazó la copia anterior.'
          : 'Sin cambios: el equipo conserva la configuración del último respaldo.'
      );
    } else {
      showError(backupNowFailure(r.status, r.error));
    }
    // Every attempt, refused or failed, updates the state. Through an agent a
    // large router can outlast the proxy's 30 s, and the attempt still lands,
    // so the list is read again whatever came back.
    fetchBackups();
  };

  const download = async (backup: ConfigBackupDTO) => {
    setDownloadingId(backup.id);
    const r = await apiService.downloadDeviceBackup(device.id, backup.id);
    setDownloadingId(null);
    if (r.success && r.data) saveBlob(r.data.blob, r.data.fileName || backupFileName(device.name, backup));
    else showError(r.error || 'Error al descargar el respaldo');
  };

  const state = data?.state ?? null;
  const backup = data?.backups[0] ?? null;
  const unreachable = !serverOnSite && !device.agentId;
  const outOfNightlyRun = device.status !== 'ACTIVE' && device.status !== 'COMMISSIONING';

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            info="Cada noche desde las 3:00 (hora de Colombia) se lee la configuración del equipo; si cambió, reemplaza la copia guardada. Se conserva solo la última. Se respaldan las antenas, routerboards y switches de la empresa. Por ahora: Ubiquiti AirOS por HTTPS y MikroTik por SSH."
          >
            Respaldo de configuración
          </SectionTitle>
          {canBackUp && (
            <Button size="sm" onClick={backUpNow} isLoading={backingUp} disabled={unreachable}>
              Respaldar ahora
            </Button>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {loading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner message="Cargando respaldos..." />
          </div>
        ) : loadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        ) : (
          <div className="space-y-5">
            {unreachable ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                El servidor está fuera del sitio y este equipo no está detrás de un agente, así que no se respalda.
                Asígnale un agente en «Sondeado por» (pestaña Sondeo).
              </p>
            ) : outOfNightlyRun ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                El respaldo nocturno solo incluye equipos activos o en instalación; este solo se respalda a mano.
              </p>
            ) : null}

            {state && state.lastOutcome === 'FAILED' && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
                <p className="font-medium">
                  {state.consecutiveFailures === 1
                    ? 'El último intento falló'
                    : `${state.consecutiveFailures} intentos fallidos seguidos`}
                  {state.failingSince ? `, desde el ${fmt(state.failingSince)}` : ''}.
                </p>
                {state.lastError && <p className="mt-1">{backupReason(state.lastError)}</p>}
              </div>
            )}

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Último intento</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 text-gray-900 dark:text-gray-100">
                  {state?.lastAttemptAt ? (
                    <>
                      {fmt(state.lastAttemptAt)}
                      {state.lastOutcome && (
                        <Badge variant={BACKUP_OUTCOME_LABELS[state.lastOutcome].variant}>
                          {BACKUP_OUTCOME_LABELS[state.lastOutcome].label}
                        </Badge>
                      )}
                    </>
                  ) : (
                    'Nunca se ha intentado'
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500 dark:text-gray-400">Último respaldo correcto</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(state?.lastSuccessAt ?? null)}</dd>
              </div>
            </dl>

            {!backup ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Todavía no hay una copia guardada.</p>
            ) : (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm flex-1 min-w-0">
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Configuración guardada</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {fmt(backup.takenAt)}{' '}
                        <span className="text-gray-500 dark:text-gray-400">({BACKUP_TRIGGER_LABELS[backup.trigger].toLowerCase()})</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400" title="La última vez que el equipo seguía con esta configuración">
                        Vigente al
                      </dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">{fmt(backup.lastCheckedAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-500 dark:text-gray-400">Formato</dt>
                      <dd className="mt-1 text-gray-900 dark:text-gray-100">
                        {BACKUP_FORMAT_LABELS[backup.format]} · {formatBytes(backup.sizeBytes)}
                      </dd>
                    </div>
                  </dl>
                  {canSeeFiles && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => download(backup)}
                      isLoading={downloadingId === backup.id}
                      aria-label={`Descargar respaldo del ${fmt(backup.takenAt)}`}
                    >
                      Descargar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {canSeeFiles && backup && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                El archivo contiene las contraseñas y claves inalámbricas del equipo. Un .cfg se carga en AirOS con
                «Upload configuration»; un .rsc, en RouterOS con /import.
              </p>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
