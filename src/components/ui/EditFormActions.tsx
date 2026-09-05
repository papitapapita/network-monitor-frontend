'use client';

import React from 'react';
import { IconButton } from './IconButton';
import { XIcon, CheckIcon } from './icons';
import { ButtonSize } from './Button';

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
  return (
    <div className="flex justify-end gap-2">
      <IconButton icon={<XIcon />} label={cancelLabel} variant="danger" size={size} onClick={onCancel} disabled={isSaving} />
      <IconButton icon={<CheckIcon />} label={saveLabel} variant="primary" size={size} onClick={onSave} isLoading={isSaving} disabled={saveDisabled} />
    </div>
  );
}
