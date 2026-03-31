'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { DeviceModelResponseDTO } from '@/types/device.types';
import { Table, TableEmptyState, Pagination, Button, LoadingSpinner, Badge } from '@/components/ui';

const LIMIT = 20;

export default function DeviceModelsPage() {
  const router = useRouter();
  const [models, setModels] = useState<DeviceModelResponseDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.listDeviceModels({
      limit: LIMIT,
      offset: (currentPage - 1) * LIMIT
    });
    if (result.success && result.data) {
      setModels(result.data.deviceModels);
      setTotal(result.data.total);
      setTotalPages(Math.ceil(result.data.total / LIMIT));
    } else {
      setError(result.error || 'Failed to load device models');
    }
    setIsLoading(false);
  }, [currentPage]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Device Models</h1>
        <p className="text-gray-600 mt-1">
          {total > 0 ? `${total} model${total !== 1 ? 's' : ''} in catalog` : 'Hardware catalog'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchModels} className="mt-2">Retry</Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Loading models..." />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head>Manufacturer</Table.Head>
              <Table.Head>Model</Table.Head>
              <Table.Head>Device Type</Table.Head>
              <Table.Head>Created</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Header>
            <Table.Body>
              {models.length === 0 ? (
                <TableEmptyState message="No device models found." />
              ) : (
                models.map((m) => (
                  <Table.Row key={m.id} onClick={() => router.push(`/device-models/${m.id}`)}>
                    <Table.Cell>
                      <span className="font-medium text-gray-900">
                        {m.manufacturer.replace(/_/g, ' ')}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{m.model}</Table.Cell>
                    <Table.Cell>
                      <Badge variant="neutral">{m.deviceType}</Badge>
                    </Table.Cell>
                    <Table.Cell className="text-gray-500 text-sm">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); router.push(`/device-models/${m.id}`); }}
                      >
                        View
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>

          {models.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={LIMIT}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
