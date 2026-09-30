'use client';

import React, { useState } from 'react';
import { LINUX_INSTALLER_FILE, WINDOWS_INSTALLER_FILE } from '@/constants/agent.constants';
import { InstallerDownload } from './InstallerDownload';

type Platform = 'windows' | 'linux';

interface AgentInstallStepsProps {
  /** Filled into the Linux command when known; the placeholder otherwise. */
  pairingKey?: string;
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 font-mono text-xs text-gray-800 dark:text-gray-200 wrap-anywhere">
    {children}
  </code>
);

/**
 * How to put the agent on the customer's PC (AGT-067, AGT-068). The installer
 * asks for nothing but the pairing key, so the steps are mostly about picking
 * the right PC — one that stays on and can reach the devices.
 */
export function AgentInstallSteps({ pairingKey }: AgentInstallStepsProps) {
  const [platform, setPlatform] = useState<Platform>('windows');
  const key = pairingKey ?? '<clave>';

  const tab = (value: Platform, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={platform === value}
      onClick={() => setPlatform(value)}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        platform === value
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
      <p>
        Instálalo en un PC de la red del cliente que <strong>permanezca encendido</strong>, que alcance la IP de
        administración de cada equipo y que tenga salida a internet.
      </p>

      <div role="tablist" className="flex gap-1">
        {tab('windows', 'Windows')}
        {tab('linux', 'Linux')}
      </div>

      {platform === 'windows' ? (
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            <InstallerDownload platform="windows" fallbackFileName={WINDOWS_INSTALLER_FILE} /> y cópialo a ese PC.
          </li>
          <li>Ejecútalo como administrador.</li>
          <li>Pega la clave de emparejamiento cuando la pida. Es lo único que pregunta.</li>
          <li>
            Listo: queda como un servicio que arranca con el equipo, aunque nadie inicie sesión, y el PC deja de
            suspenderse mientras esté conectado a la corriente.
          </li>
        </ol>
      ) : (
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            <InstallerDownload platform="linux" fallbackFileName={LINUX_INSTALLER_FILE} /> y cópialo a ese equipo
            (requiere systemd).
          </li>
          <li>
            Descomprímelo y, como root, ejecuta: <Code>sudo ./install.sh {key}</Code>
          </li>
          <li>
            Queda como el servicio <Code>nms-agent</Code>; su registro se ve con <Code>journalctl -u nms-agent</Code>.
          </li>
        </ol>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Si el instalador rechaza la clave, no la reintentes: emite una nueva desde la página del agente. Volver a
        ejecutar el instalador actualiza el agente sin perder el emparejamiento.
      </p>
    </div>
  );
}
