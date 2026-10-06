'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useAuth } from '@/contexts/auth.context';
import { apiService } from '@/services/api.service';
import { Button, Checkbox, Input } from '@/components/ui';
import { AuthCard, AuthError } from '@/components/auth/AuthCard';
import { RecoveryCodes } from '@/components/auth/RecoveryCodes';
import { signInError, STEP_EXPIRED } from '@/components/auth/signInErrors';
import { clearLoginNotice, readLoginNotice } from '@/components/auth/loginNotice';
import type { SessionDTO, TwoFactorSetupDTO } from '@/types/auth.types';
import type { ApiResponse } from '@/types/common.types';

/**
 * Sign-in is a password, then a code from an authenticator app (IDN-166). The
 * first time, the code step sets the app up and ends on the recovery codes.
 * A remembered browser skips the code altogether.
 */
type Step =
  | { kind: 'password' }
  | { kind: 'forgot' }
  | { kind: 'setup'; challengeToken: string; setup: TwoFactorSetupDTO | null }
  | { kind: 'verify'; challengeToken: string; recovery: boolean }
  | { kind: 'codes'; session: SessionDTO; codes: string[] };

const TITLES: Record<Step['kind'], string> = {
  password: 'Iniciar sesión',
  forgot: 'Recuperar contraseña',
  setup: 'Configura la verificación en dos pasos',
  verify: 'Verificación en dos pasos',
  codes: 'Códigos de recuperación',
};

export default function LoginPage() {
  const router = useRouter();
  const { beginSession, isAuthenticated, isLoading } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [error, setError] = useState<string | null>(null);
  // Up here so going back from a code screen keeps what was typed.
  const [email, setEmail] = useState('');
  // Left by /reset-password or /accept-invitation; shown once, on this visit.
  const [notice] = useState(() => (typeof window === 'undefined' ? null : readLoginNotice()));

  useEffect(() => {
    if (notice) clearLoginNotice();
  }, [notice]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  /** On an expired challenge every code screen goes back to the password. */
  const handleStepFailure = (result: ApiResponse<unknown>, kind: 'code' | 'recovery'): void => {
    const message = signInError(result, kind);
    if (result.error === STEP_EXPIRED) setStep({ kind: 'password' });
    setError(message);
  };

  const finish = (session: SessionDTO) => {
    beginSession(session);
    router.replace('/');
  };

  if (isLoading || isAuthenticated) return null;

  return (
    <AuthCard title={TITLES[step.kind]}>
      <div className="space-y-4">
        {(step.kind === 'setup' || step.kind === 'verify') && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Cuenta: <strong className="text-gray-900 dark:text-gray-100 wrap-anywhere">{email}</strong>
          </p>
        )}

        {notice && step.kind === 'password' && !error && (
          <div
            role="status"
            className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-300"
          >
            {notice}
          </div>
        )}

        {error && <AuthError>{error}</AuthError>}

        {step.kind === 'password' && (
          <PasswordStep
            email={email}
            onEmailChange={setEmail}
            onError={setError}
            onSession={finish}
            onForgot={() => {
              setError(null);
              setStep({ kind: 'forgot' });
            }}
            onChallenge={(twoFactor, challengeToken) => {
              setError(null);
              setStep(
                twoFactor === 'setup'
                  ? { kind: 'setup', challengeToken, setup: null }
                  : { kind: 'verify', challengeToken, recovery: false },
              );
            }}
          />
        )}

        {step.kind === 'setup' && (
          <SetupStep
            step={step}
            onSetup={(setup) => setStep({ ...step, setup })}
            onAlreadyOn={() => setStep({ kind: 'verify', challengeToken: step.challengeToken, recovery: false })}
            onError={(result) => handleStepFailure(result, 'code')}
            onClearError={() => setError(null)}
            onConfirmed={(session, codes) => {
              setError(null);
              setStep({ kind: 'codes', session, codes });
            }}
          />
        )}

        {step.kind === 'verify' && (
          <VerifyStep
            step={step}
            onToggleRecovery={() => {
              setError(null);
              setStep({ ...step, recovery: !step.recovery });
            }}
            onError={(result) => handleStepFailure(result, step.recovery ? 'recovery' : 'code')}
            onClearError={() => setError(null)}
            onSession={finish}
          />
        )}

        {step.kind === 'forgot' && <ForgotStep email={email} onEmailChange={setEmail} onError={setError} />}

        {step.kind === 'codes' && <RecoveryCodes codes={step.codes} onDone={() => finish(step.session)} />}

        {step.kind !== 'password' && step.kind !== 'codes' && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep({ kind: 'password' });
            }}
            className="block w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Volver al inicio de sesión
          </button>
        )}
      </div>
    </AuthCard>
  );
}

