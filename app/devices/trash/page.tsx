'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { useAuth } from '@/contexts/auth.context';
import { DeviceResponseDTO } from '@/types/device.types';
import {
  Badge,
  Button,
  DataTable,
  ErrorBanner,
  PageHeader,
  getDeviceStatusBadgeVariant,
} from '@/components/ui';
import type { DataTableColumn } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import {
  DEVICE_STATUS_LABELS,
  RESTORE_GRACE_DAYS,
  RESTORE_SUCCESS_MESSAGE,
} from '@/constants/device.constants';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const GRACE_MS = RESTORE_GRACE_DAYS * 24 * 60 * 60 * 1000;

function ArrowLeftIcon() {
  return (
    <svg
      className="mr-1.5 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

/**
 * How much of the grace period is left. Once it lapses the row is gone or about
 * to be — the nightly job takes it — and restore starts answering 400, so the
 * button comes off rather than failing on click.
 */
function graceRemaining(deletedAt: string | null): { expired: boolean; label: string } {
  if (!deletedAt) return { expired: false, label: '—' };
  const msLeft = new Date(deletedAt).getTime() + GRACE_MS - Date.now();
  if (msLeft <= 0) return { expired: true, label: 'Plazo vencido' };

  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  if (days >= 1) return { expired: false, label: `${days} ${days === 1 ? 'día' : 'días'}` };

  const hours = Math.max(1, Math.floor(msLeft / (60 * 60 * 1000)));
  return { expired: false, label: `${hours} ${hours === 1 ? 'hora' : 'horas'}` };
}

/**
 * The recycle bin: devices inside their 7-day grace period, newest deletion
 * first. Seeing it needs only `read`, but both actions on it are ADMIN — undoing
 * a delete and finishing one early are both the delete authority.
 */
export default function DeviceTrashPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<DeviceResponseDTO | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  const { data, isLoading, isFetching, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['deletedDevices', currentPage, limit],
    queryFn: async () => {
      const result = await apiService.listDevices({
        deleted: 'true',
        sortBy: 'deletedAt',
        sortOrder: 'DESC',
        limit,
        offset: (currentPage - 1) * limit,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Error al cargar la papelera');
      }
      return result.data;
    },
  });

  const devices = data?.devices ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleRestore = async (device: DeviceResponseDTO) => {
    setRestoringId(device.id);
    setActionError(null);
    const result = await apiService.restoreDevice(device.id);
    setRestoringId(null);
    if (result.success) {
      setNotice(`«${device.name}» se restauró. ${RESTORE_SUCCESS_MESSAGE}`);
      refetch();
    } else {
      setActionError(result.error || 'Error al restaurar el dispositivo');
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    setIsPurging(true);
    setActionError(null);
    const result = await apiService.purgeDevice(purgeTarget.id);
    setIsPurging(false);
    if (result.success) {
      setNotice(`«${purgeTarget.name}» se eliminó de forma permanente.`);
      setPurgeTarget(null);
      refetch();
    } else {
      setActionError(result.error || 'Error al eliminar el dispositivo de forma permanente');
      setPurgeTarget(null);
    }
  };

  const columns: DataTableColumn<DeviceResponseDTO>[] = [
    {
      key: 'name',
      header: 'Nombre',
      cell: (device) => (
        <>
          <div className="font-medium text-gray-900 dark:text-gray-100">{device.name}</div>
          {device.serialNumber && (
            <div className="text-xs text-gray-500 dark:text-gray-400">{device.serialNumber}</div>
          )}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      cell: (device) => (
        <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
          {DEVICE_STATUS_LABELS[device.status] ?? device.status}
        </Badge>
      ),
    },
    // Deliberately no category or model column: the two actions are the point of
    // this table, and every column pushed them off the right edge behind a
    // sideways scroll. Name plus serial is what an operator recognises a box by,
    // and the rest is one click away once it is restored.
    {
      key: 'deletedAt',
      header: 'Eliminado',
      cell: (device) => (
        <span className="text-gray-900 dark:text-gray-100">
          {device.deletedAt ? new Date(device.deletedAt).toLocaleString('es') : '—'}
        </span>
      ),
    },
    {
      key: 'grace',
      header: 'Restaurable por',
      cell: (device) => {
        const { expired, label } = graceRemaining(device.deletedAt);
        return (
          <span
            className={
              expired
                ? 'text-red-600 dark:text-red-400 text-sm'
                : 'text-gray-900 dark:text-gray-100 text-sm'
            }
          >
            {label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* The bin is a detour off the device list, so the way back out sits where
          a back control is looked for: top left, ahead of the title. */}
      <div className="mb-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/devices')}>
          <ArrowLeftIcon />
          Volver a dispositivos
        </Button>
      </div>

      <PageHeader
        title="Papelera de dispositivos"
        subtitle={
          total > 0
            ? `${total} ${total === 1 ? 'dispositivo eliminado' : 'dispositivos eliminados'}`
            : 'Los dispositivos eliminados se guardan aquí antes de borrarse'
        }
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
      />

      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Un dispositivo eliminado se conserva {RESTORE_GRACE_DAYS} días con todo su historial de
        mediciones, alertas y credenciales. Pasado ese plazo se borra de forma permanente, y su
        historial se va con él. Su dirección IP y su MAC, en cambio, se liberaron al eliminarlo.
      </p>

      <ConfirmModal
        isOpen={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        onConfirm={handlePurge}
        title="Eliminar de forma permanente"
        message={`¿Eliminar "${purgeTarget?.name}" de forma permanente? Se borrarán también todas sus mediciones, alertas, capturas inalámbricas y credenciales. Esta acción no se puede deshacer.`}
        confirmText="Eliminar permanentemente"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isPurging}
      />

      {notice && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-green-800 dark:text-green-400">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-green-500 hover:text-green-700 dark:hover:text-green-300 shrink-0"
            >
              <span className="sr-only">Descartar</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} />}

      {error && (
        <ErrorBanner message={(error as Error).message} onRetry={() => refetch()} />
      )}

      <DataTable
        columns={columns}
        rows={devices}
        getRowId={(d) => d.id}
        getRowLabel={(d) => d.name}
        isLoading={isLoading && devices.length === 0}
        loadingMessage="Cargando papelera..."
        emptyMessage="La papelera está vacía."
        rowActions={
          canManage
            ? (device) => {
                const { expired } = graceRemaining(device.deletedAt);
                return (
                  <div className="flex justify-end gap-2">
                    {/* Past the grace period the row is on its way out and
                        restore answers 400, so it stops being offered. */}
                    {!expired && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(device)}
                        isLoading={restoringId === device.id}
                        disabled={restoringId !== null && restoringId !== device.id}
                      >
                        Restaurar
                      </Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => setPurgeTarget(device)}>
                      Eliminar
                    </Button>
                  </div>
                );
              }
            : undefined
        }
        bulkDelete={
          canManage
            ? {
                deleteOne: (id) => apiService.purgeDevice(id),
                onFinished: () => { refetch(); },
                entity: { singular: 'dispositivo', plural: 'dispositivos', gender: 'm' },
                confirmNote:
                  'Se borrarán también todas sus mediciones, alertas, capturas inalámbricas y credenciales. Esta acción no se puede deshacer.',
              }
            : undefined
        }
        selectionResetKey={currentPage}
        pagination={{
          currentPage,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          onPageChange: setCurrentPage,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onPageSizeChange: (n) => { setLimit(n); setCurrentPage(1); },
        }}
      />
    </div>
  );
}
