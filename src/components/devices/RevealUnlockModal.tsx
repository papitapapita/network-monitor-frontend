'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import { getRevealUnlock, setRevealUnlock } from '@/services/credentialReveal';
import { Input, Button, Modal } from '@/components/ui';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The fresh unlock, already stored for the other reveals on the page. */
  onUnlocked: (unlock: { token: string; expiresAt: number }) => void | Promise<void>;
  /** What the confirm button opens, e.g. "Ver credenciales". */
  confirmText: string;
}

/**
 * Asks for the user's own password before any plaintext secret (IDN-086): a
 * device's credentials or a radio's Wi-Fi key. One unlock serves both, on any
 * device, for five minutes.
 */
export function RevealUnlockModal({ isOpen, onClose, onUnlocked, confirmText }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Cleared on the way out, so the next opening starts blank.
  const close = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  const handleUnlock = async () => {
    if (!password) {
      setError('Escribe tu contraseña.');
      return;
    }
    setUnlocking(true);
    setError(null);
    const result = await apiService.unlockCredentialReveal(password);
    setUnlocking(false);
    if (result.success && result.data) {
      setRevealUnlock(result.data.revealToken, result.data.expiresInSeconds);
      close();
      const unlock = getRevealUnlock();
      if (unlock) await onUnlocked(unlock);
    } else {
      setError(result.error || 'No se pudo verificar la contraseña');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Confirma tu contraseña"
      info="Ver credenciales o claves en texto plano pide tu contraseña. Vale 5 minutos para cualquier dispositivo, y cada consulta queda registrada."
      size="sm"
      onSubmit={handleUnlock}
    >
      <Input
        label="Tu contraseña"
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(null);
        }}
        error={error ?? undefined}
        autoComplete="current-password"
        autoFocus
        fullWidth
      />
      <Modal.Footer>
        <Button variant="outline" onClick={close} disabled={unlocking}>
          Cancelar
        </Button>
        <Button onClick={handleUnlock} isLoading={unlocking}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
