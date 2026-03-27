/**
 * Network Devices List Page
 *
 * Main page for viewing all network devices with pagination and filtering
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/api.service';
import { useDeviceUpdates } from '@/hooks/useDeviceUpdates';
import {
  NetworkDeviceResponseDTO,
  ListNetworkDevicesQuery
} from '@/types/device.types';
import {
  Table,
  TableEmptyState,
  Pagination,
  Button,
  Badge,
  LoadingSpinner,
  Select,
  getStatusBadgeVariant,
  getActivationStatusBadgeVariant
} from '@/components/ui';

export default function DevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<NetworkDeviceResponseDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);
  const [limit] = useState(20);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>('');
  const [activationStatusFilter, setActivationStatusFilter] = useState<string>('');

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const query: ListNetworkDevicesQuery = {
      limit,
      offset: (currentPage - 1) * limit
    };

    if (statusFilter) query.status = statusFilter;
    if (deviceTypeFilter) query.deviceType = deviceTypeFilter;
    if (activationStatusFilter) query.activationStatus = activationStatusFilter;

    const result = await apiService.listDevices(query);

    if (result.success && result.data) {
      setDevices(result.data.devices);
      setTotalDevices(result.data.total);
      setTotalPages(Math.ceil(result.data.total / limit));
    } else {
      setError(result.error || 'Failed to load devices');
    }

    setIsLoading(false);
  }, [currentPage, limit, statusFilter, deviceTypeFilter, activationStatusFilter]);

  // Initial load and refetch when filters change
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Real-time updates via WebSocket
  useDeviceUpdates({
    onStatusChanged: (payload) => {
      setDevices((prev) =>
        prev.map((device) =>
          device.id === payload.deviceId
            ? { ...device, status: payload.newStatus }
            : device
        )
      );
    },
    onDeviceCreated: () => {
      fetchDevices();
    },
    onDeviceUpdated: (payload) => {
      fetchDevices();
    },
    onDeviceDeleted: (payload) => {
      setDevices((prev) => prev.filter((d) => d.id !== payload.deviceId));
    },
    onDeviceActivated: (payload) => {
      fetchDevices();
    },
    onDeviceRestored: () => {
      fetchDevices();
    }
  });

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle filter changes
  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // Reset to first page
  };

  const handleDeviceTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDeviceTypeFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleActivationStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActivationStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setDeviceTypeFilter('');
    setActivationStatusFilter('');
    setCurrentPage(1);
  };

  const hasFilters = statusFilter || deviceTypeFilter || activationStatusFilter;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Network Devices</h1>
          <p className="text-gray-600 mt-1">
            Manage and monitor your network infrastructure
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/devices/import')}
          >
            Import CSV
          </Button>
          <Button onClick={() => router.push('/devices/create')}>
            Add Device
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Status"
            value={statusFilter}
            onChange={handleStatusFilterChange}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'ONLINE', label: 'Online' },
              { value: 'OFFLINE', label: 'Offline' },
              { value: 'MAINTENANCE', label: 'Maintenance' },
              { value: 'UNKNOWN', label: 'Unknown' }
            ]}
            fullWidth
          />

          <Select
            label="Device Type"
            value={deviceTypeFilter}
            onChange={handleDeviceTypeFilterChange}
            options={[
              { value: '', label: 'All Types' },
              { value: 'ROUTER', label: 'Router' },
              { value: 'SWITCH', label: 'Switch' },
              { value: 'ACCESS_POINT', label: 'Access Point' },
              { value: 'FIREWALL', label: 'Firewall' },
              { value: 'LOAD_BALANCER', label: 'Load Balancer' }
            ]}
            fullWidth
          />

          <Select
            label="Activation Status"
            value={activationStatusFilter}
            onChange={handleActivationStatusFilterChange}
            options={[
              { value: '', label: 'All' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'DRAFT', label: 'Draft' }
            ]}
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

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDevices} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" message="Loading devices..." />
        </div>
      )}

      {/* Devices Table */}
      {!isLoading && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <Table>
            <Table.Header>
              <Table.Head>Name</Table.Head>
              <Table.Head>IP Address</Table.Head>
              <Table.Head>Device Type</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Activation</Table.Head>
              <Table.Head>Location</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Header>
            <Table.Body>
              {devices.length === 0 ? (
                <TableEmptyState
                  message={
                    hasFilters
                      ? 'No devices found matching your filters'
                      : 'No devices found. Create your first device to get started.'
                  }
                />
              ) : (
                devices.map((device) => (
                  <Table.Row
                    key={device.id}
                    onClick={() => router.push(`/devices/${device.id}`)}
                  >
                    <Table.Cell>
                      <div className="font-medium text-gray-900">
                        {device.name || 'Unnamed Device'}
                      </div>
                      <div className="text-sm text-gray-500">{device.deviceId}</div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="font-mono text-sm">{device.ipAddress}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {device.macAddress}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {device.deviceType.replace(/_/g, ' ')}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={getStatusBadgeVariant(device.status)}>
                        {device.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        variant={getActivationStatusBadgeVariant(
                          device.activationStatus
                        )}
                      >
                        {device.activationStatus}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {device.location || <span className="text-gray-400">—</span>}
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

          {/* Pagination */}
          {devices.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalDevices}
              itemsPerPage={limit}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}
    </div>
  );
}
