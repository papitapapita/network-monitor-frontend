'use client';

import React, { useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { AgentDTO, AgentPairingDTO } from '@/types/agent.types';
import { useAgents } from '@/hooks/useAgents';
import { useAuth } from '@/contexts/auth.context';
import { useUrlTableSort, useUrlState } from '@/hooks/useUrlState';
import { agentCondition, formatAgentDate, formatAgo } from '@/constants/agent.constants';
import {
  DataTable,
  ErrorBanner,
  IconButton,
  LoadingSpinner,
  PageHeader,
  PlusIcon,
  sortRows,
} from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';
import { AgentStatusBadges } from '@/components/agents/AgentStatusBadges';
import { CreateAgentModal } from '@/components/agents/CreateAgentModal';
import { PairingKeyModal } from '@/components/agents/PairingKeyModal';

/** Needs attention first: offline, then expired keys, then the rest; revoked last. */
const CONDITION_ORDER = ['OFFLINE', 'KEY_EXPIRED', 'NEVER_CONNECTED', 'PENDING', 'ONLINE', 'REVOKED'];

const muted = <span className="italic text-gray-400 dark:text-gray-600">—</span>;

const COLUMNS: DataTableColumn<AgentDTO>[] = [
  {
    key: 'name',
    header: 'Nombre',
    sortValue: (a) => a.name,
    cellClassName: 'max-w-xs',
    cell: (a) => <span className="font-medium text-gray-900 dark:text-gray-100 wrap-anywhere">{a.name}</span>,
  },
  {
    key: 'status',
    header: 'Estado',
    sortValue: (a) => CONDITION_ORDER.indexOf(agentCondition(a)),
    cell: (a) => <AgentStatusBadges agent={a} />,
  },
  {
    key: 'lastSeenAt',
    header: 'Último reporte',
    sortValue: (a) => a.lastSeenAt,
    cell: (a) =>
      a.lastSeenAt ? (
        <span title={formatAgentDate(a.lastSeenAt)} className="text-sm text-gray-700 dark:text-gray-300">
          {formatAgo(a.lastSeenAt)}
        </span>
      ) : (
        muted
      ),
  },
  {
    key: 'agentVersion',
    header: 'Versión',
    className: 'hidden md:table-cell',
    sortValue: (a) => a.agentVersion,
    cell: (a) =>
      a.agentVersion ? <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{a.agentVersion}</span> : muted,
  },
  {
    key: 'createdAt',
    header: 'Creado',
    className: 'hidden lg:table-cell',
    sortValue: (a) => a.createdAt,
    cell: (a) => <span className="text-sm text-gray-600 dark:text-gray-400">{formatAgentDate(a.createdAt)}</span>,
  },
];

function AgentsPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const canWrite = isAdmin || user?.role === 'OPERATOR';

  const { get, set } = useUrlState();
  const sort = useUrlTableSort({ get, set });

  const [showCreate, setShowCreate] = useState(false);
  const [pairing, setPairing] = useState<AgentPairingDTO | null>(null);

  const { data: agents = [], isLoading, isFetching, error, refetch, dataUpdatedAt } = useAgents();

  // The backend lists oldest first; with no sort picked, what needs a hand leads.
  const rows = useMemo(
    () => sortRows(agents, COLUMNS, sort.field ?? 'status', sort.field ? sort.direction : 'asc'),
    [agents, sort.field, sort.direction]
  );

  const offline = agents.filter((a) => agentCondition(a) === 'OFFLINE').length;
  const live = agents.filter((a) => a.status !== 'REVOKED').length;
  const subtitle =
    agents.length === 0
      ? 'Programas instalados en la red de cada cliente que la vigilan desde adentro'
      : `${live} ${live === 1 ? 'agente' : 'agentes'} en servicio${offline > 0 ? ` · ${offline} sin conexión` : ''}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <CreateAgentModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(p) => {
          setShowCreate(false);
          setPairing(p);
        }}
      />
      <PairingKeyModal pairing={pairing} onClose={() => setPairing(null)} canAssign={canWrite} />

      <PageHeader
        title="Agentes"
        subtitle={subtitle}
        info="Un agente es un programa que se instala en un PC de la red del cliente y sondea sus equipos desde allí. Los dispositivos que no estén detrás de un agente los sondea el servidor."
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          isAdmin && (
            <IconButton
              icon={<PlusIcon />}
              label="Nuevo agente"
              variant="primary"
              size="md"
              onClick={() => setShowCreate(true)}
            />
          )
        }
      />

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowId={(a) => a.id}
        getRowLabel={(a) => a.name}
        onRowClick={(a) => router.push(`/agents/${a.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando agentes..."
        emptyMessage={
          isAdmin
            ? 'Sin agentes. Crea uno para vigilar la red de un cliente desde adentro.'
            : 'Sin agentes. Un administrador puede crearlos.'
        }
        sort={sort}
      />
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <AgentsPageContent />
    </Suspense>
  );
}
