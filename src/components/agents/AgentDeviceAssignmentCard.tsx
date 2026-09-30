'use client';

import React, { useMemo, useState } from 'react';
import { AgentDTO } from '@/types/agent.types';
import { AGENT_STATUS_LABELS, SERVER_POLLER_LABEL } from '@/constants/agent.constants';
import { Button, Card, ConfirmModal, Select } from '@/components/ui';
import { AssignmentOutcomeNotice } from './AssignmentOutcomeNotice';
import { AssignmentOutcome, useAgentAssignment } from './useAgentAssignment';

/** The Select needs a string for "the server"; the API wants `null`. */
const SERVER = '__server__';
const toApi = (value: string): string | null => (value === SERVER ? null : value);

interface AgentDeviceAssignmentCardProps {
  agent: AgentDTO;
  allAgents: AgentDTO[];
}

type PendingMove = { direction: 'in' | 'out'; other: string };

/**
 * Bulk moves by source, the three the backend names as typical: the first
 * agent takes over from the server, a replacement PC takes over from the old
 * agent, and a misbehaving agent hands everything back to the server. Moving
 * single devices belongs on the device itself.
 */
export function AgentDeviceAssignmentCard({ agent, allAgents }: AgentDeviceAssignmentCardProps) {
  const { run, isRunning } = useAgentAssignment();
  const others = useMemo(() => allAgents.filter((a) => a.id !== agent.id), [allAgents, agent.id]);
  const isRevoked = agent.status === 'REVOKED';
  const isPending = agent.status === 'PENDING';

  // A revoked agent's devices are polled by nobody, so it is the likeliest
  // source to pull from — revoked agents stay in the "from" list for that.
  const sourceOptions = [
    { value: SERVER, label: SERVER_POLLER_LABEL },
    ...others.map((a) => ({
      value: a.id,
      label: a.status === 'ACTIVE' ? a.name : `${a.name} (${AGENT_STATUS_LABELS[a.status].toLowerCase()})`,
    })),
  ];
  const targetOptions = [
    { value: SERVER, label: SERVER_POLLER_LABEL },
    ...others
      .filter((a) => a.status !== 'REVOKED')
      .map((a) => ({ value: a.id, label: a.status === 'ACTIVE' ? a.name : `${a.name} (pendiente)` })),
  ];

  const [source, setSource] = useState(SERVER);
  const [target, setTarget] = useState(SERVER);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [outcome, setOutcome] = useState<AssignmentOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (value: string) =>
    value === SERVER ? 'el servidor' : `«${allAgents.find((a) => a.id === value)?.name ?? value}»`;

  const confirmMessage = pending
    ? pending.direction === 'in'
      ? `Todos los dispositivos que hoy sondea ${nameOf(pending.other)} pasarán a este agente, «${agent.name}». Asegúrate de que este PC alcance sus direcciones IP.`
      : `Todos los dispositivos de «${agent.name}» pasarán a ${nameOf(pending.other)}.${
          pending.other === SERVER ? ' El servidor solo los alcanza si sus IP son accesibles desde internet.' : ''
        }`
    : '';

  const execute = async () => {
    if (!pending) return;
    setError(null);
    setOutcome(null);
    const result =
      pending.direction === 'in'
        ? await run({ agentId: agent.id, fromAgentId: toApi(pending.other) })
        : await run({ agentId: toApi(pending.other), fromAgentId: agent.id });
    setPending(null);
    if ('error' in result) setError(result.error);
    else setOutcome(result.outcome);
  };

  return (
    <Card>
      <Card.Header>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mover dispositivos</h2>
      </Card.Header>
      <Card.Body>
        <ConfirmModal
          isOpen={!!pending}
          onClose={() => setPending(null)}
          onConfirm={execute}
          title="Mover dispositivos"
          message={confirmMessage}
          confirmText="Mover"
          cancelText="Cancelar"
          isLoading={isRunning}
        />

        <div className="space-y-6">
          {isPending && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Instala y empareja el agente antes de traerle dispositivos: hasta entonces no sondea nada y quedarían sin
              vigilancia.
            </p>
          )}
          {!isRevoked && !isPending && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pasa a este agente todos los dispositivos que hoy sondea otro.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Select
                  label="Traer desde"
                  options={sourceOptions}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="sm:w-72"
                />
                <Button variant="outline" onClick={() => setPending({ direction: 'in', other: source })} disabled={isRunning}>
                  Traer a este agente
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isRevoked
                ? 'Un agente revocado ya no sondea nada: sus dispositivos quedan sin vigilancia hasta que los muevas.'
                : isPending
                  ? 'Si ya tiene dispositivos (los nuevos van al único agente que exista), puedes devolverlos mientras tanto.'
                  : 'Entrega todos los dispositivos de este agente a otro, por ejemplo al reemplazar el PC.'}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Select
                label="Enviar a"
                options={targetOptions}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="sm:w-72"
              />
              <Button variant="outline" onClick={() => setPending({ direction: 'out', other: target })} disabled={isRunning}>
                Enviar sus dispositivos
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          {outcome && <AssignmentOutcomeNotice outcome={outcome} />}
        </div>
      </Card.Body>
    </Card>
  );
}
