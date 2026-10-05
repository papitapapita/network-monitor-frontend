import React, { useRef, useState } from 'react';
import { XIcon, EyeIcon, EyeOffIcon, ChevronDownIcon } from './icons';
import { FieldLabel } from './FieldLabel';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Status shown under the field, e.g. "Buscando…". Explanations of behavior go in `info`. */
  helperText?: string;
  /** How the field behaves; shown behind an info icon beside the label. */
  info?: React.ReactNode;
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
      info,
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
    // Number fields get our own stepper in place of the browser's spinner,
    // which globals.css hides.
    const hasStepper = props.type === 'number' && !props.readOnly;
    const innerRef = useRef<HTMLInputElement | null>(null);
    const setRefs = (el: HTMLInputElement | null) => {
      innerRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    };

    const step = (direction: 1 | -1) => {
      const el = innerRef.current;
      if (!el) return;
      // `step="any"` makes the native stepUp() throw, so do the arithmetic here.
      const size = props.step && props.step !== 'any' ? Number(props.step) : 1;
      const current = Number(el.value);
      let next = (Number.isFinite(current) ? current : 0) + direction * size;
      if (props.min !== undefined && props.min !== '') next = Math.max(next, Number(props.min));
      if (props.max !== undefined && props.max !== '') next = Math.min(next, Number(props.max));
      // Drop float noise such as 0.30000000000000004.
      next = Math.round(next * 1e6) / 1e6;
      // Go through the native setter and an input event, so the parent's
      // onChange sees it exactly like a keystroke.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, String(next));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.focus();
    };

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <FieldLabel htmlFor={inputId} required={props.required} info={info}>
            {label}
          </FieldLabel>
        )}

        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
              {icon}
            </span>
          )}

          <input
            ref={setRefs}
            id={inputId}
            className={`
              block w-full py-2 rounded-md shadow-sm transition-colors
              ${icon ? 'pl-9' : 'px-3'} ${icon && !hasClear ? 'pr-3' : ''} ${hasClear || isPassword ? 'pr-9' : ''} ${hasStepper ? 'pr-10' : ''}
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

          {hasStepper && (
            <div className="absolute inset-y-px right-px flex w-7 flex-col overflow-hidden rounded-r-md border-l border-gray-300 dark:border-gray-600">
              {([1, -1] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  tabIndex={-1}
                  aria-label={direction === 1 ? 'Aumentar' : 'Disminuir'}
                  disabled={props.disabled}
                  // Keep focus where it is; step() hands it to the field.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => step(direction)}
                  className={`flex flex-1 items-center justify-center text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                    direction === 1 ? 'border-b border-gray-300 dark:border-gray-600' : ''
                  }`}
                >
                  <ChevronDownIcon className={`h-3 w-3 ${direction === 1 ? 'rotate-180' : ''}`} />
                </button>
              ))}
            </div>
          )}

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
