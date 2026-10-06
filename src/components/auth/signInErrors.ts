import type { ApiResponse } from '@/types/common.types';

/** The challenge ran out (5 minutes) or is the wrong kind: start over from the password. */
export const STEP_EXPIRED = 'Sign-in step expired. Sign in again.';

const TRY_LATER = 'Demasiados intentos. Intenta de nuevo en unos minutos.';

/**
 * Puts a sign-in step's refusal into words. Neither 429 means the password is
 * wrong — the account is paused after five misses (IDN-044), or the address
 * after ten in 15 minutes (IDN-103) — so both read as "wait", not "retry".
 */
export function signInError(result: ApiResponse<unknown>, kind: 'password' | 'code' | 'recovery'): string {
  if (result.status === 429) return TRY_LATER;
  if (result.error === STEP_EXPIRED) return 'La verificación tardó demasiado. Inicia sesión de nuevo.';
  if (result.status === 401) {
    if (kind === 'password') return 'Correo o contraseña incorrectos.';
    if (kind === 'recovery') return 'Código de recuperación incorrecto o ya usado.';
    return 'Código incorrecto. Revisa la aplicación e intenta de nuevo.';
  }
  return result.error ?? 'No se pudo iniciar sesión.';
}
