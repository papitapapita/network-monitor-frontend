'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiService } from '@/services/api.service';
import {
  DeviceResponseDTO,
  ListDevicesQuery,
  DeviceStatus,
  DeviceCategory,
  PollingStatus,
} from '@/types/device.types';
import {
  Table,
  TableEmptyState,
  Pagination,
  Button,
  Badge,
  LoadingSpinner,
  Select,
  Input,
  getDeviceStatusBadgeVariant,
  getPollingStatusBadgeVariant,
} from '@/components/ui';

const LIMIT = 20;

export default function DevicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [devices, setDevices] = useState<DeviceResponseDTO[]>([]);
  const [pollingStatuses, setPollingStatuses] = useState<Record<string, PollingStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [connectivityFilter, setConnectivityFilter] = useState(
    () => searchParams.get('connectivity') ?? ''
  );
  const [search, setSearch] = useState('');

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (connectivityFilter) {
      // Fetch all monitoring-enabled devices, get their polling statuses, filter client-side
      const allResult = await apiService.listDevices({ monitoringEnabled: true, limit: 500 });
      if (!allResult.success || !allResult.data) {
        setError(allResult.error || 'Failed to load devices');
        setIsLoading(false);
        return;
      }

      const allDevices = allResult.data.devices;
      const statusResults = await Promise.all(
        allDevices.map((d) => apiService.getPollingStatus(d.id))
      );

      const statusMap: Record<string, PollingStatus> = {};
      allDevices.forEach((d, i) => {
        statusMap[d.id] =
          statusResults[i].success && statusResults[i].data
            ? statusResults[i].data!.currentStatus
            : 'UNKNOWN';
      });

      let filtered = allDevices.filter((d) => statusMap[d.id] === connectivityFilter);
      if (statusFilter) filtered = filtered.filter((d) => d.status === (statusFilter as DeviceStatus));
      if (categoryFilter) filtered = filtered.filter((d) => d.category === (categoryFilter as DeviceCategory));
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.ipAddress?.toLowerCase().includes(q) ||
            d.macAddress?.toLowerCase().includes(q) ||
            d.serialNumber?.toLowerCase().includes(q)
        );
      }

      const total = filtered.length;
      const offset = (currentPage - 1) * LIMIT;
      setDevices(filtered.slice(offset, offset + LIMIT));
      setPollingStatuses(statusMap);
      setTotalDevices(total);
      setTotalPages(Math.max(1, Math.ceil(total / LIMIT)));
    } else {
      // Normal server-side paginated fetch
      const query: ListDevicesQuery = {
        limit: LIMIT,
        offset: (currentPage - 1) * LIMIT,
      };
      if (statusFilter) query.status = statusFilter as DeviceStatus;
      if (categoryFilter) query.category = categoryFilter as DeviceCategory;
      if (search) query.search = search;

      const result = await apiService.listDevices(query);
      if (!result.success || !result.data) {
        setError(result.error || 'Failed to load devices');
        setIsLoading(false);
        return;
      }

      const pageDevices = result.data.devices;
      setDevices(pageDevices);
      setTotalDevices(result.data.total);
      setTotalPages(Math.max(1, Math.ceil(result.data.total / LIMIT)));

      // Fetch polling statuses for monitoring-enabled devices on this page
      const monDevices = pageDevices.filter((d) => d.monitoringEnabled);
      if (monDevices.length > 0) {
        const statusResults = await Promise.all(
          monDevices.map((d) => apiService.getPollingStatus(d.id))
        );
        const statusMap: Record<string, PollingStatus> = {};
        monDevices.forEach((d, i) => {
          if (statusResults[i].success && statusResults[i].data) {
            statusMap[d.id] = statusResults[i].data!.currentStatus;
          }
        });
        setPollingStatuses(statusMap);
      } else {
        setPollingStatuses({});
      }
    }

    setIsLoading(false);
  }, [currentPage, statusFilter, categoryFilter, connectivityFilter, search]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setConnectivityFilter('');
    setSearch('');
    setCurrentPage(1);
  };

  const hasFilters = statusFilter || categoryFilter || connectivityFilter || search;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-600 mt-1">
            {totalDevices > 0
              ? `${totalDevices} device${totalDevices !== 1 ? 's' : ''} total`
              : 'Manage your network devices'}
          </p>
        </div>
        <Button onClick={() => router.push('/devices/create')}>Add Device</Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              { value: 'DECOMMISSIONED', label: 'Decommissioned' },
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
              { value: 'CLIENT_CPE', label: 'Client CPE' },
            ]}
            fullWidth
          />
          <Select
            label="Connectivity"
            value={connectivityFilter}
            onChange={(e) => { setConnectivityFilter(e.target.value); setCurrentPage(1); }}
            options={[
              { value: '', label: 'All' },
              { value: 'ONLINE', label: 'Online' },
              { value: 'OFFLINE', label: 'Offline' },
              { value: 'UNKNOWN', label: 'Unknown' },
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
              <Table.Head>Connectivity</Table.Head>
              <Table.Head>Category</Table.Head>
              <Table.Head>Owner</Table.Head>
              <Table.Head>IP Address</Table.Head>
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
                      {device.monitoringEnabled ? (
                        pollingStatuses[device.id] ? (
                          <Badge variant={getPollingStatusBadgeVariant(pollingStatuses[device.id])}>
                            {pollingStatuses[device.id]}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )
                      ) : (
                        <span className="text-gray-400 text-sm">Not monitored</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {device.category ? (
                        device.category.replace(/_/g, ' ')
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{device.ownerType}</Table.Cell>
                    <Table.Cell>
                      <span className="font-mono text-sm">
                        {device.ipAddress || <span className="text-gray-400">—</span>}
                      </span>
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
