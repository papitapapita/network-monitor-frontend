'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Badge, Button, LoadingSpinner } from '@/components/ui';
import { UnreadRoutersNotice } from '@/components/topology/UnreadRoutersNotice';
import type { AddressMismatchDTO } from '@/types/topology.types';

function Summary({ m }: { m: AddressMismatchDTO }) {
  const device = (
    <Link href={`/devices/${m.deviceId}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
      {m.deviceName}
    </Link>
  );
  if (m.kind === 'OTHER_DEVICE' && m.otherDeviceId) {
    return (
      <>
        La IP de {device} la tiene{' '}
        <Link href={`/devices/${m.otherDeviceId}`} className="font-medium text-brand-600 dark:text-brand-400 hover:underline">
          {m.otherDeviceName}
        </Link>
      </>
    );
  }
  return (
    <>
      La IP de {device} responde con otra MAC (<span className="font-mono">{m.seenMacAddress}</span>)
    </>
  );
}

/**
 * Devices in service whose IP a MikroTik's ARP table or DHCP leases give to
 * another MAC (`GET /topology/address-mismatches`, DEV-219): the IP on file
 * is wrong, or two devices share the address. Read live from every router,
 * so only on demand.
 */
export function AddressMismatches() {
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['topology', 'address-mismatches'],
    queryFn: async () => {
      const r = await apiService.getAddressMismatches();
      if (!r.success || !r.data) throw new Error(r.error ?? 'Error al buscar conflictos de IP');
      return r.data;
    },
  });

  const mismatches = data?.mismatches ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-y-auto h-full">
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-3xl">
        Equipos activos o en instalación cuya IP los MikroTik (tabla ARP y concesiones DHCP) le dan a una MAC que no es la
        suya: la IP registrada está mal, o dos equipos comparten la dirección. No se revisan los equipos sin IP o sin MAC
        conocida.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => refetch()} isLoading={isFetching && !isLoading}>
          Volver a buscar
        </Button>
        {dataUpdatedAt > 0 && !isFetching && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Leído a las {new Date(dataUpdatedAt).toLocaleTimeString('es')}
          </span>
        )}
      </div>

      {data && <UnreadRoutersNotice routers={data.unreadRouters} consequence="la lista puede estar incompleta" />}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner message="Leyendo las tablas ARP de los routers..." />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
      ) : mismatches.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin conflictos: cada IP responde con la MAC de su equipo.</p>
      ) : (
        <div className="overflow-x-auto table-scroll-x rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm" aria-label="Conflictos de IP">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 px-3 font-medium">Conflicto</th>
                <th className="py-2 px-3 font-medium">IP</th>
                <th className="py-2 px-3 font-medium">MAC registrada</th>
                <th className="py-2 px-3 font-medium">MAC vista</th>
                <th className="py-2 px-3 font-medium">Visto por</th>
              </tr>
            </thead>
            <tbody>
              {mismatches.map((m) => (
                <tr key={m.deviceId} className="border-t border-gray-100 dark:border-gray-700/50 align-top">
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                    <Summary m={m} />
                    {m.kind === 'UNKNOWN_MAC' && (
                      <Badge variant="warning" className="ml-1.5">
                        MAC desconocida
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 px-3 font-mono whitespace-nowrap text-gray-900 dark:text-gray-100">{m.ipAddress}</td>
                  <td className="py-2 px-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {m.macAddressesOnFile.map((mac) => (
                      <span key={mac} className="block whitespace-nowrap">
                        {mac}
                      </span>
                    ))}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs whitespace-nowrap text-red-600 dark:text-red-400">{m.seenMacAddress}</td>
                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                    {m.seenBy.map((r, i) => (
                      <React.Fragment key={r.routerDeviceId}>
                        {i > 0 && ', '}
                        <Link href={`/devices/${r.routerDeviceId}`} className="hover:underline">
                          {r.routerName}
                        </Link>
                      </React.Fragment>
                    ))}
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
