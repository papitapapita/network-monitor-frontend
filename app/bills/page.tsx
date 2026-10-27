'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { BillDTO, BulkGenerateResult } from '@/types/bill.types';
import { CustomerDTO } from '@/types/customer.types';
import { fetchAllContractedServices, fetchAllCustomers } from '@/hooks/useCatalogs';
import { useToast } from '@/contexts/toast.context';
import {
  BILL_STATUS_LABELS,
  BILL_STATUS_VARIANTS,
  BILL_STATUS_OPTIONS,
  MONTH_OPTIONS,
  formatPeriod,
  formatCurrency,
} from '@/constants/bill.constants';
import { formatPaymentDay } from '@/constants/billing-settings.constants';
import { useUrlState, useUrlTableSort } from '@/hooks/useUrlState';
import {
  Badge,
  Button,
  ColumnPicker,
  DataTable,
  ErrorBanner,
  FilterBar,
  FilterChip,
  IconButton,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  PlusIcon,
  Select,
  sortRows,
  useColumnVisibility,
} from '@/components/ui';
import type { DataTableColumn, PickableColumn } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';

const LIMIT = 20;
const COLUMNS_STORAGE_KEY = 'nms:bills-columns';

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

const now = new Date();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => {
  const y = now.getFullYear() - 3 + i;
  return { value: String(y), label: String(y) };
});

type BillColumn = DataTableColumn<BillDTO> & { label: string; locked?: boolean };

/**
 * Bills are per service since 2026-10-26 (BIL-007), so one customer can have
 * several in a period: the plan tells them apart. Older bills may hold several lines.
 */
function billServiceLabel(b: BillDTO): string {
  if (b.lineItems.length === 0) return '—';
  if (b.lineItems.length === 1) return b.lineItems[0].planName;
  return `${b.lineItems.length} servicios`;
}

function billColumnCatalog(customerName: (id: string) => string): BillColumn[] {
  return [
    {
      key: 'customer',
      label: 'Cliente',
      locked: true,
      header: 'Cliente',
      sortValue: (b) => customerName(b.customerId),
      cellClassName: 'max-w-xs',
      cell: (b) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{customerName(b.customerId)}</span>
      ),
    },
    {
      key: 'service',
      label: 'Servicio',
      header: 'Servicio',
      sortValue: (b) => billServiceLabel(b),
      className: 'hidden md:table-cell',
      cell: (b) => <span className="text-sm text-gray-600 dark:text-gray-400">{billServiceLabel(b)}</span>,
    },
    {
      key: 'period',
      label: 'Periodo',
      header: 'Periodo',
      sortValue: (b) => b.period,
      cell: (b) => <span className="text-gray-700 dark:text-gray-300">{formatPeriod(b.period)}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      header: 'Estado',
      sortValue: (b) => BILL_STATUS_LABELS[b.status],
      cell: (b) => <Badge variant={BILL_STATUS_VARIANTS[b.status]}>{BILL_STATUS_LABELS[b.status]}</Badge>,
    },
    {
      key: 'dueDate',
      label: 'Vencimiento',
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
      label: 'Total',
      header: 'Total',
      sortValue: (b) => b.total,
      cell: (b) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(b.total)}</span>
      ),
    },
  ];
}

const BILL_COLUMN_OPTIONS: PickableColumn[] = billColumnCatalog((id) => id).map(
  ({ key, label, locked }) => ({ key, label, locked })
);
const DEFAULT_BILL_COLUMNS = billColumnCatalog((id) => id).map((c) => c.key);

function buildBillColumns(
  customerName: (id: string) => string,
  visibleKeys: string[]
): DataTableColumn<BillDTO>[] {
  return billColumnCatalog(customerName).filter((c) => c.locked || visibleKeys.includes(c.key));
}

