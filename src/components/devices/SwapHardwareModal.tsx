'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { fetchAllDeviceModels, fetchAllDevices } from '@/hooks/useCatalogs';
import { DeviceResponseDTO, SwapHardwareResultDTO } from '@/types/device.types';
import { Modal, Button, Combobox } from '@/components/ui';
import { useToast } from '@/contexts/toast.context';
import { deviceCategoryLabel, isWirelessCategory } from '@/constants/device.constants';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** The record whose page this is — one of the two sides. */
  device: DeviceResponseDTO;
  onSwapped: (result: SwapHardwareResultDTO) => void;
}

/** What travels between the two records; everything else stays with its site. */
type Hardware = Pick<DeviceResponseDTO, 'deviceModelId' | 'serialNumber' | 'macAddress'>;

const sameHardware = (a: Hardware, b: Hardware) =>
  a.deviceModelId === b.deviceModelId &&
  (a.serialNumber ?? '') === (b.serialNumber ?? '') &&
  (a.macAddress ?? '').toLowerCase() === (b.macAddress ?? '').toLowerCase();

/** One hardware field: struck-through before, bold after — or plain when unchanged. */
function Row({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="min-w-0 wrap-anywhere">
        {before === after ? (
          <span className="text-gray-700 dark:text-gray-300">{after}</span>
        ) : (
          <>
            <span className="text-gray-400 dark:text-gray-500 line-through">{before}</span>{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">→ {after}</span>
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * Two units already in the system physically traded places — a large antenna
 * moved to a quieter site and a smaller one moved in. Unlike «Reemplazar
 * equipo», nothing is created or retired: each record keeps its IP, location,
 * customers and history, and only model, serial and MAC change hands.
 */
export function SwapHardwareModal({ isOpen, onClose, device, onSwapped }: Props) {
  const [otherId, setOtherId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError, showSuccess } = useToast();

  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ['devicesCatalog'],
    queryFn: fetchAllDevices,
    enabled: isOpen,
  });
  const { data: models = [] } = useQuery({
    queryKey: ['deviceModels'],
    queryFn: fetchAllDeviceModels,
    enabled: isOpen,
  });

  const modelById = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  const modelLabel = (id: string) => {
    const m = modelById.get(id);
    return m ? `${m.vendorName} ${m.model}` : '—';
  };

  // A retired unit that was already replaced cannot swap (the backend refuses
  // it), so it is not offered. Same category first: an AP normally trades
  // places with another AP.
  const options = useMemo(
    () =>
      devices
        .filter((d) => d.id !== device.id && !d.replacedByDeviceId)
        .sort(
          (a, b) =>
            Number(b.category === device.category) - Number(a.category === device.category) ||
            a.name.localeCompare(b.name)
        )
        .map((d) => ({
          value: d.id,
          label: d.ipAddress ? `${d.name} — ${d.ipAddress}` : d.name,
          sublabel: `${deviceCategoryLabel(d.category)} · ${modelLabel(d.deviceModelId)}`,
        })),
    // modelLabel reads modelById
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, device.id, device.category, modelById]
  );

  const other = devices.find((d) => d.id === otherId) ?? null;
  const identical = other ? sameHardware(device, other) : false;

  // Heads-ups the backend would otherwise answer with a 400 or silently accept.
  const warnings: string[] = [];
  if (other) {
    if (other.category !== device.category) {
      warnings.push(
        `Las categorías son distintas (${deviceCategoryLabel(device.category)} y ${deviceCategoryLabel(other.category)}). Confirma que estos dos equipos realmente cambiaron de lugar.`
      );
    }
    for (const [receiver, giver] of [
      [device, other],
      [other, device],
    ] as const) {
      const incoming = modelById.get(giver.deviceModelId);
      if (isWirelessCategory(receiver.category) && incoming && !incoming.isWireless) {
        warnings.push(
          `«${receiver.name}» recibiría «${incoming.model}», que no tiene radio. Si tiene configuración inalámbrica, el intercambio será rechazado.`
        );
      }
    }
  }

  const handleClose = () => {
    if (isSaving) return;
    setOtherId('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!other || identical) return;
    setIsSaving(true);
    setError(null);
    const result = await apiService.swapDeviceHardware(device.id, other.id);
    setIsSaving(false);
    if (result.success && result.data) {
      showSuccess('Hardware intercambiado');
      setOtherId('');
      onSwapped(result.data);
    } else {
      const message = result.error || 'Error al intercambiar el hardware';
      setError(message);
      showError(message);
    }
  };

  const renderSide = (record: DeviceResponseDTO, from: DeviceResponseDTO) => (
    <div key={record.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <p className="font-medium text-gray-900 dark:text-gray-100 wrap-anywhere">{record.name}</p>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        {record.ipAddress ?? 'Sin IP'} · conserva IP, ubicación e historial
      </p>
      <dl className="space-y-1">
        <Row label="Modelo" before={modelLabel(record.deviceModelId)} after={modelLabel(from.deviceModelId)} />
        <Row label="Serial" before={record.serialNumber ?? '—'} after={from.serialNumber ?? '—'} />
        <Row label="MAC" before={record.macAddress ?? '—'} after={from.macAddress ?? '—'} />
      </dl>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Intercambiar hardware" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Para dos equipos ya registrados que cambiaron de lugar físicamente. Cada sitio conserva su
          registro, IP, clientes, credenciales, configuración inalámbrica e historial; solo se
          intercambian modelo, número de serie y MAC. Si llega una unidad nueva, usa «Reemplazar
          equipo».
        </p>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Combobox
          label="Intercambiar con"
          options={options}
          value={otherId}
          onChange={(v) => {
            setOtherId(v);
            setError(null);
          }}
          placeholder={devicesLoading ? 'Cargando dispositivos...' : 'Buscar dispositivo...'}
          required
          fullWidth
        />

        {other && (
          <>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Después del intercambio
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {renderSide(device, other)}
                {renderSide(other, device)}
              </div>
            </div>

            {identical && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Los dos tienen el mismo modelo, serial y MAC: no hay nada que intercambiar.
              </p>
            )}
            {warnings.map((w) => (
              <p key={w} className="text-sm text-yellow-800 dark:text-yellow-400">
                {w}
              </p>
            ))}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              El historial queda con el sitio: las lecturas anteriores seguirán en el mismo registro,
              aunque describan el otro equipo.
            </p>
          </>
        )}
      </div>

      <Modal.Footer>
        <Button variant="outline" onClick={handleClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} isLoading={isSaving} disabled={!other || identical}>
          Intercambiar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
