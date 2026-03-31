'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { DeviceResponseDTO, ListDevicesQuery, DeviceStatus, DeviceCategory } from '@/types/device.types';
import {
  Table,
  TableEmptyState,
  Pagination,
  Button,
  Badge,
  LoadingSpinner,
  Select,
  Input,
  getDeviceStatusBadgeVariant
} from '@/components/ui';

const LIMIT = 20;

export default function DevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<DeviceResponseDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const query: ListDevicesQuery = {
      limit: LIMIT,
      offset: (currentPage - 1) * LIMIT
    };

    if (statusFilter) query.status = statusFilter as DeviceStatus;
    if (categoryFilter) query.category = categoryFilter as DeviceCategory;
    if (search) query.search = search;

    const result = await apiService.listDevices(query);

    if (result.success && result.data) {
      setDevices(result.data.devices);
      setTotalDevices(result.data.total);
      setTotalPages(Math.ceil(result.data.total / LIMIT));
    } else {
      setError(result.error || 'Failed to load devices');
    }

    setIsLoading(false);
  }, [currentPage, statusFilter, categoryFilter, search]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setSearch('');
    setCurrentPage(1);
  };

  const hasFilters = statusFilter || categoryFilter || search;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-600 mt-1">
            {totalDevices > 0 ? `${totalDevices} device${totalDevices !== 1 ? 's' : ''} total` : 'Manage your network devices'}
          </p>
        </div>
        <Button onClick={() => router.push('/devices/create')}>
          Add Device
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'INVENTORY', label: 'Inventory' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'MAINTENANCE', label: 'Maintenance' },
              { value: 'DAMAGED', label: 'Damaged' },
              { value: 'DECOMMISSIONED', label: 'Decommissioned' }
            ]}
            fullWidth
          />
          <Select
            label="Category"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All Categories' },
              { value: 'CORE', label: 'Core' },
              { value: 'DISTRIBUTION', label: 'Distribution' },
              { value: 'POE', label: 'PoE' },
              { value: 'ACCESS_POINT', label: 'Access Point' },
              { value: 'CLIENT_CPE', label: 'Client CPE' }
            ]}
            fullWidth
          />
          <Input
            label="Search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Name, IP, MAC, serial..."
            fullWidth
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              fullWidth
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDevices} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Loading devices..." />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head>Name</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Category</Table.Head>
              <Table.Head>Owner</Table.Head>
              <Table.Head>IP Address</Table.Head>
              <Table.Head>Monitoring</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Header>
            <Table.Body>
              {devices.length === 0 ? (
                <TableEmptyState
                  message={
                    hasFilters
                      ? 'No devices match your filters'
                      : 'No devices yet. Add your first device to get started.'
                  }
                />
              ) : (
                devices.map((device) => (
                  <Table.Row
                    key={device.id}
                    onClick={() => router.push(`/devices/${device.id}`)}
                  >
                    <Table.Cell>
                      <div className="font-medium text-gray-900">{device.name}</div>
                      {device.serialNumber && (
                        <div className="text-xs text-gray-500">{device.serialNumber}</div>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={getDeviceStatusBadgeVariant(device.status)}>
                        {device.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {device.category
                        ? device.category.replace(/_/g, ' ')
                        : <span className="text-gray-400">—</span>}
                    </Table.Cell>
                    <Table.Cell>{device.ownerType}</Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-sm">
                        {device.ipAddress || <span className="text-gray-400">—</span>}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={device.monitoringEnabled ? 'success' : 'neutral'}>
                        {device.monitoringEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/devices/${device.id}`);
                        }}
                      >
                        View
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>

          {devices.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalDevices}
              itemsPerPage={LIMIT}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </div>
  );
}
