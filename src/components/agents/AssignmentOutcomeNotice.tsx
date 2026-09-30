'use client';

import React from 'react';
import Link from 'next/link';
import { AssignmentOutcome, deviceCount } from './useAgentAssignment';

/**
 * What a move did. A device the backend refused stays where it was — usually
 * because some other rule no longer holds (an ACTIVE device with no location),
 * which the operator has to fix on the device itself, so each one links there.
 */
export function AssignmentOutcomeNotice({ outcome }: { outcome: AssignmentOutcome }) {
  const { assigned, failed } = outcome;
  const nothingToMove = assigned === 0 && failed.length === 0;

  return (
    <div className="space-y-2 text-sm" role="status">
      <p className={failed.length > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-green-700 dark:text-green-400'}>
        {nothingToMove
          ? 'No había dispositivos para mover.'
          : `${deviceCount(assigned)} ${assigned === 1 ? 'movido' : 'movidos'}.`}
        {failed.length > 0 && ` ${deviceCount(failed.length)} no se ${failed.length === 1 ? 'pudo' : 'pudieron'} mover:`}
      </p>
      {failed.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-2">
          {failed.map((f) => (
            <li key={f.id} className="text-gray-700 dark:text-gray-300 wrap-anywhere">
              <Link href={`/devices/${f.id}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                {f.name ?? f.id}
              </Link>
              : {f.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
