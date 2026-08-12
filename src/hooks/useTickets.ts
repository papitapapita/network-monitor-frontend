import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
 */
export function useTickets() {
  const searchParams = useSearchParams();

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimitState] = useState(20);

  // Read once from the URL so the technician, customer and device pages can
  // deep-link into a filtered list. Not written back: the filters are page
  // state from then on.
  const [statusFilter, setStatusFilterState] = useState(() => searchParams.get('status') ?? '');
  const [technicianFilter, setTechnicianFilterState] = useState(
    () => searchParams.get('technicianId') ?? ''
  );
  const [priorityFilter, setPriorityFilterState] = useState('');
  const [categoryFilter, setCategoryFilterState] = useState('');
  const [scheduledFrom, setScheduledFromState] = useState('');
  const [scheduledTo, setScheduledToState] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
  const onFirstPage = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setStatusFilterState('');
    setTechnicianFilterState('');
    setPriorityFilterState('');
    setCategoryFilterState('');
    setScheduledFromState('');
    setScheduledToState('');
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
    setStatusFilter: onFirstPage(setStatusFilterState),
    setTechnicianFilter: onFirstPage(setTechnicianFilterState),
    setPriorityFilter: onFirstPage(setPriorityFilterState),
    setCategoryFilter: onFirstPage(setCategoryFilterState),
    setScheduledFrom: onFirstPage(setScheduledFromState),
    setScheduledTo: onFirstPage(setScheduledToState),
    setSearch: onFirstPage(setSearch),
    setCurrentPage,
    handleSort,
    clearFilters,
    fetchTickets: refetch,
    limit,
    setLimit: onFirstPage(setLimitState),
    PAGE_SIZE_OPTIONS,
  };
}
