'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { BillDTO, BulkGenerateResult } from '@/types/bill.types';
import { CustomerDTO } from '@/types/customer.types';
import {
  BILL_STATUS_LABELS,
  BILL_STATUS_VARIANTS,
  BILL_STATUS_OPTIONS,
  MONTH_OPTIONS,
  formatPeriod,
  formatCurrency,
} from '@/constants/bill.constants';
import {
  Badge,
  Button,
  DataTable,
  ErrorBanner,
  FilterBar,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  sortRows,
  useTableSort,
} from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';

const LIMIT = 20;

async function fetchAllBills(): Promise<BillDTO[]> {
  const all: BillDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listBills({ limit: 100, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar las facturas');
    all.push(...r.data.bills);
    hasMore = r.data.hasMore;
    offset += 100;
  }
  return all;
}

async function fetchAllCustomers(): Promise<CustomerDTO[]> {
  const all: CustomerDTO[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await apiService.listCustomers({ limit: 100, offset });
    if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar clientes');
    all.push(...r.data.customers);
    hasMore = r.data.hasMore;
    offset += 100;
  }
  return all;
}

const now = new Date();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const y = now.getFullYear() - 3 + i;
  return { value: String(y), label: String(y) };
});

function buildBillColumns(customerName: (id: string) => string): DataTableColumn<BillDTO>[] {
  return [
    {
      key: 'customer',
      header: 'Cliente',
      sortValue: (b) => customerName(b.customerId),
      cell: (b) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{customerName(b.customerId)}</span>
      ),
    },
    {
      key: 'period',
      header: 'Periodo',
      sortValue: (b) => b.period,
      cell: (b) => <span className="text-gray-700 dark:text-gray-300">{formatPeriod(b.period)}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      sortValue: (b) => BILL_STATUS_LABELS[b.status],
      cell: (b) => <Badge variant={BILL_STATUS_VARIANTS[b.status]}>{BILL_STATUS_LABELS[b.status]}</Badge>,
    },
    {
      key: 'dueDate',
      header: 'Vencimiento',
      sortValue: (b) => b.dueDate,
      className: 'hidden sm:table-cell',
      cell: (b) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(b.dueDate).toLocaleDateString('es')}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortValue: (b) => b.total,
      cell: (b) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(b.total)}</span>
      ),
    },
  ];
}

function BillsPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const sort = useTableSort({ onChange: () => setCurrentPage(1) });

  const { data: bills = [], isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['bills'],
    queryFn: fetchAllBills,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchAllCustomers,
  });

  const customerName = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c.fullName]));
    return (id: string) => map.get(id) ?? id;
  }, [customers]);

  const columns = useMemo(() => buildBillColumns(customerName), [customerName]);

  const filtered = useMemo(() => {
    const rows = bills.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false;
      if (yearFilter && !b.period.startsWith(`${yearFilter}-`)) return false;
      if (monthFilter && b.period.split('-')[1] !== String(monthFilter).padStart(2, '0')) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!customerName(b.customerId).toLowerCase().includes(q) && !b.period.includes(q)) return false;
      }
      return true;
    });
    return sortRows(rows, columns, sort.field, sort.direction);
  }, [bills, statusFilter, yearFilter, monthFilter, search, customerName, columns, sort.field, sort.direction]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / LIMIT));
  const paginated = filtered.slice((currentPage - 1) * LIMIT, currentPage * LIMIT);

  const totals = useMemo(() => {
    const pending = filtered.filter((b) => b.status === 'PENDING' || b.status === 'OVERDUE');
    return {
      outstanding: pending.reduce((sum, b) => sum + b.total, 0),
      outstandingCount: pending.length,
    };
  }, [filtered]);

  const hasFilters = !!(search || statusFilter || yearFilter || monthFilter);
  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setYearFilter(''); setMonthFilter(''); setCurrentPage(1);
  };

  const onGenerated = () => {
    queryClient.invalidateQueries({ queryKey: ['bills'] });
    refetch();
  };

  const [showSingle, setShowSingle] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      <GenerateBillModal
        isOpen={showSingle}
        onClose={() => setShowSingle(false)}
        customers={customers}
        onGenerated={onGenerated}
      />
      <GenerateBulkModal
        isOpen={showBulk}
        onClose={() => setShowBulk(false)}
        customerName={customerName}
        onGenerated={onGenerated}
      />

      <PageHeader
        title="Facturas"
        subtitle={
          bills.length > 0
            ? `${bills.length} ${bills.length === 1 ? 'factura' : 'facturas'} · ${formatCurrency(totals.outstanding)} por cobrar (${totals.outstandingCount})`
            : 'Genera y administra la facturación mensual'
        }
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowBulk(true)}>Generación Masiva</Button>
            <Button onClick={() => setShowSingle(true)}>Generar Factura</Button>
          </>
        }
      />

      <FilterBar columns={5} hasFilters={hasFilters} onClear={clearFilters}>
        <Input
          label="Buscar"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Cliente o periodo..."
          fullWidth
        />
        <Select
          label="Estado"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          options={BILL_STATUS_OPTIONS}
          fullWidth
        />
        <Select
          label="Año"
          value={yearFilter}
          onChange={(e) => { setYearFilter(e.target.value); setCurrentPage(1); }}
          options={[{ value: '', label: 'Todos' }, ...YEAR_OPTIONS]}
          fullWidth
        />
        <Select
          label="Mes"
          value={monthFilter}
          onChange={(e) => { setMonthFilter(e.target.value); setCurrentPage(1); }}
          options={[{ value: '', label: 'Todos' }, ...MONTH_OPTIONS]}
          fullWidth
        />
      </FilterBar>

      {error && <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />}

      {/* Bills are never deleted — the backend only cancels them — so this table has no selection. */}
      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(b) => b.id}
        onRowClick={(b) => router.push(`/bills/${b.id}`)}
        isLoading={isLoading}
        loadingMessage="Cargando facturas..."
        emptyMessage={
          hasFilters
            ? 'Ninguna factura coincide con los filtros'
            : 'Sin facturas. Genera la primera para comenzar.'
        }
        sort={sort}
        pagination={{
          currentPage,
          totalPages,
          totalItems: filtered.length,
          itemsPerPage: LIMIT,
          onPageChange: setCurrentPage,
        }}
      />
    </div>
  );
}

