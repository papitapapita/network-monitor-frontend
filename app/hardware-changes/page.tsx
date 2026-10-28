'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { Card, LoadingSpinner, PageHeader } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { usePermissions } from '@/hooks/usePermissions';
import { HARDWARE_CHANGES_QUERY_KEY, useHardwareChanges } from '@/hooks/useHardwareChanges';
import {
  HardwareChangeCard,
  type HardwarePatch,
  type ReplacePrefill,
} from '@/components/wireless/HardwareChangeCard';
import { ReplaceDeviceModal } from '@/components/devices/ReplaceDeviceModal';
import { SwapHardwareModal } from '@/components/devices/SwapHardwareModal';
import type { DeviceResponseDTO } from '@/types/device.types';

/** The device an action opened its modal for, read fresh — the list carries only its name. */
type Pending =
  | { kind: 'REPLACE'; device: DeviceResponseDTO; prefill: ReplacePrefill }
  | { kind: 'SWAP'; device: DeviceResponseDTO; otherId: string };

/**
 * Every polled radio whose last poll reports another MAC or model than the
 * one on file (`GET /wireless/hardware-changes`, WLS-154): one card per
 * device, with the same single action its own wireless tab offers. A swap
 * lists both devices, each pointing at the other, and fixing either fixes
 * both — so every action re-reads the list.
 */
export default function HardwareChangesPage() {
  const { canWrite } = usePermissions();
  const { showError, showSuccess } = useToast();
  const queryClient = useQueryClient();
  const { data: devices, isLoading, isFetching, error, refetch, dataUpdatedAt } = useHardwareChanges();
  const [pending, setPending] = useState<Pending | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: HARDWARE_CHANGES_QUERY_KEY });

  const loadDevice = async (deviceId: string) => {
    const r = await apiService.getDevice(deviceId);
    if (r.success && r.data) return r.data;
    showError(r.error || 'No se pudo cargar el dispositivo');
    return null;
  };

  const handleReplace = async (deviceId: string, prefill: ReplacePrefill) => {
    const device = await loadDevice(deviceId);
    if (device) setPending({ kind: 'REPLACE', device, prefill });
  };

  const handleSwap = async (deviceId: string, otherId: string) => {
    const device = await loadDevice(deviceId);
    if (device) setPending({ kind: 'SWAP', device, otherId });
  };

  const handleUpdate = async (deviceId: string, patch: HardwarePatch) => {
    const r = await apiService.updateDevice(deviceId, patch);
    if (r.success) {
      showSuccess('Registro corregido.');
      refresh();
    } else {
      showError(r.error || 'No se pudo corregir el registro');
    }
  };

  const count = devices?.length ?? 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {pending?.kind === 'REPLACE' && (
        <ReplaceDeviceModal
          key={pending.device.id}
          isOpen
          onClose={() => setPending(null)}
          device={pending.device}
          prefill={pending.prefill}
          onReplaced={(result) => {
            setPending(null);
            showSuccess(`Reemplazo registrado: «${result.newDevice.name}» sustituye a la unidad anterior.`);
            refresh();
          }}
        />
      )}
      {pending?.kind === 'SWAP' && (
        <SwapHardwareModal
          key={pending.device.id}
          isOpen
          onClose={() => setPending(null)}
          device={pending.device}
          initialOtherId={pending.otherId}
          onSwapped={() => {
            setPending(null);
            refresh();
          }}
        />
      )}

      <PageHeader
        title="Cambios de equipo"
        subtitle={
          devices
            ? count === 0
              ? 'Todas las radios coinciden con el inventario'
              : `${count} ${count === 1 ? 'radio reporta' : 'radios reportan'} hardware distinto al registrado`
            : undefined
        }
        info="Radios cuyo último sondeo reporta una MAC o un modelo distintos a los registrados: casi siempre, una unidad que se cambió en sitio sin registrarlo. Registrar el reemplazo deja el historial con la unidad que lo produjo."
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        lastRefreshed={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="Cargando cambios de equipo..." />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
      ) : count === 0 ? (
        <Card>
          <Card.Body>
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Ninguna radio reporta una MAC o un modelo distintos a los registrados.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <div className="space-y-6">
          {devices!.map((d) => (
            <HardwareChangeCard
              key={d.deviceId}
              suggestions={d.suggestions}
              heading={
                <Link
                  href={`/devices/${d.deviceId}?tab=wireless`}
                  className="hover:underline wrap-anywhere"
                >
                  {d.name}
                </Link>
              }
              meta={`Sondeo del ${new Date(d.collectedAt).toLocaleString('es')}`}
              canWrite={canWrite}
              onReplace={(prefill) => handleReplace(d.deviceId, prefill)}
              onSwap={(otherId) => handleSwap(d.deviceId, otherId)}
              onUpdate={(patch) => handleUpdate(d.deviceId, patch)}
              onModelCreated={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
