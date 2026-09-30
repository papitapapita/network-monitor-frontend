'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { AgentAssignmentDTO } from '@/types/agent.types';
import { AGENTS_QUERY_KEY } from '@/hooks/useAgents';

export interface AssignmentOutcome {
  assigned: number;
  /** With the device's name when it could still be read — ids alone mean nothing to an operator. */
  failed: { id: string; name: string | null; error: string }[];
}

/**
 * Runs one `POST /api/devices/agent-assignment`. The backend moves each device
 * on its own and lists the ones it refused, so a success can still carry
 * failures that the caller has to show.
 */
export function useAgentAssignment() {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(
    async (dto: AgentAssignmentDTO): Promise<{ outcome: AssignmentOutcome } | { error: string }> => {
      setIsRunning(true);
      try {
        const result = await apiService.assignDevicesToAgent(dto);
        if (!result.success || !result.data) {
          return { error: result.error || 'Error al mover los dispositivos' };
        }
        const failed = await Promise.all(
          result.data.failed.map(async (f) => {
            const device = await apiService.getDevice(f.id);
            return { ...f, name: device.success && device.data ? device.data.name : null };
          })
        );
        // Every device page reads `agentId`, and the device list's connectivity
        // depends on whether its agent is reporting.
        queryClient.invalidateQueries({ queryKey: ['devices'] });
        queryClient.invalidateQueries({ queryKey: ['devicesCatalog'] });
        // Each agent's deviceCount moved with them.
        queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
        return { outcome: { assigned: result.data.assigned.length, failed } };
      } finally {
        setIsRunning(false);
      }
    },
    [queryClient]
  );

  return { run, isRunning };
}

export const deviceCount = (n: number) => `${n} ${n === 1 ? 'dispositivo' : 'dispositivos'}`;
