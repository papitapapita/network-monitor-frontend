'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import { DeviceModelResponseDTO } from '@/types/device.types';
import { Button, Badge, LoadingSpinner, BackLink } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/toast.context';
import { DeviceModelDetailsTab } from '@/components/device-models/DeviceModelDetailsTab';

export default function DeviceModelDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const modelId = params.id as string;

  const [model, setModel] = useState<DeviceModelResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showError } = useToast();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [purgeConfirmMessage, setPurgeConfirmMessage] = useState<string | null>(null);

  const fetchModel = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.getDeviceModel(modelId);
    if (result.success && result.data) {
      setModel(result.data);
    } else {
      setError(result.error || 'Error al cargar el modelo');
    }
    setIsLoading(false);
  }, [modelId]);

  useEffect(() => {
    fetchModel();
  }, [fetchModel]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Cargando modelo..." />
      </div>
    );
  }

  if (error && !model) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">{error}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>Volver</Button>
            <Button onClick={fetchModel}>Reintentar</Button>
          </div>
        </div>
      </div>
    );
  }

  const finishDelete = (result: { success: boolean; error?: string }) => {
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['deviceModels'] });
      router.push('/device-models');
    } else {
      const message = result.error || 'Error al eliminar el modelo';
      setError(message);
      showError(message);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await apiService.deleteDeviceModel(modelId);
    setIsDeleting(false);
    setShowDeleteModal(false);

    // DEV-030: the only thing in the way is devices already in the recycle
    // bin — offer the purge-and-delete confirmation instead of dead-ending.
    if (!result.success && result.binnedDeviceCount) {
      setPurgeConfirmMessage(result.error || null);
      return;
    }
    finishDelete(result);
  };

  const handlePurgeAndDelete = async () => {
    setIsDeleting(true);
    const result = await apiService.deleteDeviceModel(modelId, true);
    setIsDeleting(false);
    setPurgeConfirmMessage(null);
    finishDelete(result);
  };

  if (!model) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar modelo"
        message={`¿Estás seguro de que deseas eliminar "${model.vendorName} — ${model.model}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={purgeConfirmMessage !== null}
        onClose={() => setPurgeConfirmMessage(null)}
        onConfirm={handlePurgeAndDelete}
        title="Vaciar la papelera y eliminar"
        message={purgeConfirmMessage ?? ''}
        confirmText="Eliminar de todas formas"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeleting}
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="mb-6">
        <BackLink label="Modelos" onClick={() => router.back()} className="mb-2" />
        <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-col sm:justify-start">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 wrap-anywhere mb-2">
              {model.vendorName} — {model.model}
            </h1>
            <Badge variant="info">{model.deviceType}</Badge>
          </div>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            Eliminar
          </Button>
        </div>
      </div>

      <DeviceModelDetailsTab
        model={model}
        onModelUpdated={(updated) => setModel(updated)}
      />
    </div>
  );
}
