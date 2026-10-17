/**
 * The unlock that lets this tab see device secrets (IDN-086): five minutes,
 * any device. Held in module memory only — the API asks that it never reach
 * localStorage — so a reload or a sign-out drops it and asks again.
 */
let unlock: { token: string; expiresAt: number } | null = null;

/** The live unlock, or null when there is none or it has run out. */
export function getRevealUnlock(): { token: string; expiresAt: number } | null {
  if (unlock && unlock.expiresAt <= Date.now()) unlock = null;
  return unlock;
}

export function setRevealUnlock(token: string, expiresInSeconds: number): void {
  unlock = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
}

export function clearRevealUnlock(): void {
  unlock = null;
}

if (typeof window !== 'undefined') {
  // An ended session takes the unlock with it, even before the server says so.
  window.addEventListener('nms:unauthorized', clearRevealUnlock);
}
