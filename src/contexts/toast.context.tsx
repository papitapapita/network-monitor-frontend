'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ToastViewport, type ToastItem, type ToastVariant } from '@/components/ui/Toast';

interface ToastOptions {
  /** Extra lines under the headline. */
  details?: string[];
  /** Milliseconds on screen; 0 keeps it up until dismissed. */
  duration?: number;
}

interface ToastContextValue {
  showToast: (variant: ToastVariant, title: string, options?: ToastOptions) => void;
  showError: (message: string, options?: ToastOptions) => void;
  showSuccess: (message: string, options?: ToastOptions) => void;
  /**
   * Reports the field errors a form just rejected. Returns false when there was
   * nothing to report, so a submit handler can read as
   * `if (showFormErrors(errors)) return;`.
   */
  showFormErrors: (errors: Record<string, string | undefined>, title?: string) => boolean;
  dismissToast: (id: string) => void;
}

/** How long each kind stays up. Errors get longer, they have to be read. */
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  error: 7000,
  success: 4000,
  info: 5000,
};

/** Beyond this the list stops being scannable, so the rest is counted instead. */
const MAX_DETAIL_LINES = 4;

/** Older notices drop off rather than filling the screen. */
const MAX_TOASTS = 3;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (variant: ToastVariant, title: string, options?: ToastOptions) => {
      const details = options?.details?.filter(Boolean);
      setToasts((prev) => {
        // Submitting the same broken form twice should re-announce the problem,
        // not stack a second identical card: drop the old one and re-enter, so
        // the animation replays and the countdown starts over.
        const withoutDuplicate = prev.filter(
          (t) =>
            t.variant !== variant ||
            t.title !== title ||
            (t.details ?? []).join(' ') !== (details ?? []).join(' '),
        );
        const toast: ToastItem = {
          id: `toast-${nextId.current++}`,
          variant,
          title,
          details,
          duration: options?.duration ?? DEFAULT_DURATION[variant],
        };
        return [...withoutDuplicate, toast].slice(-MAX_TOASTS);
      });
    },
    [],
  );

  const showError = useCallback(
    (message: string, options?: ToastOptions) => showToast('error', message, options),
    [showToast],
  );

  const showSuccess = useCallback(
    (message: string, options?: ToastOptions) => showToast('success', message, options),
    [showToast],
  );

  const showFormErrors = useCallback(
    (errors: Record<string, string | undefined>, title?: string) => {
      // The same rule can land on two fields (an either/or identifier, a date
      // range), and repeating its message reads like two separate problems.
      const messages = [...new Set(Object.values(errors).filter((m): m is string => !!m))];
      if (messages.length === 0) return false;

      if (messages.length === 1) {
        showError(title ?? messages[0], title ? { details: messages } : undefined);
        return true;
      }

      const shown = messages.slice(0, MAX_DETAIL_LINES);
      const hidden = messages.length - shown.length;
      if (hidden > 0) shown.push(`y ${hidden} error${hidden === 1 ? '' : 'es'} más`);
      showError(title ?? `Revisa el formulario: ${messages.length} campos con errores`, {
        details: shown,
      });
      return true;
    },
    [showError],
  );

  const value = useMemo(
    () => ({ showToast, showError, showSuccess, showFormErrors, dismissToast }),
    [showToast, showError, showSuccess, showFormErrors, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de un ToastProvider');
  return ctx;
}
