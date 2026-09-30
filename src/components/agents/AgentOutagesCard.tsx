'use client';

import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { AgentDTO, AgentOutageDTO } from '@/types/agent.types';
import { Badge, Button, Card, LoadingSpinner } from '@/components/ui';
import { formatAgentDate, formatDuration } from '@/constants/agent.constants';
import { useNow } from '@/hooks/useWirelessThroughput';

const PAGE_SIZE = 20;

/** Measured from the last contact, not from when it was marked offline — that is when the silence really began. */
function outageLength(outage: AgentOutageDTO, now: number): number {
  const end = outage.endedAt ? Date.parse(outage.endedAt) : now;
  return end - Date.parse(outage.silentSince);
}

/**
 * Every time the agent went offline (AGT-026), newest first. Answers "was it
 * down last night?", which the live badge cannot. Recorded since 2026-09-29.
 */
export function AgentOutagesCard({ agent }: { agent: AgentDTO }) {
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    // Keyed on offlineSince too, so an outage opening or closing reloads the list.
    queryKey: ['agents', agent.id, 'outages', agent.offlineSince],
    queryFn: async ({ pageParam }) => {
      const r = await apiService.listAgentOutages(agent.id, { limit: PAGE_SIZE, offset: pageParam });
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar el historial');
      return r.data;
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.offset + last.limit : undefined),
  });

  const outages = data?.pages.flatMap((p) => p.outages) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  // An open outage keeps growing; its length ticks once a minute.
  const now = useNow(60_000);

  return (
    <Card>
      <Card.Header>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Historial de desconexiones
          {total > 0 && <span className="text-gray-500 dark:text-gray-400 font-normal"> ({total})</span>}
        </h2>
      </Card.Header>
      <Card.Body>
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : error ? (
          <p className="text-sm text-red-700 dark:text-red-400">{(error as Error).message}</p>
        ) : outages.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Sin desconexiones registradas. El historial se lleva desde el 29/9/2026.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {outages.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {formatAgentDate(o.silentSince)}
                    {o.endedAt && <> → {formatAgentDate(o.endedAt)}</>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatDuration(outageLength(o, now))}</span>
                    {o.endedAt === null ? (
                      <Badge variant="danger">En curso</Badge>
                    ) : o.endReason === 'REVOKED' ? (
                      <Badge variant="neutral">Terminó al revocarlo</Badge>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {hasNextPage && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>
                  Ver más
                </Button>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
