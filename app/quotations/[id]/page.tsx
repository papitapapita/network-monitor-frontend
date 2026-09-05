'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { QuotationDTO } from '@/types/quotation.types';
import { CustomerDTO } from '@/types/customer.types';
import { fetchAllDeviceModels } from '@/hooks/useCatalogs';
import {
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_VARIANTS,
  formatCurrency,
  canEditQuotation,
  canSend,
  canAccept,
  canReject,
  canExpire,
} from '@/constants/quotation.constants';
import {
  Card,
  Button,
  LoadingSpinner,
  Badge,
  Table,
  BackLink,
  Input,
  Textarea,
  Combobox,
  IconButton,
  EditFormActions,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/ui';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/toast.context';

type PendingAction = 'send' | 'accept' | 'expire' | null;

const ACTION_COPY: Record<Exclude<PendingAction, null>, { title: string; message: string; confirm: string; variant: 'danger' | 'primary' }> = {
  send: { title: 'Enviar cotización', message: '¿Enviar esta cotización al cliente? Los conceptos y detalles quedarán bloqueados.', confirm: 'Enviar', variant: 'primary' },
  accept: { title: 'Marcar como aceptada', message: '¿Confirmas que el cliente aceptó esta cotización?', confirm: 'Marcar Aceptada', variant: 'primary' },
  expire: { title: 'Marcar como expirada', message: '¿Marcar esta cotización como expirada?', confirm: 'Marcar Expirada', variant: 'danger' },
};

let nextRowId = 1;
interface LineItemRow {
  rowId: number;
  deviceModelId: string;
  description: string;
  unitPrice: string;
  quantity: string;
}

export default function QuotationDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id: quotationId } = useParams() as { id: string };
  const { showError } = useToast();

  const [quotation, setQuotation] = useState<QuotationDTO | null>(null);
  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isActing, setIsActing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const { data: deviceModels = [] } = useQuery({ queryKey: ['deviceModels'], queryFn: fetchAllDeviceModels });
  const modelOptions = useMemo(
    () => deviceModels.map((m) => ({ value: m.id, label: `${m.vendorName} — ${m.model} (${m.deviceType})` })),
    [deviceModels]
  );
  const modelById = useMemo(() => new Map(deviceModels.map((m) => [m.id, m])), [deviceModels]);

  const fetchQuotation = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const r = await apiService.getQuotation(quotationId);
    if (r.success && r.data) {
      setQuotation(r.data);
      if (r.data.customerId) {
        const c = await apiService.getCustomer(r.data.customerId);
        if (c.success && c.data) setCustomer(c.data);
      }
    } else {
      setLoadError(r.error || 'Error al cargar la cotización');
    }
    setIsLoading(false);
  }, [quotationId]);

  useEffect(() => { fetchQuotation(); }, [fetchQuotation]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['quotations'] });

  const runAction = async () => {
    if (!pendingAction) return;
    setIsActing(true);
    setActionError(null);
    const call =
      pendingAction === 'send' ? apiService.sendQuotation(quotationId)
      : pendingAction === 'accept' ? apiService.acceptQuotation(quotationId)
      : apiService.expireQuotation(quotationId);
    const r = await call;
    setIsActing(false);
    setPendingAction(null);
    if (r.success && r.data) {
      setQuotation(r.data);
      invalidate();
    } else {
      const message = r.error || 'No se pudo actualizar la cotización';
      setActionError(message);
      showError(message);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError('El motivo es requerido');
      return;
    }
    setIsActing(true);
    setRejectError(null);
    const r = await apiService.rejectQuotation(quotationId, { reason: rejectReason.trim() });
    setIsActing(false);
    if (r.success && r.data) {
      setQuotation(r.data);
      invalidate();
      setShowRejectModal(false);
      setRejectReason('');
    } else {
      const message = r.error || 'No se pudo rechazar la cotización';
      setRejectError(message);
      showError(message);
    }
  };

  const handleDownloadPdf = async () => {
    if (!quotation) return;
    setIsDownloading(true);
    setActionError(null);
    const r = await apiService.downloadQuotationPdf(quotationId);
    setIsDownloading(false);
    if (r.success && r.data) {
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizacion-${quotation.code ?? quotation.id}.pdf`;
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

  // ── Editable details (customer snapshot, validity, notes) ──
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', validUntil: '', notes: '',
  });

  const startEditDetails = () => {
    if (!quotation) return;
    setDetailsForm({
      customerName: quotation.customerName,
      customerPhone: quotation.customerPhone ?? '',
      customerEmail: quotation.customerEmail ?? '',
      customerAddress: quotation.customerAddress ?? '',
      validUntil: quotation.validUntil.slice(0, 10),
      notes: quotation.notes ?? '',
    });
    setIsEditingDetails(true);
  };

  const saveDetails = async () => {
    if (!quotation) return;
    setIsSavingDetails(true);
    const r = await apiService.updateQuotationDetails(quotationId, {
      customerName: detailsForm.customerName.trim(),
      customerPhone: detailsForm.customerPhone.trim(),
      customerEmail: detailsForm.customerEmail.trim(),
      customerAddress: detailsForm.customerAddress.trim(),
      validUntil: new Date(detailsForm.validUntil).toISOString(),
      notes: detailsForm.notes.trim(),
    });
    setIsSavingDetails(false);
    if (r.success && r.data) {
      setQuotation(r.data);
      setIsEditingDetails(false);
      invalidate();
    } else {
      showError(r.error || 'No se pudieron guardar los detalles');
    }
  };

  // ── Editable line items ──────────────────────────────────
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [itemRows, setItemRows] = useState<LineItemRow[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [droppedCount, setDroppedCount] = useState(0);

  const startEditItems = () => {
    if (!quotation) return;
    const withModel = quotation.lineItems.filter((li) => li.deviceModelId);
    setDroppedCount(quotation.lineItems.length - withModel.length);
    setItemRows(
      withModel.length > 0
        ? withModel.map((li) => ({
            rowId: nextRowId++,
            deviceModelId: li.deviceModelId as string,
            description: li.description,
            unitPrice: String(li.unitPrice),
            quantity: String(li.quantity),
          }))
        : [{ rowId: nextRowId++, deviceModelId: '', description: '', unitPrice: '', quantity: '1' }]
    );
    setItemsError(null);
    setIsEditingItems(true);
  };

  const updateRow = (rowId: number, patch: Partial<LineItemRow>) =>
    setItemRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const addRow = () =>
    setItemRows((prev) => [...prev, { rowId: nextRowId++, deviceModelId: '', description: '', unitPrice: '', quantity: '1' }]);
  const removeRow = (rowId: number) => setItemRows((prev) => prev.filter((r) => r.rowId !== rowId));

  const rowTotal = (row: LineItemRow) => {
    const price = Number(row.unitPrice);
    const qty = Number(row.quantity);
    return Number.isFinite(price) && Number.isFinite(qty) ? price * qty : 0;
  };

  const saveItems = async () => {
    const valid = itemRows.filter((r) => r.deviceModelId);
    if (valid.length === 0) {
      setItemsError('Agrega al menos un artículo');
      return;
    }
    for (const r of valid) {
      const price = Number(r.unitPrice);
      const qty = Number(r.quantity);
      if (!Number.isFinite(price) || price < 0) {
        setItemsError('Cada artículo necesita un precio unitario válido (≥ 0)');
        return;
      }
      if (!Number.isInteger(qty) || qty <= 0) {
        setItemsError('Cada artículo necesita una cantidad entera positiva');
        return;
      }
    }
    setItemsError(null);
    setIsSavingItems(true);
    const r = await apiService.updateQuotationLineItems(quotationId, {
      lineItems: valid.map((row) => ({
        deviceModelId: row.deviceModelId,
        ...(row.description.trim() ? { description: row.description.trim() } : {}),
        unitPrice: Number(row.unitPrice),
        quantity: Number(row.quantity),
      })),
    });
    setIsSavingItems(false);
    if (r.success && r.data) {
      setQuotation(r.data);
      setIsEditingItems(false);
      invalidate();
    } else {
      const message = r.error || 'No se pudieron guardar los artículos';
      setItemsError(message);
      showError(message);
    }
  };

  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" message="Cargando cotización..." /></div>;
  if (loadError && !quotation) return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{loadError}</p>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" onClick={() => router.back()}>Volver</Button>
          <Button onClick={fetchQuotation}>Reintentar</Button>
        </div>
      </div>
    </div>
  );
  if (!quotation) return null;

  const copy = pendingAction ? ACTION_COPY[pendingAction] : null;
  const editable = canEditQuotation(quotation.status);

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

      <Modal isOpen={showRejectModal} onClose={() => { setShowRejectModal(false); setRejectError(null); }} title="Rechazar Cotización">
        <form onSubmit={handleReject} className="space-y-4">
          {rejectError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-400">
              {rejectError}
            </div>
          )}
          <Textarea
            label="Motivo del rechazo"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={255}
            required
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowRejectModal(false)} disabled={isActing}>Cancelar</Button>
            <Button type="submit" variant="danger" isLoading={isActing}>Rechazar</Button>
          </div>
        </form>
      </Modal>

      <div className="mb-2">
        <BackLink label="Cotizaciones" onClick={() => router.back()} />
      </div>
      <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-col sm:justify-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere">
              {quotation.code !== null ? `Cotización #${quotation.code}` : 'Cotización (borrador)'}
            </h1>
            <Badge variant={QUOTATION_STATUS_VARIANTS[quotation.status]}>
              {QUOTATION_STATUS_LABELS[quotation.status]}
            </Badge>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5 wrap-anywhere">
            {quotation.customerName}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} isLoading={isDownloading}>Descargar PDF</Button>
          {canSend(quotation.status) && <Button size="sm" onClick={() => setPendingAction('send')}>Enviar</Button>}
          {canAccept(quotation.status) && <Button size="sm" onClick={() => setPendingAction('accept')}>Aceptar</Button>}
          {canReject(quotation.status) && (
            <Button size="sm" variant="outline" onClick={() => setShowRejectModal(true)}>Rechazar</Button>
          )}
          {canExpire(quotation.status, quotation.validUntil) && (
            <Button size="sm" variant="danger" onClick={() => setPendingAction('expire')}>Marcar Expirada</Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{actionError}</p>
        </div>
      )}

      {/* Details */}
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalles</h2>
            {editable && !isEditingDetails && (
              <IconButton icon={<EditIcon />} label="Editar detalles" size="sm" onClick={startEditDetails} />
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {isEditingDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nombre del cliente"
                  value={detailsForm.customerName}
                  onChange={(e) => setDetailsForm((p) => ({ ...p, customerName: e.target.value }))}
                  disabled={!!quotation.customerId}
                  required={!quotation.customerId}
                  fullWidth
                />
                <Input
                  label="Teléfono"
                  value={detailsForm.customerPhone}
                  onChange={(e) => setDetailsForm((p) => ({ ...p, customerPhone: e.target.value }))}
                  disabled={!!quotation.customerId}
                  fullWidth
                />
                <Input
                  label="Email"
                  type="email"
                  value={detailsForm.customerEmail}
                  onChange={(e) => setDetailsForm((p) => ({ ...p, customerEmail: e.target.value }))}
                  disabled={!!quotation.customerId}
                  fullWidth
                />
                <Input
                  label="Dirección"
                  value={detailsForm.customerAddress}
                  onChange={(e) => setDetailsForm((p) => ({ ...p, customerAddress: e.target.value }))}
                  fullWidth
                />
                <Input
                  label="Válida hasta"
                  type="date"
                  value={detailsForm.validUntil}
                  onChange={(e) => setDetailsForm((p) => ({ ...p, validUntil: e.target.value }))}
                  required
                  fullWidth
                />
              </div>
              <Textarea
                label="Notas"
                value={detailsForm.notes}
                onChange={(e) => setDetailsForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                fullWidth
              />
              <EditFormActions onCancel={() => setIsEditingDetails(false)} onSave={saveDetails} isSaving={isSavingDetails} />
            </div>
          ) : (
            <dl className="wrap-anywhere grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {[
                { label: 'Cliente', value: quotation.customerName },
                { label: 'Teléfono', value: quotation.customerPhone ?? '—' },
                { label: 'Email', value: quotation.customerEmail ?? '—' },
                { label: 'Dirección', value: quotation.customerAddress ?? '—' },
                { label: 'Válida hasta', value: new Date(quotation.validUntil).toLocaleDateString('es') },
                { label: 'Total', value: formatCurrency(quotation.total) },
                { label: 'Notas', value: quotation.notes ?? '—' },
                { label: 'Enviada', value: quotation.sentAt ? new Date(quotation.sentAt).toLocaleDateString('es') : '—' },
                { label: 'Aceptada', value: quotation.acceptedAt ? new Date(quotation.acceptedAt).toLocaleDateString('es') : '—' },
                ...(quotation.status === 'REJECTED'
                  ? [{ label: 'Motivo de rechazo', value: quotation.rejectionReason ?? '—' }]
                  : []),
                { label: 'Expirada', value: quotation.expiredAt ? new Date(quotation.expiredAt).toLocaleDateString('es') : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-100">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card.Body>
      </Card>

      {customer && (
        <Card>
          <Card.Header>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cliente Vinculado</h2>
              <Button size="sm" variant="outline" onClick={() => router.push(`/customers/${customer.id}`)}>Ver Cliente</Button>
            </div>
          </Card.Header>
          <Card.Body>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Los datos mostrados arriba son una copia tomada al crear la cotización — no se
              actualizan si el registro del cliente cambia después.
            </p>
          </Card.Body>
        </Card>
      )}

      {/* Line items */}
      <Card>
        <Card.Header>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Artículos
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({quotation.lineItems.length})
              </span>
            </h2>
            {editable && !isEditingItems && (
              <IconButton icon={<EditIcon />} label="Editar artículos" size="sm" onClick={startEditItems} />
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {isEditingItems ? (
            <div className="space-y-4">
              {itemsError && <p className="text-sm text-red-600 dark:text-red-400">{itemsError}</p>}
              {droppedCount > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {droppedCount} {droppedCount === 1 ? 'artículo' : 'artículos'} se omitió porque su
                  modelo ya fue eliminado del catálogo. Agrégalo de nuevo si sigue vigente.
                </p>
              )}
              {itemRows.map((row) => {
                const model = modelById.get(row.deviceModelId);
                return (
                  <div key={row.rowId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <Combobox
                          label="Modelo"
                          options={modelOptions}
                          value={row.deviceModelId}
                          onChange={(v) => {
                            const m = modelById.get(v);
                            updateRow(row.rowId, {
                              deviceModelId: v,
                              description: row.description || (m ? `${m.vendorName} ${m.model}` : ''),
                            });
                          }}
                          placeholder="Buscar modelo..."
                          fullWidth
                        />
                      </div>
                      {itemRows.length > 1 && (
                        <IconButton
                          icon={<TrashIcon />}
                          label="Quitar artículo"
                          variant="danger"
                          size="sm"
                          className="mt-6"
                          onClick={() => removeRow(row.rowId)}
                        />
                      )}
                    </div>
                    <Input
                      label="Descripción"
                      value={row.description}
                      onChange={(e) => updateRow(row.rowId, { description: e.target.value })}
                      placeholder={model ? `${model.vendorName} ${model.model}` : undefined}
                      fullWidth
                    />
                    <div className="grid grid-cols-3 gap-3 items-end">
                      <Input
                        label="Precio unitario"
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.unitPrice}
                        onChange={(e) => updateRow(row.rowId, { unitPrice: e.target.value })}
                        fullWidth
                      />
                      <Input
                        label="Cantidad"
                        type="number"
                        min={1}
                        step="1"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.rowId, { quantity: e.target.value })}
                        fullWidth
                      />
                      <div className="text-sm text-gray-500 dark:text-gray-400 pb-2">
                        Subtotal: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(rowTotal(row))}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <IconButton icon={<PlusIcon />} label="Agregar artículo" variant="outline" size="sm" onClick={addRow} />
              <EditFormActions onCancel={() => setIsEditingItems(false)} onSave={saveItems} isSaving={isSavingItems} />
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Vendedor, modelo e imagen quedan fijados al agregar cada artículo — cambios
                posteriores en el catálogo no afectan lo ya cotizado.
              </p>
              <Table>
                <Table.Header>
                  <Table.Head>Descripción</Table.Head>
                  <Table.Head>Modelo</Table.Head>
                  <Table.Head>Cantidad</Table.Head>
                  <Table.Head>Precio Unitario</Table.Head>
                  <Table.Head>Total</Table.Head>
                </Table.Header>
                <Table.Body>
                  {quotation.lineItems.map((li, i) => (
                    <Table.Row key={i}>
                      <Table.Cell>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{li.description}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {li.vendorName} {li.deviceModelName}
                          {!li.deviceModelId && ' (eliminado del catálogo)'}
                        </span>
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
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(quotation.total)}</div>
                </div>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
