import React from 'react';
import { InfoTip } from './InfoTip';

interface FieldLabelProps {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  /** How the field behaves; shown behind an info icon beside the label. */
  info?: React.ReactNode;
}

/**
 * The label row every form control shares. The info icon sits outside the
 * <label> itself — a button inside a label is invalid, and clicking it would
 * also focus the field.
 */
export function FieldLabel({ htmlFor, children, required, info }: FieldLabelProps) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {children}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {info && <InfoTip label={typeof children === 'string' ? `Acerca de «${children}»` : undefined}>{info}</InfoTip>}
    </div>
  );
}
