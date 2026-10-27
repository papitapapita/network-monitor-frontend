'use client';

import React from 'react';
import { IconButton } from './IconButton';
import { InfoTip } from './InfoTip';
import { RefreshIcon } from './icons';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** How the page behaves; shown behind an info icon beside the title. */
  info?: React.ReactNode;
  /** Omit to hide the "Actualizar" button. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastRefreshed?: Date | null;
  /** Primary actions, rendered to the right of "Actualizar". */
  actions?: React.ReactNode;
  /** Keeps the controls across from the title at every width, instead of below it from `sm` up. */
  inline?: boolean;
}

/** Title, count line, refresh control and primary actions — shared by every list page. */
export function PageHeader({
  title,
  subtitle,
  info,
  onRefresh,
  isRefreshing = false,
  lastRefreshed,
  actions,
  inline = false,
}: PageHeaderProps) {
  // List pages keep their buttons in the FilterBar; the refresh time then
  // rides on the subtitle line instead of under a button row.
  const hasControls = !!onRefresh || !!actions;
  const refreshedAt = lastRefreshed?.toLocaleTimeString('es');

  if (!hasControls) {
    return (
      <div className="mb-6 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {info && <InfoTip label={`Acerca de «${title}»`}>{info}</InfoTip>}
        </div>
        {(subtitle || refreshedAt) && (
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            {subtitle}
            {refreshedAt && (
              <span className="whitespace-nowrap text-gray-400 dark:text-gray-500">
                {subtitle ? ' · ' : ''}Actualizado {refreshedAt}
              </span>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={
        inline
          ? 'flex flex-row items-start justify-between gap-4 mb-6'
          : 'flex flex-row sm:flex-col items-start justify-between sm:justify-start gap-4 sm:gap-2 mb-6'
      }
    >
      <div className={inline ? 'min-w-0 flex-1' : 'w-1/2 sm:w-full min-w-0'}>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {info && <InfoTip label={`Acerca de «${title}»`}>{info}</InfoTip>}
        </div>
        {subtitle && <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">{subtitle}</p>}
      </div>

      <div className={inline ? 'shrink-0 flex flex-col items-end gap-1' : 'w-1/2 sm:w-full flex flex-col items-end sm:items-start gap-1'}>
        <div className={inline ? 'flex flex-wrap justify-end gap-2' : 'flex flex-wrap justify-end sm:justify-start gap-2'}>
          {onRefresh && (
            <IconButton
              icon={isRefreshing ? null : <RefreshIcon />}
              label="Actualizar"
              size="md"
              onClick={onRefresh}
              isLoading={isRefreshing}
              disabled={isRefreshing}
              tooltipSide="bottom"
            />
          )}
          {actions}
        </div>
        {lastRefreshed && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Actualizado: {refreshedAt}
          </span>
        )}
      </div>
    </div>
  );
}
