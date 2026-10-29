'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  ErrorBanner,
  IconButton,
  LoadingSpinner,
  PageHeader,
  RefreshIcon,
  Select,
  Switch,
} from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { usePermissions } from '@/hooks/usePermissions';
import {
  EXPECTED_SPEED_OPTIONS,
  PORT_ISSUE,
  PORT_VERDICT,
  fmtMbps,
  fmtSfp,
  translateAcceptCurrentError,
  translatePortSpeedReason,
} from '@/constants/port-speed.constants';
import type { PortSpeedsListDTO, RouterPortDTO, RouterPortSpeedsDTO } from '@/types/port-speed.types';

const PORT_SPEEDS_QUERY_KEY = ['portSpeeds'];

/** Swaps one router in the cached list, so a card refreshes without the others. */
function useReplaceRouter() {
  const queryClient = useQueryClient();
  return (router: RouterPortSpeedsDTO) =>
    queryClient.setQueryData<PortSpeedsListDTO>(PORT_SPEEDS_QUERY_KEY, (old) =>
      old ? { ...old, routers: old.routers.map((r) => (r.deviceId === router.deviceId ? router : r)) } : old
    );
}

function LinkCell({ p }: { p: RouterPortDTO }) {
  if (p.verdict === 'PORT_MISSING') return <span className="text-gray-500 dark:text-gray-400">—</span>;
  if (!p.linked) return <span className="text-gray-500 dark:text-gray-400">Sin enlace</span>;
  return (
    <>
      <span className="text-gray-900 dark:text-gray-100">{p.rateMbps != null ? fmtMbps(p.rateMbps) : 'Sin velocidad'}</span>
      {p.fullDuplex != null && (
        <span className={`block text-xs ${p.fullDuplex ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
          {p.fullDuplex ? 'Full dúplex' : 'Half dúplex'}
        </span>
      )}
    </>
  );
}

/** A counter as read now, with what the last scheduled check added in red. */
function Counter({ total, added, label }: { total: number | null; added: number | null; label: string }) {
  if (total == null) return null;
  return (
    <span className="block whitespace-nowrap">
      {total.toLocaleString('es')} {label}
      {added != null && added > 0 && (
        <span className="ml-1 font-medium text-red-600 dark:text-red-400" title="En el último chequeo">
          +{added.toLocaleString('es')}
        </span>
      )}
    </span>
  );
}

function HealthCell({ p }: { p: RouterPortDTO }) {
  if (p.rxErrors == null && p.linkDowns == null && !p.sfp && p.issues.length === 0) {
    return <span className="text-gray-500 dark:text-gray-400">—</span>;
  }
  return (
    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
      <Counter total={p.rxErrors} added={p.errorsAdded} label={p.rxErrors === 1 ? 'error' : 'errores'} />
      <Counter total={p.linkDowns} added={p.linkDownsAdded} label={p.linkDowns === 1 ? 'caída' : 'caídas'} />
      {p.sfp && <span className="block whitespace-nowrap" title="Módulo de fibra">{fmtSfp(p.sfp)}</span>}
      {p.issues.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {p.issues.map((i) => (
            <span key={i} title={PORT_ISSUE[i].hint}>
              <Badge variant="danger">{PORT_ISSUE[i].label}</Badge>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function PortRow({
  p,
  canWrite,
  busy,
  onSave,
}: {
  p: RouterPortDTO;
  canWrite: boolean;
  busy: boolean;
  onSave: (expectedMbps: number | null, alertOnNoLink?: boolean) => void;
}) {
  const verdict = PORT_VERDICT[p.verdict];
  return (
    <tr className="border-t border-gray-100 dark:border-gray-700/50 align-top">
      <td className="py-2 pr-4">
        <span className="font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap">{p.name}</span>
        {p.comment && <span className="block text-xs text-gray-500 dark:text-gray-400 wrap-anywhere">{p.comment}</span>}
      </td>
      <td className="py-2 pr-4 whitespace-nowrap">
        <LinkCell p={p} />
      </td>
      <td className="py-2 pr-4 min-w-36">
        {canWrite ? (
          <Select
            options={EXPECTED_SPEED_OPTIONS}
            value={p.expectedMbps != null ? String(p.expectedMbps) : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== (p.expectedMbps != null ? String(p.expectedMbps) : '')) onSave(v ? Number(v) : null);
            }}
            disabled={busy}
            fullWidth
          />
        ) : (
          <span className="text-gray-700 dark:text-gray-300">{p.expectedMbps != null ? fmtMbps(p.expectedMbps) : '—'}</span>
        )}
      </td>
      <td className="py-2 pr-4">
        <Switch
          aria-label={`Avisar si ${p.name} pierde enlace`}
          checked={p.alertOnNoLink}
          disabled={!canWrite || busy || p.expectedMbps == null}
          title={p.expectedMbps == null ? 'Primero define la velocidad esperada' : undefined}
          onChange={(e) => onSave(p.expectedMbps, e.target.checked)}
        />
      </td>
      <td className="py-2 pr-4 whitespace-nowrap" title={verdict.hint}>
        <Badge variant={verdict.variant}>{verdict.label}</Badge>
      </td>
      <td className="py-2">
        <HealthCell p={p} />
      </td>
    </tr>
  );
}

function RouterCard({ router, canWrite }: { router: RouterPortSpeedsDTO; canWrite: boolean }) {
  const { showError, showSuccess } = useToast();
  const replaceRouter = useReplaceRouter();
  const [checking, setChecking] = useState(false);
  const [busyPort, setBusyPort] = useState<string | null>(null);
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const checkNow = async () => {
    setChecking(true);
    const r = await apiService.getRouterPortSpeeds(router.deviceId);
    setChecking(false);
    if (r.success && r.data) replaceRouter(r.data.router);
    else showError(r.status === 404 ? 'Este equipo ya no es un router MikroTik de la empresa.' : r.error || 'No se pudo leer el router');
  };

  const save = async (portName: string, expectedMbps: number | null, alertOnNoLink?: boolean) => {
    setBusyPort(portName);
    // Shown at once; the verdict follows once the router is read again.
    replaceRouter({
      ...router,
      ports: router.ports.map((p) =>
        p.name === portName
          ? { ...p, expectedMbps, alertOnNoLink: expectedMbps == null ? false : (alertOnNoLink ?? p.alertOnNoLink) }
          : p
      ),
    });
    const r = await apiService.setExpectedPortSpeed(router.deviceId, { portName, expectedMbps, alertOnNoLink });
    if (!r.success) {
      setBusyPort(null);
      replaceRouter(router);
      showError(r.status === 404 ? 'Este equipo ya no es un router MikroTik de la empresa.' : r.error || 'No se pudo guardar la velocidad esperada');
      return;
    }
    const fresh = await apiService.getRouterPortSpeeds(router.deviceId);
    setBusyPort(null);
    if (fresh.success && fresh.data) replaceRouter(fresh.data.router);
  };

  const acceptCurrent = async () => {
    setAccepting(true);
    const r = await apiService.acceptCurrentPortSpeeds(router.deviceId);
    setAccepting(false);
    setConfirmAccept(false);
    if (r.success && r.data) {
      replaceRouter(r.data);
      showSuccess(`Velocidades actuales de ${router.name} guardadas como esperadas.`);
    } else {
      showError(translateAcceptCurrentError(r.error));
    }
  };

  return (
    <div id={router.deviceId} className="scroll-mt-4">
      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
              <Link href={`/devices/${router.deviceId}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
                {router.name}
              </Link>
              {router.identity && router.identity !== router.name && (
                <span className="text-sm text-gray-600 dark:text-gray-400">{router.identity}</span>
              )}
              {router.ipAddress && <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{router.ipAddress}</span>}
            </div>
            <div className="flex items-center gap-2">
              {canWrite && router.readable && (
                <Button variant="outline" size="sm" onClick={() => setConfirmAccept(true)} disabled={checking || busyPort !== null}>
                  Aceptar velocidades actuales
                </Button>
              )}
              <IconButton
                icon={checking ? null : <RefreshIcon />}
                label="Comprobar ahora"
                size="sm"
                onClick={checkNow}
                isLoading={checking}
                disabled={busyPort !== null || accepting}
              />
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {!router.readable ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No se leyó: {translatePortSpeedReason(router.reason)}</p>
          ) : router.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">No se pudo leer: {translatePortSpeedReason(router.error)}</p>
          ) : router.ports.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No tiene puertos activos.</p>
          ) : (
            <div className="overflow-x-auto table-scroll-x">
              <table className="min-w-full text-sm" aria-label={`Puertos de ${router.name}`}>
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="py-1 pr-4 font-medium">Puerto</th>
                    <th className="py-1 pr-4 font-medium">Enlace</th>
                    <th className="py-1 pr-4 font-medium">Esperada</th>
                    <th className="py-1 pr-4 font-medium">Avisar si pierde enlace</th>
                    <th className="py-1 pr-4 font-medium">Estado</th>
                    <th className="py-1 font-medium">Errores y caídas</th>
                  </tr>
                </thead>
                <tbody>
                  {router.ports.map((p) => (
                    <PortRow
                      key={p.name}
                      p={p}
                      canWrite={canWrite}
                      busy={busyPort === p.name || checking || accepting}
                      onSave={(mbps, alert) => save(p.name, mbps, alert)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card.Body>
        <ConfirmModal
          isOpen={confirmAccept}
          onClose={() => setConfirmAccept(false)}
          onConfirm={acceptCurrent}
          title="Aceptar velocidades actuales"
          message={`Se lee ${router.name} ahora y la velocidad de cada puerto con enlace pasa a ser su velocidad esperada, reemplazando la que tenía. Los puertos sin enlace conservan la suya.`}
          confirmText="Aceptar"
          cancelText="Cancelar"
          isLoading={accepting}
        />
      </Card>
    </div>
  );
}

/**
 * The speed each Ethernet port of the company's MikroTiks linked at, judged
 * against the speed an operator says it should run at (BACKEND_API.md, Port
 * Speeds, MON-140 … MON-150). A gigabit link up at 100 Mbps is usually a bad
 * cable. Everything is read live; each card refreshes alone through
 * `GET /routers/:id/port-speeds`, which answers in about a second.
 */
export default function PortSpeedsPage() {
  const { canWrite } = usePermissions();
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: PORT_SPEEDS_QUERY_KEY,
    queryFn: async () => {
      const r = await apiService.getPortSpeeds();
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al leer la velocidad de los puertos');
      return r.data;
    },
    staleTime: 30_000,
  });

  // An inbox notice opens /port-speeds#<deviceId>; the card only exists once the list is in.
  useEffect(() => {
    if (!data || !window.location.hash) return;
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  const slow = data?.routers.reduce((n, r) => n + r.ports.filter((p) => p.verdict === 'SLOW').length, 0) ?? 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <PageHeader
        title="Velocidad de puertos"
        subtitle={
          data && data.routers.length > 0
            ? slow === 0
              ? 'Ningún puerto está más lento de lo que debería'
              : `${slow} ${slow === 1 ? 'puerto está más lento' : 'puertos están más lentos'} de lo que deberían`
            : undefined
        }
        info="A qué velocidad enlazó cada puerto Ethernet de los MikroTik de la empresa (routers y switches con RouterOS), comparada con la velocidad a la que debería enlazar. Un enlace gigabit que subió a 100 Mbps suele ser un cable dañado. Un puerto sin velocidad esperada se muestra pero no se evalúa. Cada 10 minutos el servidor revisa cada router y avisa cuando un puerto con velocidad esperada está lento en dos revisiones seguidas, y cuando se recupera. «Avisar si pierde enlace» cuenta además la pérdida de enlace como lentitud. La misma revisión cuenta los errores y las caídas de enlace de cada puerto, y la potencia de los módulos de fibra, y avisa cuando un puerto suma errores, se cae y vuelve, o recibe poca luz. En rojo, lo que sumó la última revisión. Los límites están en Configuración → Salud de routers. Fuera del sitio, un agente anterior a 0.11.0 no envía los contadores."
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Leyendo los routers... puede tardar hasta 10 s" />
        </div>
      ) : error ? (
        <ErrorBanner message={(error as Error).message} />
      ) : data!.routers.length === 0 ? (
        <Card>
          <Card.Body>
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No hay routers MikroTik de la empresa. Aparece aquí un equipo activo o en instalación, de marca MikroTik, cuyo modelo es
              router, RouterBoard o switch, o cuya categoría es Gateway o Switch de agregación.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <div className="space-y-4">
          {data!.routers.map((r) => (
            <RouterCard key={r.deviceId} router={r} canWrite={canWrite} />
          ))}
        </div>
      )}
    </div>
  );
}
