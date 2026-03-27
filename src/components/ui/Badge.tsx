/**
 * Badge Component
 *
 * Displays status indicators and labels
 */

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
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200',
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200'
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

/**
 * Helper function to get badge variant for device status
 */
export function getStatusBadgeVariant(status: string): BadgeVariant {
  switch (status.toUpperCase()) {
    case 'ONLINE':
      return 'success';
    case 'OFFLINE':
      return 'danger';
    case 'MAINTENANCE':
      return 'warning';
    default:
      return 'neutral';
  }
}

/**
 * Helper function to get badge variant for activation status
 */
export function getActivationStatusBadgeVariant(status: string): BadgeVariant {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'active';
    case 'DRAFT':
      return 'draft';
    default:
      return 'neutral';
  }
}
