'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { fetchAllDevices } from '@/hooks/useCatalogs';
import { DeviceResponseDTO } from '@/types/device.types';
import { Modal, Input, Button, Badge, LoadingSpinner, getDeviceStatusBadgeVariant } from '@/components/ui';
import { DEVICE_STATUS_LABELS } from '@/constants/device.constants';

interface AssignDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
  onAssigned: (device: DeviceResponseDTO) => void;
}

export function AssignDeviceModal({ isOpen, onClose, locationId, onAssigned }: AssignDeviceModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: allDevices = [], isLoading } = useQuery({
    queryKey: ['devicesCatalog'],
    queryFn: fetchAllDevices,
    enabled: isOpen,
  });

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allDevices
      .filter((d) => d.locationId !== locationId)
      .filter((d) => !q || d.name.toLowerCase().includes(q));
  }, [allDevices, locationId, search]);

  const handleClose = () => {
    setSearch('');
    setError(null);
    onClose();
  };

  const handleAssign = async (device: DeviceResponseDTO) => {
    setAssigningId(device.id);
    setError(null);
    const result = await apiService.updateDevice(device.id, { locationId });
    if (result.success && result.data) {
      onAssigned(result.data);
      queryClient.invalidateQueries({ queryKey: ['devicesCatalog'] });
    } else {
      setError(result.error || 'Error al asignar el dispositivo');
    }
    setAssigningId(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Agregar Dispositivo" size="lg" transparentBackdrop>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar dispositivo por nombre..."
        autoFocus
        fullWidth
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-3">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="mt-3 max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner message="Cargando dispositivos..." />
          </div>
        ) : results.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            {search ? 'Ningún dispositivo coincide con la búsqueda' : 'No hay más dispositivos disponibles'}
          </p>
        ) : (
          results.map((device) => (
            <div key={device.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{device.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
                    {DEVICE_STATUS_LABELS[device.status] ?? device.status}
                  </Badge>
                  {device.ipAddress && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{device.ipAddress}</span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleAssign(device)}
                isLoading={assigningId === device.id}
                disabled={assigningId !== null && assigningId !== device.id}
              >
                Agregar
              </Button>
            </div>
          ))
        )}
      </div>

      <Modal.Footer>
        <Button variant="outline" onClick={handleClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
