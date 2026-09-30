'use client';

import React from 'react';
import { Select } from '@/components/ui';
import { AgentDTO } from '@/types/agent.types';
import { AGENT_STATUS_LABELS, SERVER_POLLER_LABEL } from '@/constants/agent.constants';

/** The Select's value for "polled by the server" — the API's `null`. */
export const SERVER_AGENT_VALUE = '__server__';

export const agentPickerValue = (agentId: string | null): string => agentId ?? SERVER_AGENT_VALUE;
export const agentIdFromPicker = (value: string): string | null =>
  value === SERVER_AGENT_VALUE ? null : value;

interface AgentPickerProps {
  agents: AgentDTO[];
  /** '' while nothing is chosen, SERVER_AGENT_VALUE or an agent id otherwise. */
  value: string;
  onChange: (value: string) => void;
  /** The device's agent as saved. Kept in the list even once revoked, so the field can still show it. */
  currentAgentId?: string | null;
  error?: string;
  required?: boolean;
}

/**
 * Which agent reaches the device. Revoked agents cannot take devices
 * (DEV-165), so they are offered only when the device is already behind one —
 * re-sending it is allowed, choosing it fresh is not. A pending agent is
 * offered: loading a site's devices before its installer runs is intended.
 */
export function AgentPicker({ agents, value, onChange, currentAgentId, error, required }: AgentPickerProps) {
  const options = [
    { value: SERVER_AGENT_VALUE, label: SERVER_POLLER_LABEL },
    ...agents
      .filter((a) => a.status !== 'REVOKED' || a.id === currentAgentId)
      .map((a) => ({
        value: a.id,
        label: a.status === 'ACTIVE' ? a.name : `${a.name} (${AGENT_STATUS_LABELS[a.status].toLowerCase()})`,
      })),
  ];

  return (
    <Select
      label="Sondeado por"
      info="El agente instalado en la red donde está este equipo, o el servidor si el servidor lo alcanza directamente. Un agente pendiente no sondea nada hasta que se instale."
      options={options}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Elige un agente..."
      error={error}
      required={required}
      fullWidth
    />
  );
}
