import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  DeviceResponseDTO,
  ListDevicesQuery,
  DeviceStatus,
  DeviceCategory,
} from '@/types/device.types';
import { PollingStatus } from '@/types/polling.types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useUrlState } from '@/hooks/useUrlState';

const SEARCH_DEBOUNCE_MS = 350;

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** The column key is the URL/localStorage-facing name; only 'ip' diverges from the API's `sortBy`. */
function toSortBy(field: string): ListDevicesQuery['sortBy'] {
  return (field === 'ip' ? 'ipAddress' : field) as ListDevicesQuery['sortBy'];
}

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
  locationFilter: string;
  search: string;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
}) {
  const { currentPage, limit, statusFilter, categoryFilter, connectivityFilter, locationFilter, search, sortField, sortDirection } = params;

  if (connectivityFilter) {
    const allResult = await apiService.listDevices({
      limit: 300,
      locationId: locationFilter || undefined,
      // Connectivity itself is filtered locally below (the API has no such
      // param), but the server-sorted order still holds through that filter
      // and the slice that follows, so the page stays sorted correctly.
      ...(sortField
        ? { sortBy: toSortBy(sortField), sortOrder: sortDirection === 'asc' ? 'ASC' : 'DESC' }
        : {}),
    });
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
  if (locationFilter) query.locationId = locationFilter;
  if (search) query.search = search;
  if (sortField) {
    query.sortBy = toSortBy(sortField);
    query.sortOrder = sortDirection === 'asc' ? 'ASC' : 'DESC';
  }

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

/**
 * All of pagination, filters and sort live in the URL (via `useUrlState`)
 * rather than component state, so navigating to a device page and back with
 * the browser's back button restores the table exactly where it was. `search`
 * is the one exception: it stays local so typing feels instant, and is
 * debounced into the URL (and the query) after the operator pauses.
 */
export function useDevices() {
  const { get, getNumber, set } = useUrlState();

  const currentPage = getNumber('page', 1);
  const limit = getNumber('limit', 20);
  const statusFilter = get('status', '');
  const categoryFilter = get('category', '');
  const connectivityFilter = get('connectivity', '');
  const locationFilter = get('locationId', '');
  const sortField = get('sort', '') || null;
  const sortDirection = get('dir', 'asc') as 'asc' | 'desc';

  const [search, setSearchState] = useState(() => get('search', ''));
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // Mirrors the debounced value into the URL once typing settles, resetting
  // to page 1 the way every other filter change does.
  const urlSearch = get('search', '');
  useEffect(() => {
    if (debouncedSearch !== urlSearch) set({ search: debouncedSearch || null, page: null });
    // Only the settled value should push a URL update — not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const queryKey = ['devices', currentPage, limit, statusFilter, categoryFilter, connectivityFilter, locationFilter, debouncedSearch, sortField, sortDirection];

  const { data, isLoading, isFetching, error, dataUpdatedAt, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchDevicesData({ currentPage, limit, statusFilter, categoryFilter, connectivityFilter, locationFilter, search: debouncedSearch, sortField, sortDirection }),
    placeholderData: keepPreviousData,
  });

  const devices = data?.devices ?? [];
  const pollingStatuses = data?.pollingStatuses ?? {};
  const totalDevices = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const lastRefreshed = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const setCurrentPage = (page: number) => set({ page: page === 1 ? null : page });
  const setLimit = (n: number) => set({ limit: n === 20 ? null : n, page: null });
  const setStatusFilter = (v: string) => set({ status: v || null, page: null });
  const setCategoryFilter = (v: string) => set({ category: v || null, page: null });
  const setConnectivityFilter = (v: string) => set({ connectivity: v || null, page: null });
  const setLocationFilter = (v: string) => set({ locationId: v || null, page: null });
  const setSearch = (v: string) => setSearchState(v);

  const clearFilters = () => {
    setSearchState('');
    set({
      status: null,
      category: null,
      connectivity: null,
      locationId: null,
      search: null,
      page: null,
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      set({ dir: sortDirection === 'asc' ? 'desc' : 'asc', page: null });
    } else {
      set({ sort: field, dir: 'asc', page: null });
    }
  };

  return {
    // The API sorts and paginates together, so a header click here just
    // requests the new sortBy/sortOrder and the returned page is rendered as-is.
    devices,
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
    locationFilter,
    search,
    sortField,
    sortDirection,
    hasFilters: !!(statusFilter || categoryFilter || connectivityFilter || locationFilter || search),
    setStatusFilter,
    setCategoryFilter,
    setConnectivityFilter,
    setLocationFilter,
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
