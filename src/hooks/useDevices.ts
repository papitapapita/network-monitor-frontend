import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  DeviceResponseDTO,
  ListDevicesQuery,
  DeviceStatus,
  DeviceCategory,
} from '@/types/device.types';
import { PollingStatus } from '@/types/polling.types';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

async function buildPollingStatusMap(
  devices: DeviceResponseDTO[]
): Promise<Record<string, PollingStatus>> {
  const monitored = devices.filter((d) => d.monitoringEnabled);
  if (monitored.length === 0) return {};

  const results = await Promise.all(
    monitored.map((d) => apiService.getPollingStatus(d.id))
  );

  const map: Record<string, PollingStatus> = {};
  monitored.forEach((d, i) => {
    if (results[i].success && results[i].data) {
      map[d.id] = results[i].data!.currentStatus;
    }
  });
  return map;
}

async function fetchDevicesData(params: {
  currentPage: number;
  limit: number;
  statusFilter: string;
  categoryFilter: string;
  connectivityFilter: string;
  search: string;
}) {
  const { currentPage, limit, statusFilter, categoryFilter, connectivityFilter, search } = params;

  if (connectivityFilter) {
    const allResult = await apiService.listDevices({ limit: 300 });
    if (!allResult.success || !allResult.data) {
      throw new Error(allResult.error || 'Error al cargar dispositivos');
    }

    const allDevices = allResult.data.devices;
    const statusMap = await buildPollingStatusMap(allDevices);

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
    const offset = (currentPage - 1) * limit;
    return {
      devices: filtered.slice(offset, offset + limit),
      pollingStatuses: statusMap,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  const query: ListDevicesQuery = {
    limit,
    offset: (currentPage - 1) * limit,
  };
  if (statusFilter) query.status = statusFilter as DeviceStatus;
  if (categoryFilter) query.category = categoryFilter as DeviceCategory;
  if (search) query.search = search;

  const result = await apiService.listDevices(query);
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Error al cargar dispositivos');
  }

  const pageDevices = result.data.devices;
  return {
    devices: pageDevices,
    pollingStatuses: await buildPollingStatusMap(pageDevices),
    total: result.data.total,
    totalPages: Math.max(1, Math.ceil(result.data.total / limit)),
  };
}

export function useDevices() {
  const searchParams = useSearchParams();

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimitState] = useState(20);
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get('status') ?? ''
  );
  const [categoryFilter, setCategoryFilter] = useState('');
  const [connectivityFilter, setConnectivityFilter] = useState(
    () => searchParams.get('connectivity') ?? ''
  );
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const queryKey = ['devices', currentPage, limit, statusFilter, categoryFilter, connectivityFilter, search];

  const { data, isLoading, isFetching, error, dataUpdatedAt, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchDevicesData({ currentPage, limit, statusFilter, categoryFilter, connectivityFilter, search }),
  });

  const devices = data?.devices ?? [];
  const pollingStatuses = data?.pollingStatuses ?? {};
  const totalDevices = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const lastRefreshed = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const setLimit = (n: number) => {
    setLimitState(n);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setConnectivityFilter('');
    setSearch('');
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const CONNECTIVITY_ORDER: Record<string, number> = { ONLINE: 0, OFFLINE: 1, UNKNOWN: 2 };

  const sortedDevices = sortField
    ? [...devices].sort((a, b) => {
        if (sortField === 'connectivity') {
          const aOrder = a.monitoringEnabled
            ? (CONNECTIVITY_ORDER[pollingStatuses[a.id]] ?? 2)
            : 3;
          const bOrder = b.monitoringEnabled
            ? (CONNECTIVITY_ORDER[pollingStatuses[b.id]] ?? 2)
            : 3;
          if (aOrder === 3 && bOrder === 3) return 0;
          if (aOrder === 3) return 1;
          if (bOrder === 3) return -1;
          const cmp = aOrder - bOrder;
          return sortDirection === 'asc' ? cmp : -cmp;
        }

        let aVal: string;
        let bVal: string;
        if (sortField === 'name') {
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
        } else if (sortField === 'status') {
          aVal = a.status;
          bVal = b.status;
        } else if (sortField === 'category') {
          aVal = a.category ?? '';
          bVal = b.category ?? '';
        } else if (sortField === 'owner') {
          aVal = a.ownerType ?? '';
          bVal = b.ownerType ?? '';
        } else if (sortField === 'ip') {
          const toNum = (ip: string) =>
            ip.split('.').reduce((acc, octet) => acc * 256 + parseInt(octet, 10), 0);
          const aIp = a.ipAddress ?? '';
          const bIp = b.ipAddress ?? '';
          const cmpIp = toNum(aIp) - toNum(bIp);
          return sortDirection === 'asc' ? cmpIp : -cmpIp;
        } else {
          return 0;
        }
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      })
    : devices;

  return {
    devices,
    sortedDevices,
    pollingStatuses,
    isLoading: isLoading,
    isFetching,
    error: error ? (error as Error).message : null,
    currentPage,
    totalPages,
    totalDevices,
    lastRefreshed,
    statusFilter,
    categoryFilter,
    connectivityFilter,
    search,
    sortField,
    sortDirection,
    hasFilters: !!(statusFilter || categoryFilter || connectivityFilter || search),
    setStatusFilter,
    setCategoryFilter,
    setConnectivityFilter,
    setSearch,
    setCurrentPage,
    handleSort,
    clearFilters,
    fetchDevices: refetch,
    limit,
    setLimit,
    PAGE_SIZE_OPTIONS,
  };
}
