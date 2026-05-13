import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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

export function useDevices() {
  const searchParams = useSearchParams();

  const [devices, setDevices] = useState<DeviceResponseDTO[]>([]);
  const [pollingStatuses, setPollingStatuses] = useState<Record<string, PollingStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);
  const [limit, setLimitState] = useState(20);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

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

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (connectivityFilter) {
      const allResult = await apiService.listDevices({ limit: 300 });
      if (!allResult.success || !allResult.data) {
        setError(allResult.error || 'Error al cargar dispositivos');
        setIsLoading(false);
        return;
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
      setDevices(filtered.slice(offset, offset + limit));
      setPollingStatuses(statusMap);
      setTotalDevices(total);
      setTotalPages(Math.max(1, Math.ceil(total / limit)));
    } else {
      const query: ListDevicesQuery = {
        limit: limit,
        offset: (currentPage - 1) * limit,
      };
      if (statusFilter) query.status = statusFilter as DeviceStatus;
      if (categoryFilter) query.category = categoryFilter as DeviceCategory;
      if (search) query.search = search;

      const result = await apiService.listDevices(query);
      if (!result.success || !result.data) {
        setError(result.error || 'Error al cargar dispositivos');
        setIsLoading(false);
        return;
      }

      const pageDevices = result.data.devices;
      setDevices(pageDevices);
      setTotalDevices(result.data.total);
      setTotalPages(Math.max(1, Math.ceil(result.data.total / limit)));
      setPollingStatuses(await buildPollingStatusMap(pageDevices));
    }

    setLastRefreshed(new Date());
    setIsLoading(false);
  }, [currentPage, limit, statusFilter, categoryFilter, connectivityFilter, search]);

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
    isLoading,
    error,
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
    fetchDevices,
    limit,
    setLimit,
    PAGE_SIZE_OPTIONS,
  };
}
