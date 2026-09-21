import React, { useState } from 'react';
import { XIcon, EyeIcon, EyeOffIcon } from './icons';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  /** Leading icon rendered inside the field, e.g. a search glyph — pairs with `aria-label` when `label` is omitted. */
  icon?: React.ReactNode;
  /** Shows a trailing clear button while the field has a value; called instead of reaching into a synthetic event. */
  onClear?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      icon,
      onClear,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const atLimit =
      typeof props.maxLength === 'number' &&
      typeof props.value === 'string' &&
      props.value.length >= props.maxLength;
    const [revealed, setRevealed] = useState(false);
    const isPassword = props.type === 'password';
    const hasClear = !!onClear && typeof props.value === 'string' && props.value.length > 0;

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={`
              block w-full py-2 rounded-md shadow-sm transition-colors
              ${icon ? 'pl-9' : 'px-3'} ${icon && !hasClear ? 'pr-3' : ''} ${hasClear || isPassword ? 'pr-9' : ''}
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-gray-400 disabled:hover:bg-white dark:disabled:hover:border-gray-600 dark:disabled:hover:bg-gray-800
              ${
                error
                  ? 'border border-red-400 hover:border-red-500 hover:bg-red-50/40 dark:hover:bg-red-900/10 focus:border-red-500 focus:ring-red-500 focus:bg-red-50/40 dark:focus:bg-red-900/10'
                  : 'border border-gray-400 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 focus:bg-blue-50/40 dark:focus:bg-blue-900/10'
              }
              ${className}
            `}
            {...props}
            type={isPassword && revealed ? 'text' : props.type}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={revealed}
              disabled={props.disabled}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 disabled:cursor-not-allowed"
            >
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          )}

          {hasClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Limpiar"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <XIcon />
            </button>
          )}
        </div>

        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        {atLimit && !error && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-500" role="status">
            Límite de {props.maxLength} caracteres alcanzado
          </p>
        )}

        {helperText && !error && !atLimit && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
