'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import { usePermissions } from '@/hooks/usePermissions';
import { useInstallation } from '@/hooks/useInstallation';
import { useToast } from '@/contexts/toast.context';
import { DeviceResponseDTO } from '@/types/device.types';
import { BackupDiffDTO, ConfigBackupDTO, DeviceBackupsDTO } from '@/types/backup.types';
import { Badge, Button, Card, LoadingSpinner, Modal, SectionTitle } from '@/components/ui';
import {
  BACKUPS_KEPT,
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

const LINE_STYLES = {
  context: 'text-gray-700 dark:text-gray-300',
  added: 'bg-green-50 text-green-900 dark:bg-green-900/30 dark:text-green-200',
  removed: 'bg-red-50 text-red-900 dark:bg-red-900/30 dark:text-red-200',
} as const;

const LINE_MARKS = { context: ' ', added: '+', removed: '-' } as const;

function DiffView({ diff }: { diff: BackupDiffDTO }) {
  if (diff.identical) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">Las dos versiones son iguales.</p>;
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium text-green-700 dark:text-green-400">+{diff.added}</span>{' '}
        <span className="font-medium text-red-700 dark:text-red-400">−{diff.removed}</span> líneas. Las contraseñas y
        claves se muestran como <code className="font-mono">********</code>: un cambio de contraseña aparece igual, como
        una línea quitada y otra agregada. Descarga el archivo para ver los valores reales.
      </p>
      {diff.hunks.map((hunk, i) => (
        <div key={i} className="rounded border border-gray-200 dark:border-gray-700 overflow-x-auto table-scroll-x">
          <div className="px-3 py-1 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
            @@ -{hunk.fromStart},{hunk.fromLines} +{hunk.toStart},{hunk.toLines} @@
          </div>
          <pre className="text-xs font-mono leading-5">
            {hunk.lines.map((line, j) => (
              <div key={j} className={`px-3 whitespace-pre ${LINE_STYLES[line.kind]}`}>
                {LINE_MARKS[line.kind]} {line.text}
              </div>
            ))}
          </pre>
        </div>
      ))}
    </div>
  );
}

/**
 * The device's configuration backups: taken every night from 03:00 when the
 * configuration changed, the newest 30 kept (BACKEND_API.md, Device Backups).
 * Everyone reads the list; an operator backs up now; the files and their
 * comparison hold the device's passwords, so only an administrator downloads
 * or compares them (`manage-credentials`, BKP-041, BKP-072).
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

  const [diffPair, setDiffPair] = useState<{ from: ConfigBackupDTO; to: ConfigBackupDTO } | null>(null);
  const [diff, setDiff] = useState<BackupDiffDTO | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

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
          ? 'Respaldo guardado como versión nueva.'
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

  const openDiff = async (from: ConfigBackupDTO, to: ConfigBackupDTO) => {
    setDiffPair({ from, to });
    setDiff(null);
    setDiffError(null);
    const r = await apiService.diffDeviceBackups(device.id, from.id, to.id);
    if (r.success && r.data) setDiff(r.data);
    else setDiffError(r.error || 'Error al comparar los respaldos');
  };

  const state = data?.state ?? null;
  const backups = data?.backups ?? [];
  const unreachable = !serverOnSite && !device.agentId;
  const outOfNightlyRun = device.status !== 'ACTIVE' && device.status !== 'COMMISSIONING';

  return (
    <Card>
      <Modal
        isOpen={!!diffPair}
        onClose={() => setDiffPair(null)}
        title="Cambios de configuración"
        size="xl"
      >
        {diffPair && (
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Del {fmt(diffPair.from.takenAt)} al {fmt(diffPair.to.takenAt)}
          </p>
        )}
        {diffError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{diffError}</p>
        ) : diff ? (
          <DiffView diff={diff} />
        ) : (
          <div className="flex justify-center py-6">
            <LoadingSpinner message="Comparando..." />
          </div>
        )}
      </Modal>

      <Card.Header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle
            info={`Cada noche desde las 3:00 (hora de Colombia) se lee la configuración del equipo y se guarda una versión nueva solo si cambió. Se conservan las ${BACKUPS_KEPT} más recientes. Por ahora: Ubiquiti AirOS por HTTPS y MikroTik por SSH.`}
          >
            Respaldos de configuración
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

            {backups.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Todavía no hay versiones guardadas.</p>
            ) : (
              <div className="overflow-x-auto table-scroll-x">
                <table className="min-w-full text-sm" aria-label="Versiones guardadas">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-4 font-medium">Guardada</th>
                      <th className="py-2 pr-4 font-medium">Vigente hasta</th>
                      <th className="py-2 pr-4 font-medium">Origen</th>
                      <th className="py-2 pr-4 font-medium">Formato</th>
                      <th className="py-2 pr-4 font-medium">Tamaño</th>
                      {canSeeFiles && <th className="py-2 font-medium"><span className="sr-only">Acciones</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup, i) => {
                      // Newest first: the version before this one is the next row.
                      const previous = backups.slice(i + 1).find((b) => b.format === backup.format);
                      return (
                        <tr key={backup.id} className="border-b border-gray-100 dark:border-gray-700/50 text-gray-900 dark:text-gray-100">
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {fmt(backup.takenAt)}
                            {i === 0 && <Badge variant="info" className="ml-2">Actual</Badge>}
                          </td>
                          <td className="py-2 pr-4 whitespace-nowrap" title="La última vez que el equipo seguía con esta configuración">
                            {fmt(backup.lastCheckedAt)}
                          </td>
                          <td className="py-2 pr-4">{BACKUP_TRIGGER_LABELS[backup.trigger]}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">{BACKUP_FORMAT_LABELS[backup.format]}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">{formatBytes(backup.sizeBytes)}</td>
                          {canSeeFiles && (
                            <td className="py-2">
                              <div className="flex justify-end gap-2">
                                {previous && (
                                  <Button size="sm" variant="outline" onClick={() => openDiff(previous, backup)}>
                                    Ver cambios
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => download(backup)}
                                  isLoading={downloadingId === backup.id}
                                  aria-label={`Descargar respaldo del ${fmt(backup.takenAt)}`}
                                >
                                  Descargar
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {canSeeFiles && backups.length > 0 && (
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
