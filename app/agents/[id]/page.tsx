'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { AgentDTO, AgentPairingDTO } from '@/types/agent.types';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/contexts/toast.context';
import { AGENTS_QUERY_KEY, useAgent, useAgents } from '@/hooks/useAgents';
import { useGoBack } from '@/hooks/useGoBack';
import { useInstallation } from '@/hooks/useInstallation';
import {
  PAIRING_UNAVAILABLE_MESSAGE,
  agentCondition,
  formatAgentDate,
  formatAgo,
  formatClockOffset,
} from '@/constants/agent.constants';
import { BackLink, Button, Card, ConfirmModal, ErrorBanner, LoadingSpinner } from '@/components/ui';
import { AgentStatusBadges } from '@/components/agents/AgentStatusBadges';
import { AgentInstallSteps } from '@/components/agents/AgentInstallSteps';
import { PairingKeyModal } from '@/components/agents/PairingKeyModal';
import { AgentDeviceAssignmentCard } from '@/components/agents/AgentDeviceAssignmentCard';
import { AgentDevicesCard } from '@/components/agents/AgentDevicesCard';
import { AgentOutagesCard } from '@/components/agents/AgentOutagesCard';

function Notice({ tone, children }: { tone: 'danger' | 'warning' | 'info'; children: React.ReactNode }) {
  const tones = {
    danger: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300',
    warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300',
    info: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300',
  };
  return <div className={`rounded-lg border p-4 text-sm ${tones[tone]}`}>{children}</div>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

/** What is wrong with the agent right now and what to do about it, most urgent first. */
function AgentNotices({ agent }: { agent: AgentDTO }) {
  const condition = agentCondition(agent);
  return (
    <>
      {condition === 'OFFLINE' && agent.offlineSince && (
        <Notice tone="danger">
          <strong>No reporta desde el {formatAgentDate(agent.offlineSince)}.</strong> Sus dispositivos aparecen como
          «desconocido» hasta que vuelva, no como caídos. Revisa que el PC esté encendido y con internet. Al reconectarse
          envía lo que midió mientras tanto.
        </Notice>
      )}
      {condition === 'KEY_EXPIRED' && (
        <Notice tone="warning">
          La clave de emparejamiento venció sin usarse. Emite una nueva para instalar el agente.
        </Notice>
      )}
      {condition === 'NEVER_CONNECTED' && (
        <Notice tone="info">
          Se emparejó pero aún no se ha conectado. Suele tardar unos segundos después de instalar; si pasan varios
          minutos, revisa que el servicio esté corriendo en el PC.
        </Notice>
      )}
      {agent.status === 'ACTIVE' && agent.clockDriftSince && (
        <Notice tone="warning">
          <strong>El reloj de este PC está desfasado</strong>
          {agent.clockOffsetMs !== null && <> ({formatClockOffset(agent.clockOffsetMs)})</>} desde el{' '}
          {formatAgentDate(agent.clockDriftSince)}. Las mediciones ya se corrigen, pero conviene ajustar la hora del
          equipo (activar la hora automática).
        </Notice>
      )}
      {agent.status === 'REVOKED' && (
        <Notice tone="info">
          Revocado el {formatAgentDate(agent.revokedAt)}. El PC borró su acceso y espera una clave nueva; para volver a
          usarlo, crea otro agente y pega su clave en el instalador.
        </Notice>
      )}
    </>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const goBack = useGoBack('/agents');
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const { showError, showSuccess } = useToast();
  const canManageAgents = permissions.isVendor;
  const { agentPairingAvailable } = useInstallation();
  const canWrite = permissions.canWrite;

  const [pairing, setPairing] = useState<AgentPairingDTO | null>(null);
  const [isRekeying, setIsRekeying] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const { data: agent, isLoading, error, refetch } = useAgent(agentId);
  const { data: allAgents = [] } = useAgents();

  const store = (updated: AgentDTO) => {
    queryClient.setQueryData([...AGENTS_QUERY_KEY, agentId], updated);
    queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY, exact: true });
  };

  const rekey = async () => {
    setIsRekeying(true);
    const result = await apiService.issueAgentPairingKey(agentId);
    setIsRekeying(false);
    if (!result.success || !result.data) {
      showError(result.error || 'Error al emitir la clave');
      refetch();
      return;
    }
    store(result.data.agent);
    setPairing(result.data);
  };

  const revoke = async () => {
    setIsRevoking(true);
    const result = await apiService.revokeAgent(agentId);
    setIsRevoking(false);
    setShowRevoke(false);
    if (!result.success || !result.data) {
      showError(result.error || 'Error al revocar el agente');
      refetch();
      return;
    }
    store(result.data);
    showSuccess(`Agente «${result.data.name}» revocado`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Cargando agente..." />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorBanner message={(error as Error | null)?.message ?? 'El agente ya no existe.'} onRetry={() => refetch()} />
        <Button variant="outline" onClick={() => goBack()}>Volver</Button>
      </div>
    );
  }

  const condition = agentCondition(agent);
  const isPending = agent.status === 'PENDING';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PairingKeyModal pairing={pairing} onClose={() => setPairing(null)} canAssign={canWrite} />
      <ConfirmModal
        isOpen={showRevoke}
        onClose={() => setShowRevoke(false)}
        onConfirm={revoke}
        title="Revocar agente"
        message={`«${agent.name}» dejará de funcionar de inmediato y no se puede deshacer. El PC borrará su acceso, su lista de equipos y las mediciones sin enviar. Sus dispositivos quedarán sin vigilancia hasta que los muevas a otro agente o al servidor.`}
        confirmText="Revocar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isRevoking}
      />

      <div className="mb-6">
        <BackLink onClick={() => goBack()} className="mb-2" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere">{agent.name}</h1>
            <AgentStatusBadges agent={agent} />
          </div>
          {canManageAgents && agent.status !== 'REVOKED' && (
            <div className="flex flex-wrap gap-2">
              {isPending && (
                <Button
                  onClick={rekey}
                  isLoading={isRekeying}
                  disabled={!agentPairingAvailable}
                  title={agentPairingAvailable ? undefined : PAIRING_UNAVAILABLE_MESSAGE}
                >
                  Nueva clave
                </Button>
              )}
              <Button variant="danger" onClick={() => setShowRevoke(true)}>
                Revocar
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <AgentNotices agent={agent} />

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Estado</h2>
          </Card.Header>
          <Card.Body>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isPending ? (
                <Fact label={condition === 'KEY_EXPIRED' ? 'Clave vencida el' : 'La clave vence'}>
                  {formatAgentDate(agent.pairingExpiresAt)}
                </Fact>
              ) : (
                <Fact label="Emparejado">{formatAgentDate(agent.enrolledAt)}</Fact>
              )}
              <Fact label="Último reporte">
                {agent.lastSeenAt ? (
                  <>
                    {formatAgo(agent.lastSeenAt)}{' '}
                    <span className="text-sm text-gray-500 dark:text-gray-400">({formatAgentDate(agent.lastSeenAt)})</span>
                  </>
                ) : (
                  'Nunca'
                )}
              </Fact>
              {/* Both arrive with the first connection; before it they are only noise. */}
              {agent.agentVersion && <Fact label="Versión">{agent.agentVersion}</Fact>}
              {agent.clockOffsetMs !== null && (
                <Fact label="Reloj del PC">
                  {Math.abs(agent.clockOffsetMs) < 1000 ? 'En hora' : formatClockOffset(agent.clockOffsetMs)}
                </Fact>
              )}
              <Fact label="Dispositivos">{agent.deviceCount}</Fact>
              <Fact label="Creado">{formatAgentDate(agent.createdAt)}</Fact>
              {agent.revokedAt && <Fact label="Revocado">{formatAgentDate(agent.revokedAt)}</Fact>}
            </dl>
          </Card.Body>
        </Card>

        {isPending && (
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Instalación</h2>
            </Card.Header>
            <Card.Body>
              <AgentInstallSteps />
              {canManageAgents && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  La clave solo se muestra al emitirla. Si no la tienes a mano, usa «Nueva clave»: la anterior deja de
                  servir.
                </p>
              )}
            </Card.Body>
          </Card>
        )}

        <AgentDevicesCard agent={agent} />

        {canWrite && <AgentDeviceAssignmentCard agent={agent} allAgents={allAgents} />}

        {agent.status !== 'PENDING' && <AgentOutagesCard agent={agent} />}
      </div>
    </div>
  );
}
