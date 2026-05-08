'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { DeviceModelResponseDTO } from '@/types/device.types';
import { Button, Badge, LoadingSpinner } from '@/components/ui';
import { ConfirmModal } from '@/components/ui/Modal';
import { DeviceModelDetailsTab } from '@/components/device-models/DeviceModelDetailsTab';

export default function DeviceModelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const modelId = params.id as string;

  const [model, setModel] = useState<DeviceModelResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await apiService.deleteDeviceModel(modelId);
    setIsDeleting(false);
    if (result.success) {
      router.push('/device-models');
    } else {
      setShowDeleteModal(false);
      setError(result.error || 'Error al eliminar el modelo');
    }
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

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>← Atrás</Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {model.vendorName} — {model.model}
            </h1>
            <Badge variant="info">{model.deviceType}</Badge>
          </div>
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
          Eliminar
        </Button>
      </div>

      <DeviceModelDetailsTab
        model={model}
        onModelUpdated={(updated) => setModel(updated)}
      />
    </div>
  );
}
