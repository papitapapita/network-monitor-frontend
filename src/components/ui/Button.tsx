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
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
  // Filled with a faint tint (not transparent) so it doesn't wash into the
  // white card/page behind it — a plain border read as barely-there.
  outline:
    'bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 focus:ring-gray-500',
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

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  iconOnly = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        ${variantClasses[variant]}
        ${iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        rounded-md font-medium
        focus:outline-none focus:ring-2 focus:ring-offset-2
        transition-colors duration-200
        inline-flex items-center justify-center gap-1.5
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
    </button>
  );
}
