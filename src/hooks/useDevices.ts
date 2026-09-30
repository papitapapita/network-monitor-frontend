import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  ConnectivityStatus,
  ListDevicesQuery,
  DeviceStatus,
  DeviceCategory,
} from '@/types/device.types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useUrlState } from '@/hooks/useUrlState';

const SEARCH_DEBOUNCE_MS = 350;

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/**
 * The column key is the URL/localStorage-facing name. 'ip' maps to the API's
 * `ipAddress`, and the connectivity column sorts by outage start — the API has
 * no `sortBy=connectivity`, and "down longest first" is the order worth having.
 */
function toSortBy(field: string): ListDevicesQuery['sortBy'] {
  if (field === 'ip') return 'ipAddress';
  if (field === 'connectivity') return 'downSince';
  return field as ListDevicesQuery['sortBy'];
}

/**
 * The filter used to speak the polling endpoints' ONLINE/OFFLINE; the list
 * speaks UP/DOWN. Old links and bookmarks still land on the right filter.
 */
const LEGACY_CONNECTIVITY: Record<string, ConnectivityStatus> = { ONLINE: 'UP', OFFLINE: 'DOWN' };

function toConnectivity(value: string): ConnectivityStatus | undefined {
  if (!value) return undefined;
  return LEGACY_CONNECTIVITY[value] ?? (value as ConnectivityStatus);
}

async function fetchDevicesData(params: {
  currentPage: number;
  limit: number;
  statusFilter: string;
  categoryFilter: string;
  connectivityFilter: string;
  locationFilter: string;
  agentFilter: string;
  search: string;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
}) {
  const { currentPage, limit, statusFilter, categoryFilter, connectivityFilter, locationFilter, agentFilter, search, sortField, sortDirection } = params;

  const query: ListDevicesQuery = {
    limit,
    offset: (currentPage - 1) * limit,
  };
  if (statusFilter) query.status = statusFilter as DeviceStatus;
  if (categoryFilter) query.category = categoryFilter as DeviceCategory;
  if (locationFilter) query.locationId = locationFilter;
  if (agentFilter) query.agentId = agentFilter;
  if (search) query.search = search;
  query.connectivity = toConnectivity(connectivityFilter);
  if (sortField) {
    query.sortBy = toSortBy(sortField);
    query.sortOrder = sortDirection === 'asc' ? 'ASC' : 'DESC';
  }

  const result = await apiService.listDevices(query);
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Error al cargar dispositivos');
  }

  return {
    devices: result.data.devices,
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
  const connectivityFilter = toConnectivity(get('connectivity', '')) ?? '';
  const locationFilter = get('locationId', '');
  // An agent's id, or 'none' for the devices the server polls itself.
  const agentFilter = get('agentId', '');
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

  const queryKey = ['devices', currentPage, limit, statusFilter, categoryFilter, connectivityFilter, locationFilter, agentFilter, debouncedSearch, sortField, sortDirection];

  const { data, isLoading, isFetching, error, dataUpdatedAt, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchDevicesData({ currentPage, limit, statusFilter, categoryFilter, connectivityFilter, locationFilter, agentFilter, search: debouncedSearch, sortField, sortDirection }),
    placeholderData: keepPreviousData,
  });

  const devices = data?.devices ?? [];
  const totalDevices = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const lastRefreshed = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const setCurrentPage = (page: number) => set({ page: page === 1 ? null : page });
  const setLimit = (n: number) => set({ limit: n === 20 ? null : n, page: null });
  const setStatusFilter = (v: string) => set({ status: v || null, page: null });
  const setCategoryFilter = (v: string) => set({ category: v || null, page: null });
  const setConnectivityFilter = (v: string) => set({ connectivity: v || null, page: null });
  const setLocationFilter = (v: string) => set({ locationId: v || null, page: null });
  const setAgentFilter = (v: string) => set({ agentId: v || null, page: null });
  const setSearch = (v: string) => setSearchState(v);

  const clearFilters = () => {
    setSearchState('');
    set({
      status: null,
      category: null,
      connectivity: null,
      locationId: null,
      agentId: null,
      search: null,
      page: null,
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      set({ dir: sortDirection === 'asc' ? 'desc' : 'asc', page: null });
    } else {
      // ASC on connectivity is the longest outage first, which is the useful end.
      set({ sort: field, dir: 'asc', page: null });
    }
  };

  return {
    // The API sorts and paginates together, so a header click here just
    // requests the new sortBy/sortOrder and the returned page is rendered as-is.
    devices,
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
    agentFilter,
    search,
    sortField,
    sortDirection,
    hasFilters: !!(statusFilter || categoryFilter || connectivityFilter || locationFilter || agentFilter || search),
    setStatusFilter,
    setCategoryFilter,
    setConnectivityFilter,
    setLocationFilter,
    setAgentFilter,
    setSearch,
    setCurrentPage,
    handleSort,
    clearFilters,
    fetchDevices: () => refetch(),
    limit,
    setLimit,
    PAGE_SIZE_OPTIONS,
  };
}
