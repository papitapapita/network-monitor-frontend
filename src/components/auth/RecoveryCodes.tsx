'use client';

import React, { useState } from 'react';
import { Button, Checkbox } from '@/components/ui';

/**
 * The recovery codes, shown once at the end of setup. The session is held back
 * until the person says they saved them: once in, the codes are gone for good,
 * and they are the only way back in without the phone.
 */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigos-de-recuperacion.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Si pierdes el teléfono, cada uno de estos códigos te deja entrar una vez. Guárdalos en un lugar seguro:
        no se volverán a mostrar.
      </p>

      <ul
        aria-label="Códigos de recuperación"
        className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 font-mono text-sm text-gray-900 dark:text-gray-100"
      >
        {codes.map((code) => (
          <li key={code} className="text-center">{code}</li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy} className="flex-1">
          {copied ? 'Copiados' : 'Copiar'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download} className="flex-1">
          Descargar
        </Button>
      </div>

      <Checkbox
        id="recovery-codes-saved"
        label="Guardé estos códigos"
        checked={saved}
        onChange={(e) => setSaved(e.target.checked)}
      />

      <Button type="button" fullWidth disabled={!saved} onClick={onDone}>
        Continuar
      </Button>
    </div>
  );
}
