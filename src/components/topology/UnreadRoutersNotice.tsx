import React from 'react';
import Link from 'next/link';
import { translateRouterReason } from '@/constants/port-speed.constants';
import type { UnreadSwitchDTO } from '@/types/topology.types';

/**
 * The MikroTiks a live read could not reach, so the answer above may be
 * incomplete. `consequence` says what is missing, e.g. "pueden faltar
 * sugerencias por sus vecinos". Renders nothing when every router answered.
 */
export function UnreadRoutersNotice({ routers, consequence }: { routers: UnreadSwitchDTO[]; consequence: string }) {
  if (routers.length === 0) return null;
  return (
    <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-300">
      <p className="font-medium">
        {routers.length === 1 ? 'Un MikroTik no se pudo leer' : `${routers.length} MikroTik no se pudieron leer`}: {consequence}.
      </p>
      <ul className="mt-1 list-disc list-inside">
        {routers.map((u) => (
          <li key={u.deviceId}>
            <Link href={`/devices/${u.deviceId}`} className="underline">
              {u.name}
            </Link>{' '}
            — {translateRouterReason(u.reason)}
          </li>
        ))}
      </ul>
    </div>
  );
}
