'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CreateCollectionAccountDTO } from '@/types/collection-account.types';
import { fetchAllCustomers } from '@/hooks/useCatalogs';
import { formatCurrency } from '@/constants/quotation.constants';
import {
  Card,
  Button,
  Input,
  Textarea,
  Combobox,
  IconButton,
  PlusIcon,
  TrashIcon,
  BackLink,
  SectionTitle,
} from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { useGoBack } from '@/hooks/useGoBack';

let nextRowId = 1;

interface LineItemRow {
  rowId: number;
  description: string;
  unitPrice: string;
  quantity: string;
}

function emptyRow(): LineItemRow {
  return { rowId: nextRowId++, description: '', unitPrice: '', quantity: '1' };
}

/** Today as a `YYYY-MM-DD` date-input value, in the browser's timezone. */
function todayInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Local noon of the picked day. The PDF prints dates in the issuer's timezone,
 * and midnight UTC (what `new Date('YYYY-MM-DD')` gives) reads as the day
 * before anywhere west of Greenwich.
 */
const dateInputToIso = (value: string): string => new Date(`${value}T12:00:00`).toISOString();

export default function CreateCollectionAccountPage() {
  const router = useRouter();
  const goBack = useGoBack('/collection-accounts');
  const queryClient = useQueryClient();
  const { showError, showFormErrors } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [issueDate, setIssueDate] = useState(todayInputValue);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<LineItemRow[]>([emptyRow()]);

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: fetchAllCustomers });

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: `${c.fullName} — ${c.phone}` })),
    [customers]
  );
  const linkedCustomer = customers.find((c) => c.id === customerId);
  // The backend keeps the customer's own cédula over a typed one.
  const documentLocked = !!linkedCustomer?.cedula;

  const clearError = (field: string) =>
    setFormErrors((p) => {
      const n = { ...p };
      delete n[field];
      return n;
    });

  const selectCustomer = (id: string) => {
    setCustomerId(id);
    clearError('customer');
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.fullName);
      setCustomerPhone(c.phone);
      setCustomerEmail(c.email ?? '');
      if (c.cedula) setCustomerDocument(c.cedula);
    }
  };

  const updateRow = (rowId: number, patch: Partial<LineItemRow>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
    clearError('lineItems');
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (rowId: number) => setRows((prev) => prev.filter((r) => r.rowId !== rowId));

  const lineTotal = (row: LineItemRow) => {
    const price = Number(row.unitPrice);
    const qty = Number(row.quantity);
    return Number.isFinite(price) && Number.isFinite(qty) ? price * qty : 0;
  };
  const total = rows.reduce((sum, r) => sum + lineTotal(r), 0);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!customerId && !customerName.trim()) {
      errors.customer = 'Indica un cliente existente o el nombre de quien debe';
    }
    if (dueDate && issueDate && dueDate < issueDate) {
      errors.dueDate = 'La fecha límite no puede ser anterior a la de emisión';
    }

    const filledRows = rows.filter((r) => r.description.trim());
    if (filledRows.length === 0) {
      errors.lineItems = 'Agrega al menos un concepto';
    } else {
      for (const r of filledRows) {
        const price = Number(r.unitPrice);
        const qty = Number(r.quantity);
        if (r.unitPrice === '' || !Number.isFinite(price) || price < 0) {
          errors.lineItems = 'Cada concepto necesita un valor unitario válido (≥ 0)';
          break;
        }
        if (!Number.isInteger(qty) || qty <= 0) {
          errors.lineItems = 'Cada concepto necesita una cantidad entera positiva';
          break;
        }
      }
    }

    setFormErrors(errors);
    return !showFormErrors(errors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);

    const dto: CreateCollectionAccountDTO = {
      ...(customerId ? { customerId } : { customerName: customerName.trim() }),
      ...(customerDocument.trim() && !documentLocked ? { customerDocument: customerDocument.trim() } : {}),
      ...(!customerId && customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
      ...(!customerId && customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
      ...(customerAddress.trim() ? { customerAddress: customerAddress.trim() } : {}),
      ...(issueDate ? { issueDate: dateInputToIso(issueDate) } : {}),
      ...(dueDate ? { dueDate: dateInputToIso(dueDate) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      lineItems: rows
        .filter((r) => r.description.trim())
        .map((r) => ({
          description: r.description.trim(),
          unitPrice: Number(r.unitPrice),
          quantity: Number(r.quantity),
        })),
    };

    const result = await apiService.createCollectionAccount(dto);
    if (result.success && result.data) {
      queryClient.invalidateQueries({ queryKey: ['collectionAccounts'] });
      router.replace(`/collection-accounts/${result.data.id}`);
    } else {
      showError(result.error || 'Error al crear la cuenta de cobro');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <BackLink onClick={() => goBack()} className="mb-2" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Nueva Cuenta de Cobro</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Cobra un trabajo puntual: instalación de cámaras, equipos, visitas de reparación
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <Card.Header>
            <SectionTitle info="Con un cliente vinculado, nombre, teléfono, email y cédula se copian de su registro. La dirección siempre se toma de lo escrito aquí. Los datos quedan fijados al crear la cuenta.">
              Cliente
            </SectionTitle>
          </Card.Header>
          <Card.Body className="space-y-4">
            <Combobox
              label="Cliente existente (opcional)"
              options={customerOptions}
              value={customerId}
              onChange={selectCustomer}
              placeholder="Buscar cliente..."
              fullWidth
            />
            {formErrors.customer && <p className="text-sm text-red-600 dark:text-red-400">{formErrors.customer}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); clearError('customer'); }}
                disabled={!!customerId}
                required={!customerId}
                maxLength={150}
                fullWidth
              />
              <Input
                label="Cédula / NIT"
                value={customerDocument}
                onChange={(e) => setCustomerDocument(e.target.value)}
                disabled={documentLocked}
                maxLength={20}
                fullWidth
              />
              <Input
                label="Teléfono"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={!!customerId}
                maxLength={20}
                fullWidth
              />
              <Input
                label="Email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                disabled={!!customerId}
                fullWidth
              />
              <Input
                label="Dirección"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                maxLength={255}
                fullWidth
              />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Detalles</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Fecha de emisión"
                type="date"
                value={issueDate}
                onChange={(e) => { setIssueDate(e.target.value); clearError('dueDate'); }}
                fullWidth
              />
              <Input
                label="Fecha límite de pago (opcional)"
                type="date"
                value={dueDate}
                min={issueDate || undefined}
                onChange={(e) => { setDueDate(e.target.value); clearError('dueDate'); }}
                error={formErrors.dueDate}
                fullWidth
              />
            </div>
            <div className="mt-4">
              <Textarea
                label="Observaciones (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                fullWidth
              />
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Conceptos</h2>
              <IconButton icon={<PlusIcon />} label="Agregar concepto" variant="outline" size="sm" onClick={addRow} />
            </div>
          </Card.Header>
          <Card.Body className="space-y-4">
            {formErrors.lineItems && (
              <p className="text-sm text-red-600 dark:text-red-400">{formErrors.lineItems}</p>
            )}
            {rows.map((row) => (
              <div
                key={row.rowId}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <Input
                      label="Descripción"
                      value={row.description}
                      onChange={(e) => updateRow(row.rowId, { description: e.target.value })}
                      placeholder="Instalación de 4 cámaras"
                      maxLength={500}
                      fullWidth
                    />
                  </div>
                  {rows.length > 1 && (
                    <IconButton
                      icon={<TrashIcon />}
                      label="Quitar concepto"
                      variant="danger"
                      size="sm"
                      className="mt-6"
                      onClick={() => removeRow(row.rowId)}
                    />
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <Input
                    label="Valor unitario"
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
                    Subtotal:{' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(lineTotal(row))}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(total)}</div>
              </div>
            </div>
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => goBack()} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Crear Cuenta de Cobro
          </Button>
        </div>
      </form>
    </div>
  );
}
