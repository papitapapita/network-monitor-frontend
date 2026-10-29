'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Badge, Card, ErrorBanner, IconButton, LoadingSpinner, RefreshIcon } from '@/components/ui';
import { useNow } from '@/hooks/useWirelessThroughput';
import { fmtAge } from '@/constants/wireless.constants';
import { translateRouterReason } from '@/constants/port-speed.constants';
import {
  AUDIT_FINDING_HINTS,
  AUDIT_FINDING_LABELS,
  AUDIT_PART_LABELS,
  auditFindingText,
} from '@/constants/router-system.constants';
import type { RouterAuditDTO, RouterAuditFindingCode } from '@/types/router-system.types';

const CODES = Object.keys(AUDIT_FINDING_LABELS) as RouterAuditFindingCode[];

function Findings({ r }: { r: RouterAuditDTO }) {
  if (!r.readAt) {
    return <span className="text-gray-600 dark:text-gray-400">{r.reason ? translateRouterReason(r.reason) : 'Aún no leído'}</span>;
  }
  if (r.findings.length === 0 && r.unchecked.length === 0) {
    return <Badge variant="success">Sin hallazgos</Badge>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {r.findings.map((f, i) => (
        <span key={i} title={AUDIT_FINDING_HINTS[f.code]}>
          <Badge variant={f.code === 'FIRMWARE_BEHIND' ? 'warning' : 'danger'}>{auditFindingText(f)}</Badge>
        </span>
      ))}
      {r.unchecked.length > 0 && (
        <span title="Normalmente al usuario de la API le falta una política para leerlo.">
          <Badge variant="neutral">No se pudo revisar: {r.unchecked.map((p) => AUDIT_PART_LABELS[p]).join(' / ')}</Badge>
        </span>
      )}
    </span>
  );
}

/**
 * Versions and what is worth fixing on each MikroTik (`GET /routers/audit`,
 * MON-180 … MON-186), judged from each router's last reading; nothing here
 * raises a notice. Oldest RouterOS first, as the backend sorts them. The
 * chips narrow the list to one kind of finding, to fix it across routers.
 */
export function RouterAuditTable() {
  const now = useNow(30_000, true);
  const [only, setOnly] = useState<RouterAuditFindingCode | null>(null);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['routerAudit'],
    queryFn: async () => {
      const r = await apiService.getRouterAudit();
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al cargar la auditoría');
      return r.data;
    },
  });

  const routers = data?.routers ?? [];
  const counts = Object.fromEntries(
    CODES.map((c) => [c, routers.filter((r) => r.findings.some((f) => f.code === c)).length])
  ) as Record<RouterAuditFindingCode, number>;
  const shown = only ? routers.filter((r) => r.findings.some((f) => f.code === only)) : routers;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {CODES.filter((c) => counts[c] > 0).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={only === c}
              onClick={() => setOnly(only === c ? null : c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                only === c
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {AUDIT_FINDING_LABELS[c]} · {counts[c]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {dataUpdatedAt > 0 && <span>Actualizado a las {new Date(dataUpdatedAt).toLocaleTimeString('es')}</span>}
          <IconButton icon={isFetching ? null : <RefreshIcon />} label="Actualizar" size="sm" onClick={() => refetch()} isLoading={isFetching} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Cargando auditoría..." />
        </div>
      ) : error ? (
        <ErrorBanner message={(error as Error).message} />
      ) : routers.length === 0 ? (
        <Card>
          <Card.Body>
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No hay routers MikroTik de la empresa.</p>
          </Card.Body>
        </Card>
      ) : (
        <div className="overflow-x-auto table-scroll-x rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="min-w-full text-sm" aria-label="Auditoría de routers">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 px-3 font-medium">Router</th>
                <th className="py-2 px-3 font-medium">RouterOS</th>
                <th className="py-2 px-3 font-medium">Firmware</th>
                <th className="py-2 px-3 font-medium">Hallazgos</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.deviceId} className="border-t border-gray-100 dark:border-gray-700/50 align-top">
                  <td className="py-2 px-3 min-w-44">
                    <Link href={`/devices/${r.deviceId}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
                      {r.name}
                    </Link>
                    {r.ipAddress && <span className="block font-mono text-xs text-gray-500 dark:text-gray-400">{r.ipAddress}</span>}
                    {r.readAt && (
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        revisado {fmtAge(Math.max(0, (now - new Date(r.readAt).getTime()) / 1000))}
                      </span>
                    )}
                    {r.lastError && (
                      <span className="block max-w-xs text-xs text-red-600 dark:text-red-400 wrap-anywhere">
                        {translateRouterReason(r.lastError)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.routerOsVersion ?? '—'}</td>
                  <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {r.currentFirmware ?? '—'}
                    {r.currentFirmware && r.upgradeFirmware && r.currentFirmware !== r.upgradeFirmware && (
                      <span className="text-amber-700 dark:text-amber-400"> → {r.upgradeFirmware}</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Findings r={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
