'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { BillDTO } from '@/types/bill.types';
import { CustomerDTO } from '@/types/customer.types';
import {
  BILL_STATUS_LABELS,
  BILL_STATUS_VARIANTS,
  formatPeriod,
  formatCurrency,
  canPay,
  canCancel,
  canMarkOverdue,
} from '@/constants/bill.constants';
import { Card, Button, LoadingSpinner, Badge, Table } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';

type PendingAction = 'pay' | 'overdue' | 'cancel' | null;

const ACTION_COPY: Record<Exclude<PendingAction, null>, { title: string; message: string; confirm: string; variant: 'danger' | 'primary' }> = {
  pay: { title: 'Marcar como pagada', message: '¿Confirmas que esta factura fue pagada? La acción no se puede deshacer.', confirm: 'Marcar Pagada', variant: 'primary' },
  overdue: { title: 'Marcar como vencida', message: '¿Marcar esta factura como vencida?', confirm: 'Marcar Vencida', variant: 'danger' },
  cancel: { title: 'Cancelar factura', message: '¿Cancelar esta factura? Quedará anulada y el periodo podrá volver a facturarse.', confirm: 'Cancelar Factura', variant: 'danger' },
};

export default function BillDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id: billId } = useParams() as { id: string };

  const [bill, setBill] = useState<BillDTO | null>(null);
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isActing, setIsActing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchBill = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const r = await apiService.getBill(billId);
    if (r.success && r.data) {
      setBill(r.data);
      const c = await apiService.getCustomer(r.data.customerId);
      if (c.success && c.data) setCustomer(c.data);
    } else {
      setLoadError(r.error || 'Error al cargar la factura');
    }
    setIsLoading(false);
  }, [billId]);

  useEffect(() => { fetchBill(); }, [fetchBill]);

  const runAction = async () => {
    if (!pendingAction) return;
    setIsActing(true);
    setActionError(null);
    const call =
      pendingAction === 'pay' ? apiService.payBill(billId)
      : pendingAction === 'overdue' ? apiService.markBillOverdue(billId)
      : apiService.cancelBill(billId);
    const r = await call;
    setIsActing(false);
    setPendingAction(null);
    if (r.success && r.data) {
      setBill(r.data);
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    } else {
      setActionError(r.error || 'No se pudo actualizar la factura');
    }
  };

  const handleDownloadPdf = async () => {
    if (!bill) return;
    setIsDownloading(true);
    setActionError(null);
    const r = await apiService.downloadBillPdf(billId);
    setIsDownloading(false);
    if (r.success && r.data) {
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${bill.period}-${bill.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      setActionError(r.error || 'No se pudo descargar el PDF');
    }
  };

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" message="Cargando factura..." /></div>;
  if (loadError && !bill) return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{loadError}</p>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" onClick={() => router.back()}>Volver</Button>
          <Button onClick={fetchBill}>Reintentar</Button>
        </div>
      </div>
    </div>
  );
  if (!bill) return null;

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

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>← Atrás</Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatPeriod(bill.period)}</h1>
              <Badge variant={BILL_STATUS_VARIANTS[bill.status]}>{BILL_STATUS_LABELS[bill.status]}</Badge>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
              {customer ? customer.fullName : bill.customerId}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} isLoading={isDownloading}>Descargar PDF</Button>
          {canPay(bill.status) && <Button size="sm" onClick={() => setPendingAction('pay')}>Marcar Pagada</Button>}
          {canMarkOverdue(bill.status, bill.dueDate) && (
            <Button size="sm" variant="outline" onClick={() => setPendingAction('overdue')}>Marcar Vencida</Button>
          )}
          {canCancel(bill.status) && <Button size="sm" variant="danger" onClick={() => setPendingAction('cancel')}>Cancelar</Button>}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{actionError}</p>
        </div>
      )}

      {/* Bill summary */}
      <Card>
        <Card.Header><h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalles de la Factura</h2></Card.Header>
        <Card.Body>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Periodo', value: formatPeriod(bill.period) },
              { label: 'Estado', value: BILL_STATUS_LABELS[bill.status] },
              { label: 'Total', value: formatCurrency(bill.total) },
              { label: 'Emisión', value: new Date(bill.issueDate).toLocaleDateString('es') },
              { label: 'Vencimiento', value: new Date(bill.dueDate).toLocaleDateString('es') },
              { label: 'Pagada', value: bill.paidAt ? new Date(bill.paidAt).toLocaleDateString('es') : '—' },
              { label: 'ID', value: bill.id, mono: true, small: true },
            ].map(({ label, value, mono, small }) => (
              <div key={label}>
                <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                <dd className={`mt-1 text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : ''} ${small ? 'text-xs break-all' : ''}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </Card.Body>
      </Card>

      {/* Customer */}
      {customer && (
        <Card>
          <Card.Header>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cliente</h2>
              <Button size="sm" variant="outline" onClick={() => router.push(`/customers/${customer.id}`)}>Ver Cliente</Button>
            </div>
          </Card.Header>
          <Card.Body>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Nombre', value: customer.fullName },
                { label: 'Teléfono', value: customer.phone, mono: true },
                { label: 'Email', value: customer.email ?? '—' },
                { label: 'Cédula', value: customer.cedula ?? '—', mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label}>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                  <dd className={`mt-1 text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : ''}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </Card.Body>
        </Card>
      )}

      {/* Line items */}
      <Card>
        <Card.Header>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Conceptos
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({bill.lineItems.length})</span>
          </h2>
        </Card.Header>
        <Card.Body>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Los precios quedaron fijados al generar la factura; cambios posteriores en los planes no la afectan.
          </p>
          <Table>
            <Table.Header>
              <Table.Head>Plan</Table.Head>
              <Table.Head>Servicio contratado</Table.Head>
              <Table.Head>Precio mensual</Table.Head>
            </Table.Header>
            <Table.Body>
              {bill.lineItems.map((li) => (
                <Table.Row key={li.contractedServiceId}>
                  <Table.Cell>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{li.planName}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{li.contractedServiceId}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-gray-900 dark:text-gray-100">{formatCurrency(li.monthlyPrice)}</span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          <div className="flex justify-end border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(bill.total)}</div>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
