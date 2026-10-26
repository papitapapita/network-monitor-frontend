'use client';

import React, { useState } from 'react';
import { apiService } from '@/services/api.service';
import { BillDTO, PaymentMethod } from '@/types/bill.types';
import { Modal, Button, Input, Select } from '@/components/ui';
import {
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_REFERENCE_MAX_LENGTH,
  formatCurrency,
} from '@/constants/bill.constants';

interface Props {
  onClose: () => void;
  bill: BillDTO;
  onPaid: (bill: BillDTO) => void;
}

/** A `datetime-local` value ('YYYY-MM-DDTHH:mm') for the given moment, in local time. */
const toLocalInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Records the bill's one payment (BIL-300…303): how it was paid, the receipt
 * or transaction number, and when. The amount is always the bill's total, and
 * the payment is never edited afterwards. Mount it only while open, so each
 * opening starts from a blank form dated now.
 */
export function PayBillModal({ onClose, bill, onPaid }: Props) {
  const [method, setMethod] = useState<PaymentMethod | ''>('');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(() => toLocalInput(new Date()));
  const [errors, setErrors] = useState<{ method?: string; paidAt?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    const next: typeof errors = {};
    if (!method) next.method = 'Indica cómo se pagó';
    const when = paidAt ? new Date(paidAt) : null;
    if (!when || Number.isNaN(when.getTime())) next.paidAt = 'Indica la fecha de pago';
    else if (when.getTime() > Date.now()) next.paidAt = 'La fecha de pago no puede ser futura';
    setErrors(next);
    if (Object.keys(next).length > 0 || !method || !when) return;

    setIsSaving(true);
    setError(null);
    const r = await apiService.payBill(bill.id, {
      method,
      reference: reference.trim() || null,
      paidAt: when.toISOString(),
    });
    setIsSaving(false);
    if (r.success && r.data) {
      onPaid(r.data);
    } else {
      setError(r.error || 'No se pudo registrar el pago');
    }
  };

  return (
    <Modal
      isOpen
      onClose={isSaving ? () => {} : onClose}
      title="Registrar pago"
      info="Una factura admite un solo pago, por su total, y no se puede editar después. Si el servicio de esta factura estaba suspendido por mora y no tiene otra factura vencida, se reactiva al registrarlo. Los demás servicios del cliente no cambian."
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="text-sm">
          <span className="text-gray-500 dark:text-gray-400">Monto: </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(bill.total)}</span>
        </div>

        <Select
          label="Medio de pago"
          value={method}
          onChange={(e) => { setMethod(e.target.value as PaymentMethod); setErrors((p) => ({ ...p, method: undefined })); }}
          options={[{ value: '', label: 'Seleccionar medio' }, ...PAYMENT_METHOD_OPTIONS]}
          error={errors.method}
          required
          fullWidth
        />

        <Input
          label="Referencia"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={PAYMENT_REFERENCE_MAX_LENGTH}
          placeholder="opcional"
          info="Número de recibo o de transacción."
          fullWidth
        />

        <Input
          label="Fecha de pago"
          type="datetime-local"
          value={paidAt}
          max={toLocalInput(new Date())}
          onChange={(e) => { setPaidAt(e.target.value); setErrors((p) => ({ ...p, paidAt: undefined })); }}
          error={errors.paidAt}
          info="Cuándo pagó el cliente, no cuándo se registra."
          required
          fullWidth
        />
      </div>

      <Modal.Footer>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} isLoading={isSaving}>
          Registrar pago
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
