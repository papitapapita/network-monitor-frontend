'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { AgentPairingDTO } from '@/types/agent.types';
import { AGENTS_QUERY_KEY } from '@/hooks/useAgents';
import { AGENT_NAME_MAX_LENGTH } from '@/constants/agent.constants';
import { Button, Input, Modal } from '@/components/ui';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Hands the one-time pairing key on to whoever shows it. */
  onCreated: (pairing: AgentPairingDTO) => void;
}

export function CreateAgentModal({ isOpen, onClose, onCreated }: CreateAgentModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const close = () => {
    setName('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('El nombre es requerido');
      return;
    }
    if (trimmed.length > AGENT_NAME_MAX_LENGTH) {
      setError(`El nombre no puede superar los ${AGENT_NAME_MAX_LENGTH} caracteres`);
      return;
    }
    setIsSaving(true);
    const result = await apiService.createAgent({ name: trimmed });
    setIsSaving(false);
    if (!result.success || !result.data) {
      setError(result.error || 'Error al crear el agente');
      return;
    }
    queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    setName('');
    setError(null);
    onCreated(result.data);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Nuevo agente"
      onSubmit={submit}
      info="Se genera una clave de emparejamiento de un solo uso, válida por 24 horas. El instalador del agente solo pide esa clave."
    >
      <div className="space-y-4">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          error={error ?? undefined}
          maxLength={AGENT_NAME_MAX_LENGTH}
          placeholder="Ej: Oficina principal"
          autoFocus
          fullWidth
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Usa un nombre que identifique el sitio o el PC donde se instalará; no se puede reutilizar después de
          revocarlo.
        </p>
      </div>
      <Modal.Footer>
        <Button variant="outline" onClick={close} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={submit} isLoading={isSaving}>
          Crear y obtener clave
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
