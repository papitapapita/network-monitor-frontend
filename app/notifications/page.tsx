'use client';

import React, { Suspense, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useUrlState } from '@/hooks/useUrlState';
import { useInbox, inboxListKey } from '@/contexts/inbox.context';
import { useToast } from '@/contexts/toast.context';
import { INBOX_RETENTION_DAYS } from '@/constants/inbox.constants';
import { InboxItem } from '@/components/inbox/InboxItem';
import { Button, Card, ErrorBanner, LoadingSpinner, PageHeader, Pagination } from '@/components/ui';

const LIMIT = 20;

type Filter = 'all' | 'unread';
const FILTER_LABELS: Record<Filter, string> = { all: 'Todas', unread: 'No leídas' };

function NotificationsPageContent() {
  const url = useUrlState();
  const filter: Filter = url.get('filter') === 'unread' ? 'unread' : 'all';
  const page = url.getNumber('page', 1);
  const { unread, markAllRead } = useInbox();
  const { showError } = useToast();
  const [marking, setMarking] = useState(false);

  const params = { unread: filter === 'unread', limit: LIMIT, offset: (page - 1) * LIMIT };
  const list = useQuery({
    queryKey: inboxListKey(params),
    queryFn: async () => {
      const result = await apiService.getInbox(params);
      if (!result.success || !result.data) throw new Error(result.error || 'No se pudieron cargar las notificaciones');
      return result.data;
    },
    placeholderData: keepPreviousData,
  });

  const handleMarkAll = async () => {
    setMarking(true);
    if (!(await markAllRead())) showError('No se pudieron marcar las notificaciones como leídas');
    setMarking(false);
  };

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <PageHeader
        title="Notificaciones"
        subtitle={unread ? `${unread} sin leer` : undefined}
        info={`Todo lo que la instalación avisa a su equipo: caídas y recuperaciones, alertas inalámbricas, agentes, respaldos y avisos de seguridad. Llegan aquí aunque Telegram o el teléfono estén silenciados, y se borran a los ${INBOX_RETENTION_DAYS} días.`}
        onRefresh={() => list.refetch()}
        isRefreshing={list.isFetching}
        actions={
          (unread ?? 0) > 0 && (
            <Button variant="outline" onClick={handleMarkAll} isLoading={marking}>
              Marcar todas como leídas
            </Button>
          )
        }
      />

      <nav className="flex gap-6 mb-4 border-b border-gray-200 dark:border-gray-700">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => url.set({ filter: f === 'all' ? null : f, page: null })}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              filter === f
                ? 'border-brand-600 dark:border-brand-400 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </nav>

      {list.isError && <ErrorBanner message={list.error.message} />}

      <Card>
        {list.isPending ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : !list.data || list.data.notifications.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            {filter === 'unread' ? 'No tienes notificaciones sin leer.' : 'No tienes notificaciones.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {list.data.notifications.map((n) => (
              <InboxItem key={n.id} notification={n} />
            ))}
          </ul>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => url.set({ page: p === 1 ? null : p })}
            totalItems={total}
            itemsPerPage={LIMIT}
          />
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <NotificationsPageContent />
    </Suspense>
  );
}
