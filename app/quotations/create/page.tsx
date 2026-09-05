'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { CreateQuotationDTO } from '@/types/quotation.types';
import { fetchAllCustomers, fetchAllDeviceModels } from '@/hooks/useCatalogs';
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
} from '@/components/ui';
import { useToast } from '@/contexts/toast.context';

let nextRowId = 1;

interface LineItemRow {
  rowId: number;
  deviceModelId: string;
  description: string;
  unitPrice: string;
  quantity: string;
}

function emptyRow(): LineItemRow {
  return { rowId: nextRowId++, deviceModelId: '', description: '', unitPrice: '', quantity: '1' };
}

export default function CreateQuotationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showError, showFormErrors } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<LineItemRow[]>([emptyRow()]);

  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: fetchAllCustomers });
  const { data: deviceModels = [] } = useQuery({ queryKey: ['deviceModels'], queryFn: fetchAllDeviceModels });

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: `${c.fullName} — ${c.phone}` })),
    [customers]
  );
  const modelOptions = useMemo(
    () =>
      deviceModels.map((m) => ({
        value: m.id,
        label: `${m.vendorName} — ${m.model} (${m.deviceType})`,
      })),
    [deviceModels]
  );
  const modelById = useMemo(() => new Map(deviceModels.map((m) => [m.id, m])), [deviceModels]);

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
  const subtotal = rows.reduce((sum, r) => sum + lineTotal(r), 0);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!customerId && !customerName.trim()) {
      errors.customer = 'Indica un cliente existente o el nombre de un prospecto';
    }
    if (!validUntil) errors.validUntil = 'La fecha de validez es requerida';

    const validRows = rows.filter((r) => r.deviceModelId);
    if (validRows.length === 0) {
      errors.lineItems = 'Agrega al menos un artículo';
    } else {
      for (const r of rows) {
        if (!r.deviceModelId) continue;
        const price = Number(r.unitPrice);
        const qty = Number(r.quantity);
        if (!Number.isFinite(price) || price < 0) {
          errors.lineItems = 'Cada artículo necesita un precio unitario válido (≥ 0)';
          break;
        }
        if (!Number.isInteger(qty) || qty <= 0) {
          errors.lineItems = 'Cada artículo necesita una cantidad entera positiva';
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

    const dto: CreateQuotationDTO = {
      ...(customerId ? { customerId } : { customerName: customerName.trim() }),
      ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
      ...(customerEmail.trim() ? { customerEmail: customerEmail.trim() } : {}),
      ...(customerAddress.trim() ? { customerAddress: customerAddress.trim() } : {}),
      validUntil: new Date(validUntil).toISOString(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      lineItems: rows
        .filter((r) => r.deviceModelId)
        .map((r) => ({
          deviceModelId: r.deviceModelId,
          ...(r.description.trim() ? { description: r.description.trim() } : {}),
          unitPrice: Number(r.unitPrice),
          quantity: Number(r.quantity),
        })),
    };

    const result = await apiService.createQuotation(dto);
    if (result.success && result.data) {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      router.replace(`/quotations/${result.data.id}`);
    } else {
      showError(result.error || 'Error al crear la cotización');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <BackLink label="Cotizaciones" onClick={() => router.back()} className="mb-2" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Nueva Cotización</h1>
        <p className="text-gray-600 dark:text-gray-400">Prepara una propuesta comercial para un cliente o prospecto</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cliente</h2>
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
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sin cliente existente, indica al menos el nombre del prospecto. La dirección siempre se
              toma de lo escrito aquí, aun con un cliente vinculado — el cliente no guarda dirección.
            </p>
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
                label="Teléfono"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={!!customerId}
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
                label="Válida hasta"
                type="date"
                value={validUntil}
                onChange={(e) => { setValidUntil(e.target.value); clearError('validUntil'); }}
                error={formErrors.validUntil}
                required
                fullWidth
              />
            </div>
            <div className="mt-4">
              <Textarea
                label="Notas (opcional)"
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Artículos</h2>
              <IconButton icon={<PlusIcon />} label="Agregar artículo" variant="outline" size="sm" onClick={addRow} />
            </div>
          </Card.Header>
          <Card.Body className="space-y-4">
            {formErrors.lineItems && (
              <p className="text-sm text-red-600 dark:text-red-400">{formErrors.lineItems}</p>
            )}
            {rows.map((row) => {
              const model = modelById.get(row.deviceModelId);
              return (
                <div
                  key={row.rowId}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
                >
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
                    {rows.length > 1 && (
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
                      Subtotal:{' '}
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(lineTotal(row))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(subtotal)}</div>
              </div>
            </div>
          </Card.Body>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Crear Cotización
          </Button>
        </div>
      </form>
    </div>
  );
}
