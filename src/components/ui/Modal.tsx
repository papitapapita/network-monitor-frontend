/**
 * Modal Component
 *
 * Dialog/overlay component for confirmations and forms
 */

'use client';

import React, { useEffect } from 'react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  transparentBackdrop?: boolean;
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  transparentBackdrop = false,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 transition-opacity ${
          transparentBackdrop
            ? 'bg-black/40'
            : 'bg-gray-500/75 dark:bg-gray-900/80'
        }`}
        onClick={onClose}
      />

      {/* Modal container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`
            relative transform overflow-hidden rounded-lg
            bg-white dark:bg-gray-800
            text-left shadow-xl transition-all w-full
            ${sizeClasses[size]}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                id="modal-title"
              >
                {title}
              </h3>
              {showCloseButton && (
                <button
                  type="button"
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition-colors"
                  onClick={onClose}
                >
                  <span className="sr-only">Cerrar</span>
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="bg-white dark:bg-gray-800 px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div
      className={`
        bg-gray-50 dark:bg-gray-800/50 px-6 py-4
        border-t border-gray-200 dark:border-gray-700
        flex items-center justify-end gap-3
        ${className}
      `}
    >
      {children}
    </div>
  );
}

Modal.Footer = ModalFooter;

/**
 * Confirmation Modal
 *
 * Pre-configured modal for confirmations
 */
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{message}</p>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={variant}
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

interface UndoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUndo: () => void;
  title: string;
  message: string;
  /** Hidden when the viewer lacks the authority to undo — restoring is ADMIN work. */
  canUndo?: boolean;
  isUndoing?: boolean;
  /** A failed undo, shown in place rather than behind the modal. */
  error?: string | null;
  closeText?: string;
}

/**
 * What a delete leaves behind: one line saying it happened and the undo. The
 * point is to be small — an operator who meant to delete dismisses it without
 * reading, and the one who did not needs a single button, so anything else on
 * it (grace-period prose, links to the bin) only stands between them and that
 * button. The detail is still on the bin page for whoever wants it.
 */
export function UndoModal({
  isOpen,
  onClose,
  onUndo,
  title,
  message,
  canUndo = true,
  isUndoing = false,
  error = null,
  closeText = 'Cerrar',
}: UndoModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-300">{message}</p>
        {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
      </div>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose} disabled={isUndoing}>
          {closeText}
        </Button>
        {canUndo && (
          <Button onClick={onUndo} isLoading={isUndoing}>
            Deshacer
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
