import React from 'react';

interface RecordTimestampsProps {
  createdAt: string;
  updatedAt?: string | null;
  /** "Creado" by default; a feminine record (una ubicación) passes "Creada". */
  createdLabel?: string;
  updatedLabel?: string;
  className?: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * When a record was created and last changed, as one quiet line at the foot
 * of a detail page — bookkeeping, so it takes no card of its own.
 */
export function RecordTimestamps({
  createdAt,
  updatedAt,
  createdLabel = 'Creado',
  updatedLabel = 'Actualizado',
  className = '',
}: RecordTimestampsProps) {
  return (
    <p className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 ${className}`}>
      <span>
        {createdLabel}{' '}
        <time dateTime={createdAt} className="text-gray-700 dark:text-gray-300">{fmt(createdAt)}</time>
      </span>
      {updatedAt && (
        <span>
          {updatedLabel}{' '}
          <time dateTime={updatedAt} className="text-gray-700 dark:text-gray-300">{fmt(updatedAt)}</time>
        </span>
      )}
    </p>
  );
}
