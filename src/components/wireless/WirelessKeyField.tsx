'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/services/api.service';
import { getRevealUnlock, clearRevealUnlock } from '@/services/credentialReveal';
import { RevealUnlockModal } from '@/components/devices/RevealUnlockModal';
import { EyeIcon, EyeOffIcon, IconButton } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import type { RevealedWirelessKeyDTO } from '@/types/wireless.types';

const NO_KEY_LABELS: Record<Exclude<RevealedWirelessKeyDTO['security'], 'WPA_PSK'>, string> = {
  OPEN: 'Red abierta, sin clave',
  OTHER: 'WPA Enterprise o WEP: sin clave compartida',
};

interface Props {
  deviceId: string;
  /** Why the radio cannot be read from here — the backend would answer 400 or 409 without trying. */
  blockedReason: string | null;
}

/**
 * The radio's Wi-Fi key, read live from the radio (WLS-220..222, AirOS only)
 * behind the same password unlock as device credentials, and hidden again
 * when that unlock runs out. A cell of the metrics grid.
 */
export function WirelessKeyField({ deviceId, blockedReason }: Props) {
  const { showError } = useToast();
  const [revealed, setRevealed] = useState<RevealedWirelessKeyDTO | null>(null);
  const [revealedUntil, setRevealedUntil] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);

  const hideKey = useCallback(() => {
    setRevealed(null);
    setRevealedUntil(null);
  }, []);

  useEffect(() => {
    if (revealedUntil === null) return;
    const timer = setTimeout(hideKey, Math.max(0, revealedUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [revealedUntil, hideKey]);

  const reveal = async (unlock: { token: string; expiresAt: number }) => {
    setRevealing(true);
    const result = await apiService.revealWirelessKey(deviceId, unlock.token);
    setRevealing(false);
    if (result.success && result.data) {
      setRevealed(result.data);
      setRevealedUntil(unlock.expiresAt);
    } else if (result.errorField === 'revealToken') {
      // Expired early: a password or role change ended the account's sessions.
      clearRevealUnlock();
      setShowUnlock(true);
    } else {
      showError(result.error || 'No se pudo leer la clave Wi-Fi');
    }
  };

  const handleToggle = () => {
    if (revealed) {
      hideKey();
      return;
    }
    const unlock = getRevealUnlock();
    if (unlock) reveal(unlock);
    else setShowUnlock(true);
  };

  return (
    <div>
      <RevealUnlockModal
        isOpen={showUnlock}
        onClose={() => setShowUnlock(false)}
        onUnlocked={reveal}
        confirmText="Ver clave Wi-Fi"
      />
      <dt className="text-gray-500 dark:text-gray-400">Clave Wi-Fi</dt>
      <dd
        className="mt-1 flex items-center gap-2 text-gray-900 dark:text-gray-100"
        title={revealed ? `Leída del radio: ${new Date(revealed.readAt).toLocaleString('es')}` : undefined}
      >
        {!revealed ? (
          <span className="font-mono">••••••••</span>
        ) : revealed.security === 'WPA_PSK' ? (
          <span className="font-mono select-all wrap-anywhere">{revealed.key ?? '—'}</span>
        ) : (
          <span className="text-sm">{NO_KEY_LABELS[revealed.security]}</span>
        )}
        <IconButton
          icon={revealed ? <EyeOffIcon /> : <EyeIcon />}
          label={revealed ? 'Ocultar clave Wi-Fi' : blockedReason ?? 'Mostrar clave Wi-Fi (se lee del radio y pide tu contraseña)'}
          onClick={handleToggle}
          isLoading={revealing}
          disabled={!revealed && blockedReason !== null}
          data-testid="wireless-key-reveal"
        />
      </dd>
    </div>
  );
}
