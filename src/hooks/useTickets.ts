import { useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiService } from '@/services/api.service';
import {
  ListTicketsQuery,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@/types/ticket.types';
import {
  OPEN_ONLY_VALUE,
  UNASSIGNED_VALUE,
  isReversedDateRange,
} from '@/constants/ticket.constants';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useUrlState } from '@/hooks/useUrlState';

const SEARCH_DEBOUNCE_MS = 350;

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

interface TicketFilters {
  /** A `TicketStatus`, the `OPEN_ONLY_VALUE` sentinel, or '' for all. */
  statusFilter: string;
  /** A technician id, the `UNASSIGNED_VALUE` sentinel, or '' for all. */
  technicianFilter: string;
  priorityFilter: string;
  categoryFilter: string;
  scheduledFrom: string;
  scheduledTo: string;
}

/**
 * Turns the filter controls into a request.
 *
 * The two sentinel values are what keep the contradicting query pairs apart:
 * because "sin cerrar" is an option on the Estado select rather than a checkbox
 * beside it, `openOnly` and `status` can never both be set — and likewise for
 * `unassignedOnly` and `technicianId` on the Técnico select.
 */
function buildTicketQuery(filters: TicketFilters, page: number, limit: number): ListTicketsQuery {
  const query: ListTicketsQuery = { limit, offset: (page - 1) * limit };

  if (filters.statusFilter === OPEN_ONLY_VALUE) {
    query.openOnly = true;
  } else if (filters.statusFilter) {
    query.status = filters.statusFilter as TicketStatus;
  }

  if (filters.technicianFilter === UNASSIGNED_VALUE) {
    query.unassignedOnly = true;
  } else if (filters.technicianFilter) {
    query.technicianId = filters.technicianFilter;
  }

  if (filters.priorityFilter) query.priority = filters.priorityFilter as TicketPriority;
  if (filters.categoryFilter) query.category = filters.categoryFilter as TicketCategory;
  if (filters.scheduledFrom) query.scheduledFrom = filters.scheduledFrom;
  if (filters.scheduledTo) query.scheduledTo = filters.scheduledTo;

  return query;
}

async function fetchTicketsPage(filters: TicketFilters, page: number, limit: number) {
  const result = await apiService.listTickets(buildTicketQuery(filters, page, limit));
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Error al cargar los tickets');
  }
  return {
    tickets: result.data.tickets,
    total: result.data.total,
    totalPages: Math.max(1, Math.ceil(result.data.total / limit)),
  };
}

/**
 * The tickets table is the one list in this app that grows without an operator
 * doing anything — monitoring opens tickets by itself — so this filters and
 * paginates on the server rather than fetching everything and slicing, the way
 * the customer and vendor pages can afford to.
 *
 * Pagination, filters and sort live in the URL (via `useUrlState`), so a
 * technician, customer or device page can deep-link into a filtered list, and
 * so navigating to a ticket and back with the browser's back button restores
 * the table where it was. `search` is the one exception: it stays local so
 * typing feels instant, and is debounced into the URL after the operator
 * pauses.
 */
export function useTickets() {
  const { get, getNumber, set } = useUrlState();

  const currentPage = getNumber('page', 1);
  const limit = getNumber('limit', 20);

  const statusFilter = get('status', '');
  const technicianFilter = get('technicianId', '');
  const priorityFilter = get('priority', '');
  const categoryFilter = get('category', '');
  const scheduledFrom = get('scheduledFrom', '');
  const scheduledTo = get('scheduledTo', '');
  const sortField = get('sort', '') || null;
  const sortDirection = get('dir', 'asc') as 'asc' | 'desc';

  const [search, setSearchState] = useState(() => get('search', ''));
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const urlSearch = get('search', '');
  useEffect(() => {
    if (debouncedSearch !== urlSearch) set({ search: debouncedSearch || null, page: null });
    // Only the settled value should push a URL update — not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters: TicketFilters = {
    statusFilter,
    technicianFilter,
    priorityFilter,
    categoryFilter,
    scheduledFrom,
    scheduledTo,
  };

  // A reversed range is a 400, so hold the request back and say so instead. The
  // date inputs also bound each other, making this hard to reach.
  const dateRangeError = isReversedDateRange(scheduledFrom, scheduledTo)
    ? 'La fecha inicial no puede ser posterior a la final'
    : null;

  const { data, isLoading, isFetching, error, dataUpdatedAt, refetch } = useQuery({
    // Prefix-matches `invalidateQueries({ queryKey: ['tickets'] })` from every
    // page that writes a ticket.
    queryKey: [
      'tickets',
      currentPage,
      limit,
      statusFilter,
      technicianFilter,
      priorityFilter,
      categoryFilter,
      scheduledFrom,
      scheduledTo,
    ],
    queryFn: () => fetchTicketsPage(filters, currentPage, limit),
    enabled: !dateRangeError,
    placeholderData: keepPreviousData,
  });

  const pageTickets = useMemo(() => data?.tickets ?? [], [data]);

  // The list endpoint takes no free-text parameter, so this narrows the page
  // that was fetched rather than the whole backlog. The filters above are the
  // ones that reach the database; the page says as much under the input.
  const tickets = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return pageTickets;
    return pageTickets.filter(
      (t) =>
        String(t.code).includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [pageTickets, debouncedSearch]);

  // Every filter change resets to the first page — page 4 of the old result set
  // is rarely page 4 of the new one, and is often past its end.
  const setCurrentPage = (page: number) => set({ page: page === 1 ? null : page });
  const setLimit = (n: number) => set({ limit: n === 20 ? null : n, page: null });
  const setStatusFilter = (v: string) => set({ status: v || null, page: null });
  const setTechnicianFilter = (v: string) => set({ technicianId: v || null, page: null });
  const setPriorityFilter = (v: string) => set({ priority: v || null, page: null });
  const setCategoryFilter = (v: string) => set({ category: v || null, page: null });
  const setScheduledFrom = (v: string) => set({ scheduledFrom: v || null, page: null });
  const setScheduledTo = (v: string) => set({ scheduledTo: v || null, page: null });
  const setSearch = (v: string) => setSearchState(v);

  const clearFilters = () => {
    setSearchState('');
    set({
      status: null,
      technicianId: null,
      priority: null,
      category: null,
      scheduledFrom: null,
      scheduledTo: null,
      search: null,
      page: null,
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      set({ dir: sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sort: field, dir: 'asc' });
    }
  };

  return {
    tickets,
    isLoading,
    isFetching,
    error: dateRangeError ?? (error ? (error as Error).message : null),
    currentPage,
    totalPages: data?.totalPages ?? 1,
    totalTickets: data?.total ?? 0,
    lastRefreshed: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    statusFilter,
    technicianFilter,
    priorityFilter,
    categoryFilter,
    scheduledFrom,
    scheduledTo,
    search,
    sortField,
    sortDirection,
    hasFilters: !!(
      statusFilter ||
      technicianFilter ||
      priorityFilter ||
      categoryFilter ||
      scheduledFrom ||
      scheduledTo ||
      search
    ),
    setStatusFilter,
    setTechnicianFilter,
    setPriorityFilter,
    setCategoryFilter,
    setScheduledFrom,
    setScheduledTo,
    setSearch,
    setCurrentPage,
    handleSort,
    clearFilters,
    fetchTickets: refetch,
    limit,
    setLimit,
    PAGE_SIZE_OPTIONS,
  };
}