function PasswordStep({
  email,
  onEmailChange,
  onError,
  onSession,
  onForgot,
  onChallenge,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  onError: (message: string | null) => void;
  onSession: (session: SessionDTO) => void;
  onForgot: () => void;
  onChallenge: (twoFactor: 'setup' | 'verify', challengeToken: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    setSubmitting(true);
    const result = await apiService.login(email, password);
    setSubmitting(false);
    if (!result.success || !result.data) {
      onError(signInError(result, 'password'));
      return;
    }
    const data = result.data;
    if ('token' in data) onSession(data);
    else onChallenge(data.twoFactor, data.challengeToken);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Correo electrónico"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        autoComplete="email"
        required
        fullWidth
      />

      <Input
        label="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        fullWidth
      />

      <Button type="submit" isLoading={submitting} fullWidth className="mt-2">
        Ingresar
      </Button>

      <button
        type="button"
        onClick={onForgot}
        className="block w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}

/**
 * Asks for a reset link. The answer is the same whether or not the address
 * has an account (IDN-182), and so is what this says.
 */
function ForgotStep({
  email,
  onEmailChange,
  onError,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  onError: (message: string | null) => void;
}) {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    setSubmitting(true);
    const result = await apiService.forgotPassword(email);
    setSubmitting(false);
    if (result.status === 429) {
      onError('Demasiadas solicitudes. Intenta de nuevo en unos minutos.');
      return;
    }
    if (result.status === 400) {
      onError('Escribe un correo válido.');
      return;
    }
    // Anything else reads the same as a sent link: saying otherwise would
    // tell a stranger which addresses have an account.
    setSent(true);
  };

  if (sent) {
    return (
      <p role="status" className="text-sm text-gray-700 dark:text-gray-300">
        Si <strong>{email}</strong> tiene una cuenta, le enviamos un enlace para elegir una contraseña nueva. Vence
        en una hora y sirve una sola vez.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
      </p>
      <Input
        label="Correo electrónico"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        autoComplete="email"
        autoFocus
        required
        fullWidth
      />
      <Button type="submit" isLoading={submitting} fullWidth>
        Enviar enlace
      </Button>
    </form>
  );
}

/** Six digits from the app. Submits on its own once the sixth is typed. */
function CodeField({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: (code: string) => void;
  disabled: boolean;
}) {
  return (
    <Input
      label="Código de verificación"
      value={value}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
        onChange(digits);
        if (digits.length === 6 && digits !== value) onComplete(digits);
      }}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="123456"
      maxLength={6}
      disabled={disabled}
      autoFocus
      required
      fullWidth
      className="font-mono tracking-[0.3em]"
    />
  );
}

function RememberBrowser({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Checkbox
      id="remember-browser"
      label="Recordar este navegador por 30 días"
      info="No pedirá el código en este navegador durante 30 días, o hasta que cambie la contraseña, el rol o el estado de la cuenta."
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

function SetupStep({
  step,
  onSetup,
  onAlreadyOn,
  onError,
  onClearError,
  onConfirmed,
}: {
  step: Extract<Step, { kind: 'setup' }>;
  onSetup: (setup: TwoFactorSetupDTO) => void;
  onAlreadyOn: () => void;
  onError: (result: ApiResponse<unknown>) => void;
  onClearError: () => void;
  onConfirmed: (session: SessionDTO, codes: string[]) => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  // Each call to /setup replaces the secret, so a remount in development must
  // not ask twice and leave the QR on screen pointing at the old one.
  const requested = useRef(false);
  const { challengeToken, setup } = step;

  const start = async () => {
    const result = await apiService.startTwoFactorSetup(challengeToken);
    if (result.success && result.data) onSetup(result.data);
    else if (result.status === 409) onAlreadyOn();
    else onError(result);
  };

  useEffect(() => {
    if (setup || requested.current) return;
    requested.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);

  useEffect(() => {
    if (!setup) return;
    let cancelled = false;
    QRCode.toDataURL(setup.otpauthUri, { margin: 1, width: 200 }).then(
      (url) => !cancelled && setQr(url),
      () => !cancelled && setQr(null),
    );
    return () => {
      cancelled = true;
    };
  }, [setup]);

  const confirm = async (value: string) => {
    if (submitting) return;
    onClearError();
    setSubmitting(true);
    const result = await apiService.confirmTwoFactorSetup(challengeToken, value, remember);
    setSubmitting(false);
    if (result.success && result.data) {
      const { recoveryCodes, ...session } = result.data;
      onConfirmed(session, recoveryCodes);
      return;
    }
    setCode('');
    // The secret was lost on the server's side; a fresh one means a fresh QR.
    if (result.status === 409) {
      requested.current = false;
      void start();
      return;
    }
    onError(result);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void confirm(code);
      }}
      className="space-y-4"
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Escanea el código con una aplicación de autenticación (Google Authenticator, Microsoft Authenticator,
        Authy…) y escribe el código de 6 dígitos que muestra.
      </p>

      <div className="flex justify-center">
        {/* White behind the QR in both themes: scanners want dark-on-light. */}
        <div className="h-[200px] w-[200px] rounded-lg bg-white p-0 flex items-center justify-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Código QR para la aplicación de autenticación" width={200} height={200} />
          ) : (
            <span className="text-sm text-gray-400">Generando…</span>
          )}
        </div>
      </div>

      {setup && (
        <div className="text-center">
          {showSecret ? (
            <code className="block break-all rounded bg-gray-50 dark:bg-gray-900 px-2 py-1 text-xs text-gray-800 dark:text-gray-200">
              {setup.secret}
            </code>
          ) : (
            <button
              type="button"
              onClick={() => setShowSecret(true)}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              ¿No puedes escanear? Escribe la clave
            </button>
          )}
        </div>
      )}

      <CodeField value={code} onChange={setCode} onComplete={confirm} disabled={!setup || submitting} />
      <RememberBrowser checked={remember} onChange={setRemember} />

      <Button type="submit" isLoading={submitting} disabled={!setup || code.length !== 6} fullWidth>
        Activar y continuar
      </Button>
    </form>
  );
}

function VerifyStep({
  step,
  onToggleRecovery,
  onError,
  onClearError,
  onSession,
}: {
  step: Extract<Step, { kind: 'verify' }>;
  onToggleRecovery: () => void;
  onError: (result: ApiResponse<unknown>) => void;
  onClearError: () => void;
  onSession: (session: SessionDTO) => void;
}) {
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const verify = async (value: string) => {
    if (submitting) return;
    onClearError();
    setSubmitting(true);
    const result = await apiService.verifyTwoFactor(
      step.challengeToken,
      step.recovery
        ? { recoveryCode: value, rememberBrowser: remember }
        : { code: value, rememberBrowser: remember },
    );
    setSubmitting(false);
    if (result.success && result.data) {
      onSession(result.data);
      return;
    }
    setCode('');
    onError(result);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void verify(step.recovery ? recoveryCode : code);
      }}
      className="space-y-4"
    >
      {step.recovery ? (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Escribe uno de los códigos de recuperación que guardaste al activar la verificación. Cada uno sirve una
            sola vez.
          </p>
          <Input
            label="Código de recuperación"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder="XXXXX-XXXXX"
            autoComplete="off"
            autoFocus
            required
            fullWidth
            className="font-mono"
          />
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Escribe el código de 6 dígitos de tu aplicación de autenticación.
          </p>
          <CodeField value={code} onChange={setCode} onComplete={verify} disabled={submitting} />
        </>
      )}

      <RememberBrowser checked={remember} onChange={setRemember} />

      <Button
        type="submit"
        isLoading={submitting}
        disabled={step.recovery ? !recoveryCode.trim() : code.length !== 6}
        fullWidth
      >
        Verificar
      </Button>

      <button
        type="button"
        onClick={onToggleRecovery}
        className="block w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        {step.recovery ? 'Usar el código de la aplicación' : 'Perdí mi teléfono'}
      </button>
    </form>
  );
}
