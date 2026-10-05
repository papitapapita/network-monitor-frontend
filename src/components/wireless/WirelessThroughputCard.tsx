'use client';

import React from 'react';
import { Card, Badge, LoadingSpinner, SectionTitle } from '@/components/ui';
import { StreamIndicator, StreamErrorNotice } from './StreamStatus';
import { useWirelessThroughput, useNow, liveAgeSeconds } from '@/hooks/useWirelessThroughput';
import {
  fmtAge,
  fmtBps,
  fmtKbps,
  utilisationBarClass,
  utilisationVariant,
} from '@/constants/wireless.constants';
import { fmtInterval } from '@/constants/polling.constants';

interface Props {
  deviceId: string;
  /** From the wireless config, to say how often a new reading is due. */
  intervalSecs?: number | null;
}

/**
 * Live TX/RX for one radio, pushed over SSE as the poller stores snapshots.
 * Mounting opens a stream and unmounting closes it — a user may hold only 5 at
 * once, so this belongs on a tab that is actually being looked at.
 */
export function WirelessThroughputCard({ deviceId, intervalSecs }: Props) {
  const { entry, state, retry } = useWirelessThroughput(deviceId);
  // Nothing to tick once the stream is dead: the age would keep climbing past
  // a number anybody could act on.
  const now = useNow(1_000, state.status !== 'error');

  const reading = entry?.reading ?? null;
  const ageSeconds = entry ? liveAgeSeconds(entry, now) : null;
  const utilisation = reading?.utilisationPercent ?? null;

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle
            info={intervalSecs != null ? `Nueva lectura cada ${fmtInterval(intervalSecs)}, cuando el sondeo la guarda.` : undefined}
          >
            Tráfico en vivo
          </SectionTitle>
          <StreamIndicator state={state} />
        </div>
      </Card.Header>
      <Card.Body>
        <div className="space-y-4">
          <StreamErrorNotice state={state} onRetry={retry} />

          {!reading ? (
            state.status === 'error' ? null : (
              <div className="flex justify-center py-4">
                <LoadingSpinner message="Esperando la primera lectura..." />
              </div>
            )
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Metric label="Subida (TX)" value={fmtBps(reading.throughputTxBps)} />
                <Metric label="Bajada (RX)" value={fmtBps(reading.throughputRxBps)} />
                <Metric label="Total" value={fmtBps(reading.throughputTotalBps)} />
              </div>

              {/* Capacity is per station, so an AP has nothing to measure
                  against and the backend sends null for both fields. A station
                  with a live contract is measured against its plan, anything
                  else against the config's manual fallback. */}
              {reading.linkCapacityKbps !== null && (
                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">
                      {reading.linkCapacitySource === 'MANUAL'
                        ? 'Uso de la capacidad manual'
                        : 'Uso del plan contratado'}{' '}
                      ({fmtKbps(reading.linkCapacityKbps)})
                    </span>
                    <Badge variant={utilisationVariant(utilisation)}>
                      {utilisation !== null ? `${utilisation.toFixed(2)} %` : '—'}
                    </Badge>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className={`h-2 rounded-full transition-all ${utilisationBarClass(utilisation)}`}
                      style={{ width: `${Math.min(utilisation ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Medido {ageSeconds !== null ? fmtAge(ageSeconds) : '—'} ·{' '}
                  {new Date(reading.collectedAt).toLocaleString('es')}
                </span>
                {/* The backend flags a reading as stale past 2× the interval:
                    the poller is behind or the radio stopped answering. */}
                {reading.stale && <Badge variant="warning">Lectura desactualizada</Badge>}
              </div>
            </>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
