'use client';
import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
}

/**
 * A real native checkbox (full keyboard/label/form semantics) with the box
 * itself made invisible and a styled decorative box + checkmark drawn in its
 * place — matches SelectCheckbox's look without giving up native `<input>`
 * behavior, which every form here still relies on via `e.target.checked`.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, id, className = '', disabled, ...props }, ref) => {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
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
              pointer-events-none absolute inset-0 rounded border-2 transition-all duration-150
              border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800
              peer-hover:border-blue-400 dark:peer-hover:border-blue-500
              peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:shadow-sm
              peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-1 dark:peer-focus-visible:ring-offset-gray-800
              peer-disabled:opacity-40 peer-disabled:cursor-not-allowed
              peer-disabled:border-gray-300 dark:peer-disabled:border-gray-600
            "
          />
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto h-2.5 w-2.5 text-white opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
            fill="none"
            viewBox="0 0 10 10"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-4.5" />
          </svg>
        </span>
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
      </span>
    );
  }
);

Checkbox.displayName = 'Checkbox';
