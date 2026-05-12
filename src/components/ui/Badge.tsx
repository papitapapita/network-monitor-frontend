import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'draft'
  | 'active';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success:
    'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800',
  warning:
    'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  danger:
    'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800',
  info:
    'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  neutral:
    'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  draft:
    'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  active:
    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
};

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        ${variantClasses[variant]}
        inline-flex items-center px-2.5 py-0.5
        rounded-full text-xs font-medium border
        ${className}
      `}
    >
      {children}
    </span>
  );
}

export function getDeviceStatusBadgeVariant(status: string): BadgeVariant {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'success';
    case 'DAMAGED':
      return 'danger';
    case 'INVENTORY':
    default:
      return 'neutral';
  }
}

export function getPollingStatusBadgeVariant(status: string): BadgeVariant {
  switch (status.toUpperCase()) {
    case 'ONLINE':
      return 'success';
    case 'OFFLINE':
      return 'danger';
    case 'UNKNOWN':
    default:
      return 'neutral';
  }
}
