import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      className = '',
      id,
      maxLength,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (props.name as string | undefined);
    const remaining =
      typeof maxLength === 'number'
        ? maxLength - (typeof props.value === 'string' ? props.value.length : 0)
        : undefined;

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          maxLength={maxLength}
          className={`
            block w-full px-3 py-2 rounded-md shadow-sm resize-none
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:opacity-60 disabled:cursor-not-allowed
            ${
              error
                ? 'border border-red-400 focus:border-red-500 focus:ring-red-500'
                : 'border border-gray-400 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400'
            }
            ${className}
          `}
          {...props}
        />

        {(error || helperText || remaining !== undefined) && (
          <div className="mt-1 flex items-start justify-between gap-2">
            <div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
              {!error && helperText && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
              )}
            </div>

            {remaining !== undefined && (
              <p
                className={`text-xs whitespace-nowrap ${
                  remaining <= 0
                    ? 'text-amber-600 dark:text-amber-500'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {remaining} caracteres restantes
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
