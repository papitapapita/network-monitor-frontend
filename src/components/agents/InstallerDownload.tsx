'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useInstallation } from '@/hooks/useInstallation';
import { InstallerDTO, InstallerPlatform } from '@/types/installation.types';
import { Button } from '@/components/ui';

const formatSize = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

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

/** The installers the vendor placed on the server (INS-042), newest first. */
export function useInstallers() {
  const { installersAvailable } = useInstallation();
  return useQuery({
    queryKey: ['installation', 'installers'],
    queryFn: async (): Promise<InstallerDTO[]> => {
      const r = await apiService.listInstallers();
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los instaladores');
      return r.data.installers;
    },
    enabled: installersAvailable,
  });
}

interface InstallerDownloadProps {
  platform: InstallerPlatform;
  /** Shown instead of a button when there is nothing to download. */
  fallbackFileName: string;
}

/**
 * The newest installer for a platform. The route needs the session token, so
 * it is fetched and saved as a blob rather than linked; the file is tens of
 * megabytes, so the button shows how far along it is.
 */
export function InstallerDownload({ platform, fallbackFileName }: InstallerDownloadProps) {
  const { data: installers, isLoading, error } = useInstallers();
  const [progress, setProgress] = useState<number | null | undefined>(undefined);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const installer = installers?.find((i) => i.platform === platform);
  const fallback = (
    <code className="rounded bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 font-mono text-xs text-gray-800 dark:text-gray-200 wrap-anywhere">
      {fallbackFileName}
    </code>
  );

  if (isLoading) return <span className="text-gray-500 dark:text-gray-400">Buscando el instalador…</span>;
  if (error || !installer) {
    return (
      <>
        Consigue {fallback}
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {error ? 'No se pudo consultar la lista de instaladores.' : 'El servidor no tiene este instalador; pídeselo al proveedor.'}
        </span>
      </>
    );
  }

  const downloading = progress !== undefined;
  const download = async () => {
    setDownloadError(null);
    setProgress(0);
    const result = await apiService.downloadInstaller(installer.fileName, setProgress);
    setProgress(undefined);
    if (result.success && result.data) saveBlob(result.data, installer.fileName);
    else setDownloadError(result.error || 'No se pudo descargar el instalador');
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={download} isLoading={downloading} disabled={downloading}>
          {downloading
            ? progress === null
              ? 'Descargando…'
              : `Descargando… ${Math.round(progress * 100)} %`
            : `Descargar ${installer.version ? `v${installer.version}` : installer.fileName}`}
        </Button>
        <span className="text-xs text-gray-500 dark:text-gray-400 wrap-anywhere">
          {installer.fileName} · {formatSize(installer.sizeBytes)}
        </span>
      </span>
      {downloadError && <span className="text-xs text-red-700 dark:text-red-400">{downloadError}</span>}
    </span>
  );
}
