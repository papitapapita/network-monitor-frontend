'use client';

import React, { useEffect, useRef } from 'react';
import { IconButton } from './IconButton';
import { XIcon, CheckIcon } from './icons';
import { ButtonSize } from './Button';
import { isSubmitEnter } from './enterToSubmit';

interface EditFormActionsProps {
  onCancel: () => void;
  onSave: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  cancelLabel?: string;
  saveLabel?: string;
  size?: ButtonSize;
}

/**
 * Cancel/save icon buttons for an inline edit form, anchored beneath its
 * fields. Cancel is styled as a "danger" action since it discards changes.
 * Enter in a text field of the same card saves, like a native form would.
 */
export function EditFormActions({
  onCancel,
  onSave,
  isSaving = false,
  saveDisabled = false,
  cancelLabel = 'Cancelar',
  saveLabel = 'Guardar Cambios',
  size = 'md',
}: EditFormActionsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  });
  const blocked = isSaving || saveDisabled;

  useEffect(() => {
    const card = ref.current?.closest('[data-card]');
    if (!card || blocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSubmitEnter(e)) return;
      e.preventDefault();
      saveRef.current();
    };
    card.addEventListener('keydown', handleKeyDown as EventListener);
    return () => card.removeEventListener('keydown', handleKeyDown as EventListener);
  }, [blocked]);

  return (
    <div ref={ref} className="flex justify-end gap-2">
      <IconButton icon={<XIcon />} label={cancelLabel} variant="danger" size={size} onClick={onCancel} disabled={isSaving} />
      <IconButton icon={<CheckIcon />} label={saveLabel} variant="primary" size={size} onClick={onSave} isLoading={isSaving} disabled={saveDisabled} />
    </div>
  );
}
