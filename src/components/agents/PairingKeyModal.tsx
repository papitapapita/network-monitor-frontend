'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { AgentPairingDTO } from '@/types/agent.types';
import { AGENTS_QUERY_KEY } from '@/hooks/useAgents';
import { Button, Modal } from '@/components/ui';
import { PairingKeyBox } from './PairingKeyBox';
import { AgentInstallSteps } from './AgentInstallSteps';
import { AssignmentOutcomeNotice } from './AssignmentOutcomeNotice';
import { AssignmentOutcome, useAgentAssignment } from './useAgentAssignment';

/** Fast enough that "Conectado" appears while the installer's window is still open. */
const PAIRING_POLL_MS = 3_000;

interface PairingKeyModalProps {
  pairing: AgentPairingDTO | null;
  onClose: () => void;
  /** Moving devices is ADMIN/OPERATOR work; a key is only ever issued to an ADMIN, but say it anyway. */
  canAssign: boolean;
}

/**
 * The one screen where the pairing key exists. It stays open while the key is
 * pasted into the installer and watches the agent until it pairs, then offers
 * the step that is easy to forget: an agent polls nothing until devices are
 * placed behind it, and every device registered so far is polled by the server.
 */
export function PairingKeyModal({ pairing, onClose, canAssign }: PairingKeyModalProps) {
  const queryClient = useQueryClient();
  const { run, isRunning } = useAgentAssignment();
  const [outcome, setOutcome] = useState<AssignmentOutcome | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const agentId = pairing?.agent.id;
  const { data: live } = useQuery({
    queryKey: [...AGENTS_QUERY_KEY, agentId],
    queryFn: async () => {
      const r = await apiService.getAgent(agentId!);
      if (!r.success || !r.data) throw new Error(r.error);
      return r.data;
    },
    enabled: !!agentId,
    initialData: pairing?.agent,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? PAIRING_POLL_MS : false),
  });

  const agent = live ?? pairing?.agent;
  const paired = agent?.status === 'ACTIVE';

  const close = () => {
    queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    setOutcome(null);
    setMoveError(null);
    onClose();
  };

  const moveServerDevices = async () => {
    if (!agent) return;
    setMoveError(null);
    const result = await run({ agentId: agent.id, fromAgentId: null });
    if ('error' in result) setMoveError(result.error);
    else setOutcome(result.outcome);
  };

  if (!pairing || !agent) return null;

  return (
    <Modal isOpen onClose={close} title={`Instalar «${agent.name}»`} size="lg">
      <div className="space-y-5">
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">1. Copia la clave de emparejamiento</h4>
          <PairingKeyBox pairingKey={pairing.pairingKey} expiresAt={pairing.agent.pairingExpiresAt} />
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">2. Instala el agente</h4>
          <AgentInstallSteps pairingKey={pairing.pairingKey} />
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">3. Espera la conexión</h4>
          {paired ? (
            <div className="space-y-3 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-300" data-testid="agent-paired">
                Agente emparejado. Ya puede sondear dispositivos.
              </p>
              {canAssign && !outcome && (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Por ahora no tiene dispositivos: los que ya estaban registrados los sigue sondeando el servidor. Si
                    este agente vigila esa misma red, pásalos a él.
                  </p>
                  <Button onClick={moveServerDevices} isLoading={isRunning}>
                    Mover a este agente los dispositivos del servidor
                  </Button>
                </>
              )}
              {moveError && <p className="text-sm text-red-700 dark:text-red-400">{moveError}</p>}
              {outcome && <AssignmentOutcomeNotice outcome={outcome} />}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden />
              Esperando a que el instalador use la clave… Puedes cerrar esta ventana; el agente se emparejará igual.
            </p>
          )}
        </section>
      </div>

      <Modal.Footer>
        <Button variant={paired ? 'primary' : 'outline'} onClick={close}>
          {paired ? 'Listo' : 'Cerrar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