// ── Generate a bill for one customer ─────────────────────────
function GenerateBillModal({
  isOpen, onClose, customers, onGenerated,
}: {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerDTO[];
  onGenerated: () => void;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const reset = () => { setCustomerId(''); setDueDate(''); setError(null); setFieldError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { setFieldError('Selecciona un cliente'); return; }
    setIsSubmitting(true);
    setError(null);
    const r = await apiService.generateBill({
      customerId,
      year: Number(year),
      month: Number(month),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
    setIsSubmitting(false);
    if (r.success && r.data) {
      onGenerated();
      reset();
      onClose();
      router.push(`/bills/${r.data.id}`);
    } else {
      setError(r.error || 'Error al generar la factura');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generar Factura">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-400">
            {error}
          </div>
        )}
        <Select
          label="Cliente"
          value={customerId}
          onChange={(e) => { setCustomerId(e.target.value); setFieldError(null); }}
          options={[{ value: '', label: 'Seleccionar cliente' }, ...customers.map((c) => ({ value: c.id, label: c.fullName }))]}
          error={fieldError ?? undefined}
          required
          fullWidth
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Año" value={year} onChange={(e) => setYear(e.target.value)} options={YEAR_OPTIONS} fullWidth />
          <Select label="Mes" value={month} onChange={(e) => setMonth(e.target.value)} options={MONTH_OPTIONS} fullWidth />
        </div>
        <Input
          label="Fecha de vencimiento (opcional)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          fullWidth
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Se incluye una línea por cada servicio contratado <strong>activo</strong> del cliente. Por defecto vence 15 días después de la emisión.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" isLoading={isSubmitting}>Generar</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Generate bills for every customer with active services ───
function GenerateBulkModal({
  isOpen, onClose, customerName, onGenerated,
}: {
  isOpen: boolean;
  onClose: () => void;
  customerName: (id: string) => string;
  onGenerated: () => void;
}) {
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkGenerateResult | null>(null);

  const handleClose = () => { setResult(null); setError(null); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const r = await apiService.generateBulkBills({
      year: Number(year),
      month: Number(month),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
    setIsSubmitting(false);
    if (r.success && r.data) {
      setResult(r.data);
      onGenerated();
    } else {
      setError(r.error || 'Error al generar las facturas');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Generación Masiva" size="lg">
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Periodo <strong>{formatPeriod(result.period)}</strong>
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3">
              <div className="text-2xl font-bold text-green-800 dark:text-green-400">{result.generated.length}</div>
              <div className="text-xs text-green-700 dark:text-green-500">Generadas</div>
            </div>
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3">
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-400">{result.skipped.length}</div>
              <div className="text-xs text-yellow-700 dark:text-yellow-500">Omitidas</div>
            </div>
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <div className="text-2xl font-bold text-red-800 dark:text-red-400">{result.failed.length}</div>
              <div className="text-xs text-red-700 dark:text-red-500">Fallidas</div>
            </div>
          </div>

          {result.skipped.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Omitidas</h3>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 max-h-32 overflow-y-auto">
                {result.skipped.map((s) => (
                  <li key={s.customerId}>{customerName(s.customerId)} — {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {result.failed.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">Fallidas</h3>
              <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                {result.failed.map((f) => (
                  <li key={f.customerId}>{customerName(f.customerId)} — {f.error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleClose}>Cerrar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-400">
              {error}
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Genera una factura para <strong>cada cliente</strong> con al menos un servicio contratado activo. Los clientes que ya tienen factura del periodo se omiten.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Año" value={year} onChange={(e) => setYear(e.target.value)} options={YEAR_OPTIONS} fullWidth />
            <Select label="Mes" value={month} onChange={(e) => setMonth(e.target.value)} options={MONTH_OPTIONS} fullWidth />
          </div>
          <Input
            label="Fecha de vencimiento (opcional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            fullWidth
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Esta operación está limitada a 5 ejecuciones por hora.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" isLoading={isSubmitting}>Generar Facturas</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function BillsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><LoadingSpinner /></div>}>
      <BillsPageContent />
    </Suspense>
  );
}
