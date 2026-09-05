'use client';
import React from 'react';

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

/**
 * A real native checkbox (full keyboard/label/form semantics) with the box
 * itself made invisible and a styled track + thumb drawn in its place —
 * same technique as Checkbox, `e.target.checked` still works for callers.
 */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, id, className = '', disabled, ...props }, ref) => {
    return (
      <span className={`inline-flex items-start gap-3 ${className}`}>
        <span className="relative inline-flex h-6 w-11 shrink-0">
          <input
            ref={ref}
            type="checkbox"
            id={id}
            disabled={disabled}
            className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            {...props}
          />
          <span
            aria-hidden="true"
            className="
              pointer-events-none absolute inset-0 rounded-full transition-colors duration-150
              bg-gray-300 dark:bg-gray-600
              peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500
              peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-gray-800
              peer-disabled:opacity-40
            "
          />
          <span
            aria-hidden="true"
            className="
              pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow
              transition-transform duration-150
              peer-checked:translate-x-5
            "
          />
        </span>
        {(label || description) && (
          <span className="flex flex-col">
            {label && (
              <label
                htmlFor={id}
                className={`text-sm font-medium select-none ${
                  disabled
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'text-gray-700 dark:text-gray-300 cursor-pointer'
                }`}
              >
                {label}
              </label>
            )}
            {description && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{description}</span>
            )}
          </span>
        )}
      </span>
    );
  }
);

Switch.displayName = 'Switch';
