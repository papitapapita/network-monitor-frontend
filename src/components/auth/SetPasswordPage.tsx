'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import { Button, Input } from '@/components/ui';
import { AuthCard, AuthError } from '@/components/auth/AuthCard';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/constants/user.constants';

const LINK_EXPIRED = 'Reset link expired or already used';

const COPY = {
  reset: {
    title: 'Nueva contraseña',
    intro: 'Elige la contraseña nueva de tu cuenta. Las sesiones abiertas se cerrarán.',
    submit: 'Cambiar contraseña',
    done: 'Contraseña cambiada. Inicia sesión con la nueva.',
    expired: 'El enlace venció o ya se usó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».',
    missing: 'Este enlace está incompleto. Ábrelo de nuevo desde el correo, o pide uno nuevo.',
  },
  invitation: {
    title: 'Activa tu cuenta',
    intro: 'Te invitaron al sistema. Elige tu contraseña para entrar.',
    submit: 'Crear contraseña',
    done: 'Cuenta lista. Inicia sesión con tu correo y la contraseña que elegiste.',
    expired: 'La invitación venció o ya se usó. Pide al administrador que te invite de nuevo.',
    missing: 'Este enlace está incompleto. Ábrelo de nuevo desde el correo de invitación.',
  },
} as const;

const subscribeHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** The link's token rides in the fragment, which never reaches a server log. */
function useHashToken(): string | null {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '');
  return new URLSearchParams(hash.replace(/^#/, '')).get('token');
}

/**
 * `/reset-password` and `/accept-invitation`: both are a link from an email
 * that ends in `#token=`, and both set a password through the same route
 * (IDN-182, IDN-184). Neither signs anyone in.
 */
export function SetPasswordPage({ mode }: { mode: 'reset' | 'invitation' }) {
  const copy = COPY[mode];
  const token = useHashToken();
  const { isAuthenticated, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const found: typeof fieldError = {};
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      found.password = `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`;
    }
    if (confirm !== password) found.confirm = 'No coincide con la contraseña';
    setFieldError(found);
    setError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    const result = await apiService.resetPassword(token, password);
    setSubmitting(false);
    if (result.success) {
      // Whoever was signed in on this browser is not the person the link was
      // for: end that session, or "Iniciar sesión" lands back in it.
      if (isAuthenticated) logout();
      setDone(true);
      return;
    }
    if (result.error === LINK_EXPIRED) setExpired(true);
    else if (result.status === 429) setError('Demasiados intentos. Intenta de nuevo en unos minutos.');
    // The link stays usable after a password the server refused; ask again.
    else if (result.status === 400) setFieldError({ password: result.error ?? `Al menos ${PASSWORD_MIN} caracteres` });
    else setError(result.error ?? 'No se pudo guardar la contraseña.');
  };

  const toLogin = (
    <Link href="/login" className="block text-center text-sm text-blue-600 hover:underline dark:text-blue-400">
      Ir a iniciar sesión
    </Link>
  );

  if (done) {
    return (
      <AuthCard title={copy.title}>
        <div className="space-y-4">
          <p role="status" className="text-sm text-gray-700 dark:text-gray-300">{copy.done}</p>
          <Link href="/login" className="block">
            <Button type="button" fullWidth>Iniciar sesión</Button>
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (!token || expired) {
    return (
      <AuthCard title={copy.title}>
        <div className="space-y-4">
          <AuthError>{expired ? copy.expired : copy.missing}</AuthError>
          {toLogin}
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={copy.title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{copy.intro}</p>
        {error && <AuthError>{error}</AuthError>}
        <Input
          label="Contraseña nueva"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          error={fieldError.password}
          helperText={fieldError.password ? undefined : `Al menos ${PASSWORD_MIN} caracteres`}
          maxLength={PASSWORD_MAX}
          autoFocus
          required
          fullWidth
        />
        <Input
          label="Repite la contraseña"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={fieldError.confirm}
          maxLength={PASSWORD_MAX}
          required
          fullWidth
        />
        <Button type="submit" isLoading={submitting} fullWidth>
          {copy.submit}
        </Button>
        {toLogin}
      </form>
    </AuthCard>
  );
}
