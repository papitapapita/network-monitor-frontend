'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import { AssignableRole, UpdateUserDTO, UserAccountDTO } from '@/types/user.types';
import { Button, Input, Modal, Select, Switch } from '@/components/ui';
import { ASSIGNABLE_ROLE_OPTIONS, STAFF_PASSWORD_MIN, STAFF_PASSWORD_MAX } from '@/constants/user.constants';

interface UserFormModalProps {
  /** null creates a new account. */
  user: UserAccountDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (user: UserAccountDTO) => void;
}

/**
 * Create an account, or change one's role, status or password. Every change
 * signs that person out everywhere (IDN-013, IDN-065) except re-enabling, so
 * only what was actually changed is sent.
 */
export function UserFormModal({ user, isOpen, onClose, onSaved }: UserFormModalProps) {
  const isNew = user === null;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>(
    user && user.role !== 'VENDOR' ? user.role : 'OPERATOR'
  );
  const [disabled, setDisabled] = useState(user?.disabled ?? false);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const close = () => {
    setErrors({});
    setPassword('');
    onClose();
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (isNew && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Escribe un correo válido';
    if ((isNew || password) && (password.length < STAFF_PASSWORD_MIN || password.length > STAFF_PASSWORD_MAX)) {
      next.password = `Entre ${STAFF_PASSWORD_MIN} y ${STAFF_PASSWORD_MAX} caracteres`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSaving(true);
    let result;
    if (isNew) {
      result = await apiService.createUser({ email: email.trim(), password, role });
    } else {
      const dto: UpdateUserDTO = {};
      if (role !== user.role) dto.role = role;
      if (disabled !== user.disabled) dto.disabled = disabled;
      if (password) dto.password = password;
      if (Object.keys(dto).length === 0) {
        setIsSaving(false);
        close();
        return;
      }
      result = await apiService.updateUser(user.id, dto);
    }
    setIsSaving(false);
    if (!result.success || !result.data) {
      setErrors({ [result.errorField ?? 'form']: result.error || 'No se pudo guardar el usuario' });
      return;
    }
    setPassword('');
    onSaved(result.data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={isNew ? 'Nuevo usuario' : `Editar ${user.email}`}
      onSubmit={submit}
      info={isNew ? undefined : 'Cualquier cambio cierra las sesiones abiertas de este usuario, salvo reactivarlo.'}
    >
      <div className="space-y-4">
        {isNew && (
          <Input
            label="Correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoFocus
            fullWidth
          />
        )}
        <Select
          label="Rol"
          options={ASSIGNABLE_ROLE_OPTIONS}
          value={role}
          onChange={(e) => setRole(e.target.value as AssignableRole)}
          fullWidth
        />
        <Input
          label={isNew ? 'Contraseña' : 'Nueva contraseña'}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          helperText={isNew ? undefined : 'Déjala vacía para no cambiarla.'}
          autoComplete="new-password"
          fullWidth
        />
        {!isNew && (
          <Switch
            label="Cuenta deshabilitada"
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
          />
        )}
        {errors.form && <p className="text-sm text-red-700 dark:text-red-400">{errors.form}</p>}
      </div>
      <Modal.Footer>
        <Button variant="outline" onClick={close} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={submit} isLoading={isSaving}>
          {isNew ? 'Crear usuario' : 'Guardar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
