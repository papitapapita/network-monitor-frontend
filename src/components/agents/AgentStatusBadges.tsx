'use client';

import React from 'react';
import { Badge } from '@/components/ui';
import { AgentDTO } from '@/types/agent.types';
import {
  AGENT_CONDITION_LABELS,
  AGENT_CONDITION_VARIANTS,
  agentCondition,
} from '@/constants/agent.constants';

/**
 * The condition badge, plus the clock-drift one beside it — drift is a
 * separate fact (an online agent can have it) and the fix is on the PC.
 */
export function AgentStatusBadges({ agent }: { agent: AgentDTO }) {
  const condition = agentCondition(agent);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant={AGENT_CONDITION_VARIANTS[condition]}>{AGENT_CONDITION_LABELS[condition]}</Badge>
      {agent.clockDriftSince && agent.status === 'ACTIVE' && <Badge variant="warning">Reloj desfasado</Badge>}
    </span>
  );
}
