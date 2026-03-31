'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { LocationResponseDTO, LocationType } from '@/types/device.types';
import {
  Table,
  TableEmptyState,
  Pagination,
  Button,
  Badge,
  LoadingSpinner,
  Select
} from '@/components/ui';

const LIMIT = 20;

export default function LocationsPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationResponseDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await apiService.listLocations({
      limit: LIMIT,
      offset: (currentPage - 1) * LIMIT,
      type: typeFilter as LocationType || undefined
    });
    if (result.success && result.data) {
      setLocations(result.data.locations);
      setTotal(result.data.total);
      setTotalPages(Math.ceil(result.data.total / LIMIT));
    } else {
      setError(result.error || 'Failed to load locations');
    }
    setIsLoading(false);
  }, [currentPage, typeFilter]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
          <p className="text-gray-600 mt-1">
            {total > 0 ? `${total} location${total !== 1 ? 's' : ''} total` : 'Manage infrastructure sites'}
          </p>
        </div>
        <Button onClick={() => router.push('/locations/create')}>
          Add Location
        </Button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Type"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Types' },
              { value: 'TOWER', label: 'Tower' },
              { value: 'NODE', label: 'Node' },
              { value: 'DATACENTER', label: 'Datacenter' },
              { value: 'POP', label: 'POP' },
              { value: 'WAREHOUSE', label: 'Warehouse' },
              { value: 'OFFICE', label: 'Office' }
            ]}
            fullWidth
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              fullWidth
              onClick={() => { setTypeFilter(''); setCurrentPage(1); }}
              disabled={!typeFilter}
            >
              Clear Filter
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchLocations} className="mt-2">Retry</Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Loading locations..." />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head>Name</Table.Head>
              <Table.Head>Type</Table.Head>
              <Table.Head>Municipality</Table.Head>
              <Table.Head>Address</Table.Head>
              <Table.Head>Coordinates</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Header>
            <Table.Body>
              {locations.length === 0 ? (
                <TableEmptyState message="No locations yet. Add your first location." />
              ) : (
                locations.map((loc) => (
                  <Table.Row key={loc.id} onClick={() => router.push(`/locations/${loc.id}`)}>
                    <Table.Cell>
                      <div className="font-medium text-gray-900">{loc.name}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant="info">{loc.type}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {loc.municipality || <span className="text-gray-400">—</span>}
                    </Table.Cell>
                    <Table.Cell>
                      {loc.address || <span className="text-gray-400">—</span>}
                    </Table.Cell>
                    <Table.Cell>
                      {loc.latitude !== null && loc.longitude !== null
                        ? <span className="font-mono text-xs">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
                        : <span className="text-gray-400">—</span>}
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); router.push(`/locations/${loc.id}`); }}
                      >
                        View
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>

          {locations.length > 0 && (
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
