'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import { useToast } from '@/contexts/toast.context';
import { Button, Input } from '@/components/ui';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/constants/user.constants';

/**
 * Every role changes its own password with the current one (IDN-144). The
 * change signs the account out everywhere; the answer sets a fresh session
 * cookie, so this browser stays signed in without doing anything.
 */
export function ChangePasswordCard() {
  const { showSuccess } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!current) found.currentPassword = 'Escribe tu contraseña actual';
    if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) found.newPassword = `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`;
    else if (next !== confirm) found.confirm = 'No coincide con la nueva contraseña';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setIsSaving(true);
    const result = await apiService.changeMyPassword({ currentPassword: current, newPassword: next });
    setIsSaving(false);
    if (!result.success) {
      setErrors({ [result.errorField ?? 'form']: result.error || 'No se pudo cambiar la contraseña' });
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    showSuccess('Contraseña cambiada. Las demás sesiones abiertas de tu cuenta se cerraron.');
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cambiar mi contraseña</h2>
      </div>
      <form onSubmit={submit} className="px-6 py-5 space-y-4">
        <Input
          label="Contraseña actual"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.currentPassword}
          autoComplete="current-password"
          fullWidth
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nueva contraseña"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={errors.newPassword}
            helperText={errors.newPassword ? undefined : `Al menos ${PASSWORD_MIN} caracteres`}
            autoComplete="new-password"
            fullWidth
          />
          <Input
            label="Repite la nueva contraseña"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
            autoComplete="new-password"
            fullWidth
          />
        </div>
        {errors.form && <p className="text-sm text-red-700 dark:text-red-400">{errors.form}</p>}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Al cambiarla se cierran las sesiones que tengas abiertas en otros equipos; esta sigue abierta.
        </p>
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving}>
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </section>
  );
}
