'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import { AssignableRole, UpdateUserDTO, UserAccountDTO } from '@/types/user.types';
import { Button, Input, Modal, Select, Switch } from '@/components/ui';
import { ASSIGNABLE_ROLE_OPTIONS, PASSWORD_MIN, PASSWORD_MAX } from '@/constants/user.constants';

interface UserFormModalProps {
  /** null creates a new account. */
  user: UserAccountDTO | null;
  isOpen: boolean;
  onClose: () => void;
  /** `invited` when a new account was sent an email to choose its own password. */
  onSaved: (user: UserAccountDTO, invited: boolean) => void;
}

/**
 * Create an account, or change one's role, status or password. Every change
 * signs that person out everywhere (IDN-013, IDN-065) except re-enabling, so
 * only what was actually changed is sent.
 *
 * A new account is invited by default: the person gets an email to choose
 * their own password (IDN-184), so nobody has to type one for them and pass
 * it on. Setting one here is the fallback for an install without email.
 */
export function UserFormModal({ user, isOpen, onClose, onSaved }: UserFormModalProps) {
  const isNew = user === null;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>(
    user && user.role !== 'VENDOR' ? user.role : 'OPERATOR'
  );
  const [disabled, setDisabled] = useState(user?.disabled ?? false);
  const [password, setPassword] = useState('');
  const [setPasswordNow, setSetPasswordNow] = useState(false);
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
    const needsPassword = isNew ? setPasswordNow : !!password;
    if (needsPassword && (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)) {
      next.password = `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSaving(true);
    let result;
    if (isNew) {
      result = await apiService.createUser({
        email: email.trim(),
        role,
        ...(setPasswordNow ? { password } : {}),
      });
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
    onSaved(result.data, isNew && !setPasswordNow);
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
        {isNew && (
          <Switch
            label="Asignar una contraseña ahora"
            info="Si no, le llega un correo con un enlace para elegir su propia contraseña. El enlace vence en siete días."
            checked={setPasswordNow}
            onChange={(e) => setSetPasswordNow(e.target.checked)}
          />
        )}
        {(!isNew || setPasswordNow) && (
          <Input
            label={isNew ? 'Contraseña' : 'Nueva contraseña'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            helperText={isNew ? `Al menos ${PASSWORD_MIN} caracteres` : 'Déjala vacía para no cambiarla.'}
            autoComplete="new-password"
            fullWidth
          />
        )}
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
          {isNew ? (setPasswordNow ? 'Crear usuario' : 'Enviar invitación') : 'Guardar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
