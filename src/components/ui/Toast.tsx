'use client';

import React, { useEffect, useState } from 'react';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  /** The headline. For a single problem this is the whole message. */
  title: string;
  /** Extra lines — one per offending field when a form fails validation. */
  details?: string[];
  /** Milliseconds on screen; 0 keeps it up until dismissed. */
  duration: number;
}

const variantClasses: Record<ToastVariant, string> = {
  error:
    'bg-red-600/90 dark:bg-red-900/85 border-red-300/50 dark:border-red-500/40',
  success:
    'bg-emerald-600/90 dark:bg-emerald-900/85 border-emerald-300/50 dark:border-emerald-500/40',
  info:
    'bg-blue-600/90 dark:bg-blue-900/85 border-blue-300/50 dark:border-blue-500/40',
};

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const common = 'h-5 w-5 shrink-0';
  if (variant === 'success') {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (variant === 'info') {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    );
  }
  return (
    <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

/**
 * One floating notice. It owns its own countdown so hovering — the thing an
 * operator does while reading a list of rejected fields — holds it on screen.
 */
export function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || toast.duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [paused, toast.duration, toast.id, onDismiss]);

  return (
    <div
      data-testid="toast"
      data-variant={toast.variant}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`
        pointer-events-auto animate-toast-in overflow-hidden rounded-lg border
        px-4 py-3 text-white shadow-lg shadow-black/20 backdrop-blur-md
        ${variantClasses[toast.variant]}
      `}
    >
      <div className="flex items-start gap-3">
        <VariantIcon variant={toast.variant} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium break-words">{toast.title}</p>
          {toast.details && toast.details.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-sm text-white/90">
              {toast.details.map((detail, i) => (
                <li key={i} className="flex gap-1.5 break-words">
                  <span aria-hidden="true">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded text-white/70 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <span className="sr-only">Descartar</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

/**
 * Where the notices live: pinned to the viewport, above every modal, and
 * click-through everywhere except on the cards themselves.
 */
export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  // Rendered even while empty: a live region has to be in the document before
  // its content changes for a screen reader to announce the change.
  return (
    <div
      aria-live="assertive"
      aria-atomic="false"
      className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(calc(100vw-2rem),24rem)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
