'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Badge, Card, ErrorBanner, IconButton, LoadingSpinner, RefreshIcon } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { useNow } from '@/hooks/useWirelessThroughput';
import { fmtAge } from '@/constants/wireless.constants';
import { translateRouterReason } from '@/constants/port-speed.constants';
import { HEALTH_ISSUE_LABELS, fmtUptime, fmtUsed } from '@/constants/router-system.constants';
import type { RouterHealthIssue, RouterSystemDTO, RouterSystemListDTO } from '@/types/router-system.types';

export const ROUTER_SYSTEM_QUERY_KEY = ['routerSystem'] as const;

const fmtDate = (iso: string) => new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
const fmtNumber = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 });

/** A value an open health alert is about: red, with the alert's name on hover. */
function Value({ issue, issues, children }: { issue?: RouterHealthIssue; issues: RouterHealthIssue[]; children: React.ReactNode }) {
  if (children == null) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  if (issue && issues.includes(issue)) {
    return (
      <span title={HEALTH_ISSUE_LABELS[issue]}>
        <Badge variant="danger">{children}</Badge>
      </span>
    );
  }
  return <>{children}</>;
}

function RouterRow({ r, now, onRead, reading }: { r: RouterSystemDTO; now: number; onRead: () => void; reading: boolean }) {
  const s = r.system;
  const identityDiffers = !!s?.identity && s.identity !== r.name;
  const firmwarePending = !!s?.currentFirmware && !!s.upgradeFirmware && s.currentFirmware !== s.upgradeFirmware;
  return (
    <tr id={r.deviceId} className="border-t border-gray-100 dark:border-gray-700/50 align-top scroll-mt-4 target:bg-brand-50 dark:target:bg-brand-900/20">
      <td className="py-2 px-3 min-w-44">
        <Link href={`/devices/${r.deviceId}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
          {r.name}
        </Link>
        {s?.identity && (
          <span
            className={`block text-xs ${identityDiffers ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}
            title={identityDiffers ? 'El router se llama a sí mismo distinto que en la app' : 'Nombre en el router'}
          >
            {s.identity}
          </span>
        )}
        {r.ipAddress && <span className="block font-mono text-xs text-gray-500 dark:text-gray-400">{r.ipAddress}</span>}
        {r.lastError && (
          <span className="block max-w-xs text-xs text-red-600 dark:text-red-400 wrap-anywhere">{translateRouterReason(r.lastError)}</span>
        )}
      </td>
      {!s ? (
        <td colSpan={7} className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">
          {r.reason ? translateRouterReason(r.reason) : r.lastError ? 'Nunca se pudo leer.' : 'Aún no leído.'}
        </td>
      ) : (
        <>
          <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
            <span className="block whitespace-nowrap">{s.model ?? s.boardName ?? '—'}</span>
            {s.serialNumber && <span className="block font-mono text-xs text-gray-500 dark:text-gray-400">{s.serialNumber}</span>}
          </td>
          <td className="py-2 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
            {s.routerOsVersion ?? '—'}
            {firmwarePending && (
              <span className="block" title={`Firmware ${s.currentFirmware} → ${s.upgradeFirmware}`}>
                <Badge variant="warning">Firmware pendiente</Badge>
              </span>
            )}
          </td>
          <td className="py-2 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
            {s.uptimeSeconds != null ? fmtUptime(s.uptimeSeconds) : '—'}
            {r.bootedAt && (
              <span className="block text-xs text-gray-500 dark:text-gray-400">Encendido desde {fmtDate(r.bootedAt)}</span>
            )}
          </td>
          <td className="py-2 px-3 tabular-nums whitespace-nowrap">
            <Value issue="CPU" issues={r.healthIssues}>
              {s.cpuLoadPercent != null ? `${s.cpuLoadPercent} %` : null}
            </Value>
          </td>
          <td className="py-2 px-3 tabular-nums text-xs whitespace-nowrap">
            <span className="block">
              <span className="text-gray-500 dark:text-gray-400">Mem. </span>
              <Value issue="MEMORY" issues={r.healthIssues}>
                {fmtUsed(s.freeMemoryBytes, s.totalMemoryBytes)}
              </Value>
            </span>
            <span className="block mt-0.5">
              <span className="text-gray-500 dark:text-gray-400">Disco </span>
              <Value issue="DISK" issues={r.healthIssues}>
                {fmtUsed(s.freeHddBytes, s.totalHddBytes)}
              </Value>
            </span>
          </td>
          <td className="py-2 px-3 tabular-nums text-xs whitespace-nowrap">
            <span className="block">
              <Value issue="VOLTAGE" issues={r.healthIssues}>
                {s.voltage != null ? `${fmtNumber(s.voltage)} V` : null}
              </Value>
            </span>
            <span className="block mt-0.5">
              <Value issue="TEMPERATURE" issues={r.healthIssues}>
                {s.temperatureC != null ? `${fmtNumber(s.temperatureC)} °C` : null}
              </Value>
            </span>
          </td>
          <td className="py-2 px-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {r.readAt ? fmtAge(Math.max(0, (now - new Date(r.readAt).getTime()) / 1000)) : '—'}
          </td>
        </>
      )}
      <td className="py-2 px-3">
        <IconButton icon={reading ? null : <RefreshIcon />} label="Leer ahora" size="sm" onClick={onRead} isLoading={reading} />
      </td>
    </tr>
  );
}

