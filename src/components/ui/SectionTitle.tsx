import React from 'react';
import { InfoTip } from './InfoTip';

interface SectionTitleProps {
  children: React.ReactNode;
  /** How the section behaves; shown behind an info icon beside the title. */
  info?: React.ReactNode;
  as?: 'h2' | 'h3';
  /** Replaces the default card-title styling. */
  className?: string;
}

const DEFAULT_CLASSES: Record<NonNullable<SectionTitleProps['as']>, string> = {
  h2: 'text-lg font-semibold text-gray-900 dark:text-gray-100',
  h3: 'text-sm font-semibold text-gray-700 dark:text-gray-300',
};

/**
 * A section heading with the prose explaining that section tucked behind an
 * info icon beside it, instead of a paragraph under the title.
 */
export function SectionTitle({ children, info, as: Tag = 'h2', className }: SectionTitleProps) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Tag className={className ?? DEFAULT_CLASSES[Tag]}>{children}</Tag>
      {info && (
        <InfoTip label={typeof children === 'string' ? `Acerca de «${children}»` : undefined}>{info}</InfoTip>
      )}
    </div>
  );
}
