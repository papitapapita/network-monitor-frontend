/**
 * A one-line message for the login form, left by the page that sent the
 * person there — "your password is set, sign in with it". Session storage, so
 * it dies with the tab and never reaches another one.
 */
const KEY = 'nms:login-notice';

export function leaveLoginNotice(message: string): void {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    // Storage blocked: the login form just shows no message.
  }
}

export function readLoginNotice(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLoginNotice(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