function BillsPageContent() {
  const permissions = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { get, getNumber, set } = useUrlState();
  const currentPage = getNumber('page', 1);
  const search = get('search', '');
  const statusFilter = get('status', '');
  const yearFilter = get('year', '');
  const monthFilter = get('month', '');
  const sort = useUrlTableSort({ get, set });

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

  const { visibleKeys, toggle, reset, isDefault } = useColumnVisibility(
    COLUMNS_STORAGE_KEY,
    DEFAULT_BILL_COLUMNS
  );
  const columns = useMemo(
    () => buildBillColumns(customerName, visibleKeys),
    [customerName, visibleKeys]
  );

  const filtered = useMemo(() => {
    const rows = bills.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false;
      if (yearFilter && !b.period.startsWith(`${yearFilter}-`)) return false;
      if (monthFilter && b.period.split('-')[1] !== String(monthFilter).padStart(2, '0')) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !customerName(b.customerId).toLowerCase().includes(q) &&
          !b.period.includes(q) &&
          !b.lineItems.some((l) => l.planName.toLowerCase().includes(q))
        ) return false;
      }
      return true;
    });
    return sortRows(rows, billColumnCatalog(customerName), sort.field, sort.direction);
  }, [bills, statusFilter, yearFilter, monthFilter, search, customerName, sort.field, sort.direction]);

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
  const clearFilters = () =>
    set({ search: null, status: null, year: null, month: null, page: null });

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
        onGenerated={onGenerated}
      />

      <PageHeader
        title="Facturas"
        subtitle={
          bills.length > 0
            ? `${bills.length} ${bills.length === 1 ? 'factura' : 'facturas'} · ${formatCurrency(totals.outstanding)} por cobrar (${totals.outstandingCount})`
            : 'Genera y administra la facturación mensual'
        }
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
      />

      <FilterBar
        hasFilters={hasFilters}
        onClear={clearFilters}
        search={{
          value: search,
          onChange: (value) => set({ search: value || null, page: null }),
          placeholder: 'Cliente, plan o periodo...',
          maxLength: 150,
        }}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={
          <>
            <ColumnPicker
              columns={BILL_COLUMN_OPTIONS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onReset={reset}
              isDefault={isDefault}
            />
            {permissions.canWrite && (
              <>
                <Button variant="outline" onClick={() => setShowBulk(true)}>Generación Masiva</Button>
                <IconButton icon={<PlusIcon />} label="Generar Factura" variant="primary" size="md" onClick={() => setShowSingle(true)} />
              </>
            )}
          </>
        }
        activeFilterCount={[statusFilter, yearFilter, monthFilter].filter(Boolean).length}
      >
        <FilterChip
          label="Estado"
          value={statusFilter}
          onChange={(v) => set({ status: v || null, page: null })}
          options={BILL_STATUS_OPTIONS}
        />
        <FilterChip
          label="Año"
          value={yearFilter}
          onChange={(v) => set({ year: v || null, page: null })}
          options={[{ value: '', label: 'Todos' }, ...YEAR_OPTIONS]}
        />
        <FilterChip
          label="Mes"
          value={monthFilter}
          onChange={(v) => set({ month: v || null, page: null })}
          options={[{ value: '', label: 'Todos' }, ...MONTH_OPTIONS]}
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
          onPageChange: (page) => set({ page: page === 1 ? null : page }),
        }}
      />
    </div>
  );
}

