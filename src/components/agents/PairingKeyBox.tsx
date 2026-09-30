'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { formatAgentDate } from '@/constants/agent.constants';

interface PairingKeyBoxProps {
  pairingKey: string;
  expiresAt: string | null;
}

/**
 * The pairing key, shown the one time the backend hands it out. The key is
 * long and the installer only checks its shape, so a partial paste is the
 * likeliest mistake — copying goes through a button, and the text selects
 * whole on click for when the clipboard API is unavailable (plain-HTTP
 * installs have no `navigator.clipboard`).
 */
export function PairingKeyBox({ pairingKey, expiresAt }: PairingKeyBoxProps) {
  const [copied, setCopied] = useState<'yes' | 'manual' | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const selectKey = () => {
    keyRef.current?.focus();
    keyRef.current?.select();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pairingKey);
      setCopied('yes');
    } catch {
      selectKey();
      setCopied('manual');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          ref={keyRef}
          readOnly
          value={pairingKey}
          onFocus={selectKey}
          aria-label="Clave de emparejamiento"
          data-testid="pairing-key"
          className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 font-mono text-sm text-gray-900 dark:text-gray-100"
        />
        <Button variant={copied === 'yes' ? 'success' : 'primary'} onClick={copy}>
          {copied === 'yes' ? 'Copiada' : 'Copiar'}
        </Button>
      </div>
      {copied === 'manual' && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          El navegador no permitió copiar automáticamente. La clave quedó seleccionada: cópiala con Ctrl+C.
        </p>
      )}
      <p className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
        Esta clave <strong>no se volverá a mostrar</strong>. Cópiala ahora; si la pierdes, emite una nueva desde la página del agente.
        {expiresAt && <> Vence el {formatAgentDate(expiresAt)} y sirve para una sola instalación.</>}
      </p>
    </div>
  );
}
