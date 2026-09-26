'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CollectionAccountDTO } from '@/types/collection-account.types';
import {
  COLLECTION_ACCOUNT_STATUS_LABELS,
  COLLECTION_ACCOUNT_STATUS_VARIANTS,
  canPayCollectionAccount,
  canCancelCollectionAccount,
  collectionAccountLabel,
} from '@/constants/collection-account.constants';
import { formatCurrency } from '@/constants/quotation.constants';
import { Card, Button, LoadingSpinner, Badge, Table, BackLink, SectionTitle } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/toast.context';
import { useGoBack } from '@/hooks/useGoBack';

type PendingAction = 'pay' | 'cancel' | null;

const ACTION_COPY: Record<Exclude<PendingAction, null>, { title: string; message: string; confirm: string; variant: 'danger' | 'primary' }> = {
  pay: { title: 'Marcar como pagada', message: '¿Confirmas que esta cuenta de cobro fue pagada? La acción no se puede deshacer.', confirm: 'Marcar Pagada', variant: 'primary' },
  cancel: { title: 'Anular cuenta de cobro', message: '¿Anular esta cuenta de cobro? No se puede deshacer; para corregirla, emite una nueva.', confirm: 'Anular', variant: 'danger' },
};

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es') : '—');

export default function CollectionAccountDetailPage() {
  const router = useRouter();
  const goBack = useGoBack('/collection-accounts');
  const queryClient = useQueryClient();
  const { id: accountId } = useParams() as { id: string };
  const { showError } = useToast();

  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isActing, setIsActing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const queryKey = ['collectionAccount', accountId];
  const { data: account, isLoading, error: loadError, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<CollectionAccountDTO> => {
      const r = await apiService.getCollectionAccount(accountId);
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar la cuenta de cobro');
      return r.data;
    },
  });

  const runAction = async () => {
    if (!pendingAction) return;
    setIsActing(true);
    setActionError(null);
    const r = pendingAction === 'pay'
      ? await apiService.payCollectionAccount(accountId)
      : await apiService.cancelCollectionAccount(accountId);
    setIsActing(false);
    setPendingAction(null);
    if (r.success && r.data) {
      queryClient.setQueryData(queryKey, r.data);
      queryClient.invalidateQueries({ queryKey: ['collectionAccounts'] });
    } else {
      const message = r.error || 'No se pudo actualizar la cuenta de cobro';
      setActionError(message);
      showError(message);
    }
  };

  const handleDownloadPdf = async () => {
    if (!account) return;
    setIsDownloading(true);
    setActionError(null);
    const r = await apiService.downloadCollectionAccountPdf(accountId);
    setIsDownloading(false);
    if (r.success && r.data) {
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cuenta-de-cobro-${account.number ?? account.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const message = r.error || 'No se pudo descargar el PDF';
      setActionError(message);
      showError(message);
    }
  };

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" message="Cargando cuenta de cobro..." /></div>;
  if (loadError && !account) return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{(loadError as Error).message}</p>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" onClick={() => goBack()}>Volver</Button>
          <Button onClick={() => refetch()}>Reintentar</Button>
        </div>
      </div>
    </div>
  );
  if (!account) return null;

  const copy = pendingAction ? ACTION_COPY[pendingAction] : null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {copy && (
        <ConfirmModal
          isOpen={!!pendingAction}
          onClose={() => setPendingAction(null)}
          onConfirm={runAction}
          title={copy.title}
          message={copy.message}
          confirmText={copy.confirm}
          cancelText="Volver"
          variant={copy.variant}
          isLoading={isActing}
        />
      )}

      <div className="mb-2">
        <BackLink onClick={() => goBack()} />
      </div>
      <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-col sm:justify-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere">
              Cuenta de Cobro {collectionAccountLabel(account)}
            </h1>
            <Badge variant={COLLECTION_ACCOUNT_STATUS_VARIANTS[account.status]}>
              {COLLECTION_ACCOUNT_STATUS_LABELS[account.status]}
            </Badge>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5 wrap-anywhere">
            {account.customerName}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} isLoading={isDownloading}>Descargar PDF</Button>
          {canPayCollectionAccount(account.status) && (
            <Button size="sm" onClick={() => setPendingAction('pay')}>Marcar Pagada</Button>
          )}
          {canCancelCollectionAccount(account.status) && (
            <Button size="sm" variant="danger" onClick={() => setPendingAction('cancel')}>Anular</Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{actionError}</p>
        </div>
      )}

      <Card>
        <Card.Header>
          <SectionTitle info="Una cuenta de cobro no se edita: para corregirla, anúlala y emite una nueva. Nunca vence ni afecta el servicio de internet del cliente.">
            Detalles
          </SectionTitle>
        </Card.Header>
        <Card.Body>
          <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Cliente', value: account.customerName },
              { label: 'Cédula / NIT', value: account.customerDocument ?? '—' },
              { label: 'Teléfono', value: account.customerPhone ?? '—' },
              { label: 'Email', value: account.customerEmail ?? '—' },
              { label: 'Dirección', value: account.customerAddress ?? '—' },
              { label: 'Total', value: formatCurrency(account.total) },
              { label: 'Emisión', value: formatDate(account.issueDate) },
              { label: 'Fecha límite de pago', value: formatDate(account.dueDate) },
              ...(account.status === 'PAID' ? [{ label: 'Pagada', value: formatDate(account.paidAt) }] : []),
              ...(account.status === 'CANCELLED' ? [{ label: 'Anulada', value: formatDate(account.cancelledAt) }] : []),
              { label: 'Observaciones', value: account.notes ?? '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                <dd className="mt-1 text-gray-900 dark:text-gray-100">{value}</dd>
              </div>
            ))}
          </dl>
        </Card.Body>
      </Card>

      {account.customerId && (
        <Card>
          <Card.Header className="border-b-0 pb-0 mb-0">
            <div className="flex justify-between items-center">
              <SectionTitle info="Los datos mostrados arriba son una copia tomada al emitir la cuenta de cobro: no se actualizan si el registro del cliente cambia después.">
                Cliente Vinculado
              </SectionTitle>
              <Button size="sm" variant="outline" onClick={() => router.push(`/customers/${account.customerId}`)}>Ver Cliente</Button>
            </div>
          </Card.Header>
        </Card>
      )}

      <Card>
        <Card.Header>
          <SectionTitle>
            Conceptos
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              ({account.lineItems.length})
            </span>
          </SectionTitle>
        </Card.Header>
        <Card.Body>
          <Table>
            <Table.Header>
              <Table.Head>Descripción</Table.Head>
              <Table.Head>Cantidad</Table.Head>
              <Table.Head>Valor Unitario</Table.Head>
              <Table.Head>Total</Table.Head>
            </Table.Header>
            <Table.Body>
              {account.lineItems.map((li, i) => (
                <Table.Row key={i}>
                  <Table.Cell>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{li.description}</span>
                  </Table.Cell>
                  <Table.Cell>{li.quantity}</Table.Cell>
                  <Table.Cell>{formatCurrency(li.unitPrice)}</Table.Cell>
                  <Table.Cell>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(li.lineTotal)}</span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          <div className="flex justify-end border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(account.total)}</div>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