// ── Generate a bill for one contracted service ───────────────
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
  const [serviceId, setServiceId] = useState('');
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const { showError, showSuccess } = useToast();

  // Only ACTIVE services can be billed (BIL-081); the list endpoint has no
  // status filter, so the rest are dropped here.
  const { data: activeServices = [], isFetching: servicesLoading } = useQuery({
    queryKey: ['contractedServices', 'customer', customerId],
    queryFn: async () => {
      const r = await apiService.listContractedServices({ customerId });
      if (!r.success || !r.data) throw new Error(r.error || 'Error al cargar los servicios');
      return r.data.contractedServices.filter((cs) => cs.status === 'ACTIVE');
    },
    enabled: isOpen && !!customerId,
  });

  const selectCustomer = (id: string) => {
    setCustomerId(id);
    setServiceId('');
    setFieldError(null);
  };

  // A customer with one active service needs no second pick.
  const effectiveServiceId = serviceId || (activeServices.length === 1 ? activeServices[0].id : '');

  const reset = () => { setCustomerId(''); setServiceId(''); setDueDate(''); setError(null); setFieldError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = !customerId ? 'Selecciona un cliente' : !effectiveServiceId ? 'Selecciona un servicio activo' : null;
    if (missing) {
      setFieldError(missing);
      showError(missing);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const r = await apiService.generateBill({
      contractedServiceId: effectiveServiceId,
      year: Number(year),
      month: Number(month),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    });
    setIsSubmitting(false);
    if (r.success && r.data) {
      onGenerated();
      reset();
      onClose();
      showSuccess('Factura generada.');
      router.push(`/bills/${r.data.id}`);
    } else {
      const message = r.error || 'Error al generar la factura';
      setError(message);
      showError(message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generar Factura"
      info={
        <>
          Cada servicio contratado <strong>activo</strong> se factura por separado: la factura
          cobra el mes completo a su precio mensual, sin prorratear. Por defecto vence 15 días
          después de la emisión.
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-400">
            {error}
          </div>
        )}
        <Select
          label="Cliente"
          value={customerId}
          onChange={(e) => selectCustomer(e.target.value)}
          options={[{ value: '', label: 'Seleccionar cliente' }, ...customers.map((c) => ({ value: c.id, label: c.fullName }))]}
          error={!customerId ? fieldError ?? undefined : undefined}
          required
          fullWidth
        />
        {customerId && (
          <Select
            label="Servicio"
            value={effectiveServiceId}
            onChange={(e) => { setServiceId(e.target.value); setFieldError(null); }}
            options={
              servicesLoading
                ? [{ value: '', label: 'Cargando servicios...' }]
                : activeServices.length === 0
                  ? [{ value: '', label: 'Sin servicios activos' }]
                  : [
                      ...(activeServices.length > 1 ? [{ value: '', label: 'Seleccionar servicio' }] : []),
                      ...activeServices.map((cs) => ({
                        value: cs.id,
                        label: `${cs.servicePlan.name} · ${formatPaymentDay(cs.paymentDay)}`,
                      })),
                    ]
            }
            disabled={servicesLoading || activeServices.length === 0}
            error={fieldError ?? undefined}
            required
            fullWidth
          />
        )}
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
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" isLoading={isSubmitting}>Generar</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Generate one bill per active service ─────────────────────
function GenerateBulkModal({
  isOpen, onClose, onGenerated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkGenerateResult | null>(null);
  const { showError } = useToast();

  // Skipped and failed entries name a service, not a customer; load the
  // services only when there is one to name.
  const hasUnbilled = !!result && (result.skipped.length > 0 || result.failed.length > 0);
  const { data: services = [] } = useQuery({
    queryKey: ['contractedServices', 'all'],
    queryFn: fetchAllContractedServices,
    enabled: hasUnbilled,
  });
  const serviceLabel = useMemo(() => {
    const map = new Map(services.map((cs) => [cs.id, `${cs.customer.fullName} — ${cs.servicePlan.name}`]));
    return (id: string) => map.get(id) ?? id;
  }, [services]);

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
      const message = r.error || 'Error al generar las facturas';
      setError(message);
      showError(message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Generación Masiva"
      info={
        <>
          Genera una factura para <strong>cada servicio contratado activo</strong>: un cliente con
          dos servicios recibe dos facturas. Los servicios que ya tienen factura del periodo se
          omiten. Esta operación está limitada a 5 ejecuciones por hora.
        </>
      }
      size="lg"
    >
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
                  <li key={s.contractedServiceId}>{serviceLabel(s.contractedServiceId)} — {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
          {result.failed.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">Fallidas</h3>
              <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
                {result.failed.map((f) => (
                  <li key={f.contractedServiceId}>{serviceLabel(f.contractedServiceId)} — {f.error}</li>
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
