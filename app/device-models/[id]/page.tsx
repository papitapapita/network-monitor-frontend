'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { DeviceModelResponseDTO } from '@/types/device.types';
import { Card, Button, LoadingSpinner, Badge } from '@/components/ui';

export default function DeviceModelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const modelId = params.id as string;

  const [model, setModel] = useState<DeviceModelResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModel = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.getDeviceModel(modelId);
    if (result.success && result.data) {
      setModel(result.data);
    } else {
      setError(result.error || 'Failed to load device model');
    }
    setIsLoading(false);
  }, [modelId]);

  useEffect(() => {
    fetchModel();
  }, [fetchModel]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" message="Loading model..." />
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Model not found'}</p>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
            <Button onClick={fetchModel}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            {model.manufacturer.replace(/_/g, ' ')} {model.model}
          </h1>
        </div>
        <Badge variant="neutral">{model.deviceType}</Badge>
      </div>

      <Card>
        <Card.Header><h2 className="text-lg font-semibold">Model Information</h2></Card.Header>
        <Card.Body>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-gray-500">Manufacturer</dt>
              <dd className="mt-1 text-gray-900">{model.manufacturer.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Model</dt>
              <dd className="mt-1 text-gray-900">{model.model}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Device Type</dt>
              <dd className="mt-1">
                <Badge variant="neutral">{model.deviceType}</Badge>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">ID</dt>
              <dd className="mt-1 font-mono text-xs text-gray-900">{model.id}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-gray-900">{new Date(model.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-500">Last Updated</dt>
              <dd className="mt-1 text-gray-900">{new Date(model.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </Card.Body>
      </Card>
    </div>
  );
}
