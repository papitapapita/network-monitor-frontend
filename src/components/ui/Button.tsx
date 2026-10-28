import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  /** Square padding for a bare icon, no label — pair with `aria-label` and a `Tooltip`. */
  iconOnly?: boolean;
  /**
   * An icon button that widens on hover or keyboard focus to show this text
   * beside its icon. Collapsed it is exactly as wide as an `iconOnly` sibling.
   */
  revealLabel?: string;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow active:bg-brand-800 focus-visible:ring-brand-500',
  secondary: 'bg-gray-600 text-white shadow-sm hover:bg-gray-700 hover:shadow active:bg-gray-800 focus-visible:ring-gray-500',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow active:bg-red-800 focus-visible:ring-red-500',
  success: 'bg-green-600 text-white shadow-sm hover:bg-green-700 hover:shadow active:bg-green-800 focus-visible:ring-green-500',
  // Filled with a faint tint (not transparent) so it doesn't wash into the
  // white card/page behind it — a plain border read as barely-there.
  outline:
    'bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 active:bg-gray-200 dark:active:bg-gray-500 focus-visible:ring-gray-500',
};

// A fixed `h-*` per size, shared by both variants below, is the standard:
// every button at a given size is exactly the same height, whether it
// carries a label or is icon-only. Sizing a text button by padding +
// line-height instead (the old approach) makes it a couple pixels off from
// its icon-only sibling — close, but never pixel-identical.
const HEIGHT: Record<ButtonSize, string> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: `${HEIGHT.sm} px-2.5 sm:px-3 text-sm`,
  md: `${HEIGHT.md} px-3 sm:px-4 text-base`,
  lg: `${HEIGHT.lg} px-4 sm:px-6 text-lg`,
};

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: `${HEIGHT.sm} w-8`,
  md: `${HEIGHT.md} w-10`,
  lg: `${HEIGHT.lg} w-12`,
};

// Collapsed, the padding plus a 16px icon matches the iconOnly width above.
const revealSizeClasses: Record<ButtonSize, string> = {
  sm: `${HEIGHT.sm} px-2 text-sm`,
  md: `${HEIGHT.md} px-3 text-base`,
  lg: `${HEIGHT.lg} px-4 text-lg`,
};

const REVEAL_SHOWN =
  'group-hover:max-w-40 group-hover:ml-1.5 group-hover:opacity-100 group-focus-visible:max-w-40 group-focus-visible:ml-1.5 group-focus-visible:opacity-100';

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  iconOnly = false,
  revealLabel,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        ${variantClasses[variant]}
        ${revealLabel ? `group ${revealSizeClasses[size]}` : iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
        rounded-md font-medium
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800
        transition-all duration-150 ease-out
        inline-flex items-center justify-center ${revealLabel ? '' : 'gap-1.5'}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
      {revealLabel && (
        <span className={`max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out ${REVEAL_SHOWN}`}>
          {revealLabel}
        </span>
      )}
    </button>
  );
}
