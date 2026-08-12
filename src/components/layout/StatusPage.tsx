import React from 'react';
import Link from 'next/link';

interface StatusPageAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface StatusPageProps {
  code?: string;
  icon: React.ReactNode;
  iconTone?: 'blue' | 'amber' | 'red';
  title: string;
  description: string;
  primaryAction?: StatusPageAction;
  secondaryAction?: StatusPageAction;
  /** Use min-h-screen instead of a shell-relative height (needed outside AppShell, e.g. global-error). */
  fullScreen?: boolean;
}

const toneClasses: Record<NonNullable<StatusPageProps['iconTone']>, string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
};

function ActionButton({ action, variant }: { action: StatusPageAction; variant: 'primary' | 'outline' }) {
  const variantClasses =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
      : 'bg-transparent border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:ring-gray-500';

  const className = `inline-flex items-center justify-center rounded-md font-medium px-5 py-2.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${variantClasses}`;

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

/** Shared layout for 404 / error boundaries — the "nice" full-page states shown instead of a blank screen. */
export function StatusPage({
  code,
  icon,
  iconTone = 'blue',
  title,
  description,
  primaryAction,
  secondaryAction,
  fullScreen = false,
}: StatusPageProps) {
  return (
    <div
      className={`flex items-center justify-center px-4 py-16 ${fullScreen ? 'min-h-screen' : 'min-h-[70vh]'}`}
    >
      <div className="w-full max-w-md text-center">
        <div
          className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ${toneClasses[iconTone]}`}
        >
          {icon}
        </div>
        {code && (
          <p className="text-sm font-semibold tracking-wide text-blue-600 dark:text-blue-400 mb-2">
            {code}
          </p>
        )}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">{description}</p>
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {primaryAction && <ActionButton action={primaryAction} variant="primary" />}
            {secondaryAction && <ActionButton action={secondaryAction} variant="outline" />}
          </div>
        )}
      </div>
    </div>
  );
}