/**
 * What every company MikroTik last said about itself (`GET /routers/system`,
 * MON-160 … MON-175): name, hardware, versions and health, read by the server
 * every 10 minutes and kept. «Leer ahora» reads one router and replaces its row.
 */
export function RouterSystemTable() {
  const { showError } = useToast();
  const queryClient = useQueryClient();
  const now = useNow(30_000, true);
  const [reading, setReading] = useState<string | null>(null);
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ROUTER_SYSTEM_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getRouterSystems();
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al cargar los routers');
      return r.data;
    },
    refetchInterval: 60_000,
  });

  // An inbox notice opens ?tab=system#<deviceId>; the row only exists once the list is in.
  useEffect(() => {
    if (!data || !window.location.hash) return;
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  const readNow = async (deviceId: string) => {
    setReading(deviceId);
    const r = await apiService.readRouterSystem(deviceId);
    setReading(null);
    if (r.success && r.data) {
      const router = r.data.router;
      queryClient.setQueryData<RouterSystemListDTO>(ROUTER_SYSTEM_QUERY_KEY, (old) =>
        old ? { routers: old.routers.map((x) => (x.deviceId === router.deviceId ? router : x)) } : old
      );
      if (router.lastError) showError(`${router.name}: ${translateRouterReason(router.lastError)}`);
    } else {
      showError(r.status === 404 ? 'Este equipo ya no es un router MikroTik de la empresa.' : r.error || 'No se pudo leer el router');
    }
  };

  const routers = data?.routers ?? [];
  const withIssues = routers.filter((r) => r.healthIssues.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {data
            ? withIssues === 0
              ? 'Ningún router tiene problemas de salud abiertos.'
              : `${withIssues} ${withIssues === 1 ? 'router tiene' : 'routers tienen'} problemas de salud abiertos.`
            : ''}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {dataUpdatedAt > 0 && <span>Actualizado a las {new Date(dataUpdatedAt).toLocaleTimeString('es')}</span>}
          <IconButton icon={isFetching ? null : <RefreshIcon />} label="Actualizar" size="sm" onClick={() => refetch()} isLoading={isFetching} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Cargando routers..." />
        </div>
      ) : error ? (
        <ErrorBanner message={(error as Error).message} />
      ) : routers.length === 0 ? (
        <Card>
          <Card.Body>
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No hay routers MikroTik de la empresa. Aparece aquí un equipo activo o en instalación, de marca MikroTik, cuyo modelo es
              router, RouterBoard o switch, o cuya categoría es Gateway o Switch de agregación.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <div className="overflow-x-auto table-scroll-x rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="min-w-full text-sm" aria-label="Estado de los routers">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 px-3 font-medium">Router</th>
                <th className="py-2 px-3 font-medium">Modelo y serie</th>
                <th className="py-2 px-3 font-medium">RouterOS</th>
                <th className="py-2 px-3 font-medium">Encendido</th>
                <th className="py-2 px-3 font-medium">CPU</th>
                <th className="py-2 px-3 font-medium">Uso</th>
                <th className="py-2 px-3 font-medium">Voltaje y temp.</th>
                <th className="py-2 px-3 font-medium">Leído</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {routers.map((r) => (
                <RouterRow key={r.deviceId} r={r} now={now} onRead={() => readNow(r.deviceId)} reading={reading === r.deviceId} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
