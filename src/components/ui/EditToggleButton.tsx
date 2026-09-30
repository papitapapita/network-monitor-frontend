'use client';

import React from 'react';
import { IconButton } from './IconButton';
import { EditIcon, XIcon } from './icons';
import { usePermissions } from '@/hooks/usePermissions';

interface EditToggleButtonProps extends Omit<React.ComponentProps<typeof IconButton>, 'icon' | 'label' | 'onClick'> {
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  editLabel?: string;
}

/**
 * The card-header switch into and out of an inline edit form: ✎ opens it and,
 * in the same spot, ✕ cancels it. The form's footer carries only the save
 * button (`EditFormActions` with `hideCancel`), so every edit card offers one
 * way out, always in the same place.
 *
 * A user who cannot write (their role, or a read-only subscription) gets no ✎;
 * a form already open when that changes still offers its ✕.
 */
export function EditToggleButton({ isEditing, onEdit, onCancel, editLabel = 'Editar', ...props }: EditToggleButtonProps) {
  const { canWrite } = usePermissions();
  if (!isEditing && !canWrite) return null;
  return isEditing ? (
    <IconButton icon={<XIcon />} label="Cancelar" onClick={onCancel} {...props} />
  ) : (
    <IconButton icon={<EditIcon />} label={editLabel} onClick={onEdit} {...props} />
  );
}
