'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Badge, Button, Card, ErrorBanner, LoadingSpinner, PageHeader } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { usePermissions } from '@/hooks/usePermissions';
import { DISCOVERED_DEVICES_QUERY_KEY, useDiscoveredDevices } from '@/hooks/useDiscoveredDevices';
import { DISCOVERED_SOURCE_LABELS } from '@/constants/network-scan.constants';
import type { DiscoveredDeviceDTO } from '@/types/network-scan.types';

type Tab = 'pending' | 'ignored';
const TAB_LABELS: Record<Tab, string> = { pending: 'Pendientes', ignored: 'Ignorados' };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Hosts the network shows that inventory lacks (`GET /network/discovered`,
 * DEV-200 … DEV-209): seen by a scan, or on a polled AP's station list. Each
 * one is created as a device — the form opens pre-filled — or ignored for
 * good. A suggestion leaves the list on its own once a device owns its MAC or
 * IP, so creating one only needs a refetch.
 */
export default function DiscoveredDevicesPage() {
  const { canWrite } = usePermissions();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const { data: devices, isLoading, isFetching, error, refetch, dataUpdatedAt } = useDiscoveredDevices(tab === 'ignored');
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleIgnore = async (d: DiscoveredDeviceDTO) => {
    setBusyId(d.id);
    const r = tab === 'pending'
      ? await apiService.ignoreDiscoveredDevice(d.id)
      : await apiService.unignoreDiscoveredDevice(d.id);
    setBusyId(null);
    if (r.success) {
      showSuccess(tab === 'pending' ? `${d.macAddress} ignorado.` : `${d.macAddress} vuelve a pendientes.`);
    } else {
      showError(r.status === 404 ? 'Esta sugerencia ya no existe.' : r.error || 'No se pudo actualizar la sugerencia');
    }
    // Both lists change, and a 404 means the one shown is stale.
    queryClient.invalidateQueries({ queryKey: DISCOVERED_DEVICES_QUERY_KEY });
  };

  const count = devices?.length ?? 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageHeader
        title="Dispositivos descubiertos"
        subtitle={
          devices && tab === 'pending'
            ? count === 0
              ? 'Todo lo que la red muestra está en el inventario'
              : `${count} ${count === 1 ? 'equipo visto en la red no está' : 'equipos vistos en la red no están'} en el inventario`
            : undefined
        }
        info="Equipos que un escaneo de red o la lista de estaciones de un AP muestran y que el inventario no tiene. Crear el dispositivo abre el formulario con lo que se sabe de él. Ignorar uno lo saca de la lista para siempre, aunque vuelva a aparecer; se puede deshacer desde «Ignorados». Los pendientes que no se ven en 30 días se borran solos."
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          <Link href="/network-scan">
            <Button variant="outline">Escanear un segmento</Button>
          </Link>
        }
      />

      <nav className="flex gap-6 mb-4 border-b border-gray-200 dark:border-gray-700">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Cargando dispositivos descubiertos..." />
        </div>
      ) : error ? (
        <ErrorBanner message={(error as Error).message} />
      ) : count === 0 ? (
        <Card>
          <Card.Body>
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {tab === 'pending'
                ? 'No hay equipos descubiertos pendientes. Aparecen aquí al escanear un segmento o cuando un AP sondeado muestra una estación que no está en el inventario.'
                : 'No hay equipos ignorados.'}
            </p>
          </Card.Body>
        </Card>
      ) : (
        <ul className="space-y-3">
          {devices!.map((d) => (
            <li key={d.id}>
              <Card>
                <Card.Body>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 wrap-anywhere">
                          {d.hostname ?? d.manufacturer ?? 'Equipo sin nombre'}
                        </span>
                        <Badge variant={d.source === 'AP_STATION' ? 'info' : 'neutral'}>
                          {DISCOVERED_SOURCE_LABELS[d.source]}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-mono">{d.macAddress}</span>
                        {d.ipAddress && <> · <span className="font-mono">{d.ipAddress}</span></>}
                        {d.model && <> · {d.model}</>}
                        {d.hostname && d.manufacturer && <> · {d.manufacturer}</>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {d.source === 'AP_STATION' && d.accessPointId ? (
                          <>
                            Visto en{' '}
                            {d.accessPointName ? (
                              <Link href={`/devices/${d.accessPointId}`} className="text-brand-600 dark:text-brand-400 hover:underline">
                                {d.accessPointName}
                              </Link>
                            ) : (
                              'un AP eliminado'
                            )}
                            {' · '}
                          </>
                        ) : d.segment ? (
                          <>Visto en <span className="font-mono">{d.segment}</span> · </>
                        ) : null}
                        Primera vez {fmtDate(d.firstSeenAt)} · Última vez {fmtDate(d.lastSeenAt)}
                        {d.ignoredAt && <> · Ignorado {fmtDate(d.ignoredAt)}</>}
                      </p>
                    </div>
                    {canWrite && (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleIgnore(d)}
                          isLoading={busyId === d.id}
                          disabled={busyId !== null}
                        >
                          {tab === 'pending' ? 'Ignorar' : 'Dejar de ignorar'}
                        </Button>
                        {tab === 'pending' && (
                          <Link href={`/devices/create?discovered=${d.id}`}>
                            <Button size="sm" disabled={busyId !== null}>Crear dispositivo</Button>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
