import { DeviceCategory, DeviceStatus } from './device.types';
import { TechnicianSummaryDTO } from './technician.types';

export type TicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CANCELLED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type TicketCategory =
  | 'CONNECTIVITY'
  | 'INSTALLATION'
  | 'HARDWARE_FAILURE'
  | 'MAINTENANCE'
  | 'RELOCATION'
  | 'OTHER';

// MANUAL is filed by an operator; the other two are opened by the backend when
// an alert is recorded, and carry the alert in `originAlertId`.
export type TicketOrigin = 'MANUAL' | 'DEVICE_ALERT' | 'WIRELESS_ALERT';

/** Statuses that still admit writes — RESOLVED and CANCELLED are history (TKT-009/010). */
export type TicketLiveStatus = Exclude<TicketStatus, 'RESOLVED' | 'CANCELLED'>;

// ============================================================
// Ticket
// ============================================================

/**
 * Where the visit happens. Snapshotted onto the ticket and never re-resolved:
 * there is no customer address anywhere else in the system, and a closed ticket
 * must keep the address it was actually worked at even if the customer moves.
 */
export interface TicketAddressDTO {
  street: string;
  municipality: string;
  neighborhood: string;
  reference: string | null; // e.g. "casa azul, portón negro"
  latitude: number | null;
  longitude: number | null;
}

export interface TicketCustomerContactDTO {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
}

export interface TicketDeviceSummaryDTO {
  id: string;
  name: string;
  ipAddress: string | null;
  macAddress: string | null;
  status: DeviceStatus;
  category: DeviceCategory | null;
  modelName: string | null;
  vendorName: string | null;
  locationName: string | null;
}

export interface TicketDTO {
  id: string;
  /**
   * The human-readable ticket number a technician quotes on the phone. Show
   * `code`, send `id` — every API call takes the UUID.
   */
  code: number;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  title: string;
  description: string;
  customerId: string | null;
  deviceId: string | null;
  technicianId: string | null;
  address: TicketAddressDTO | null;
  /** 'YYYY-MM-DD' — a calendar day. Sending an ISO datetime is rejected. */
  scheduledFor: string | null;
  origin: TicketOrigin;
  originAlertId: string | null;
  resolutionNotes: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The enriched shape, returned by `GET /:id` and the day sheet. The list
 * endpoint returns flat `TicketDTO`s instead.
 *
 * Each collaborator is null when the ticket does not reference one — and also
 * when it did but the record has since been deleted, since the FKs are SET NULL.
 */
export interface TicketDetailDTO extends TicketDTO {
  customer: TicketCustomerContactDTO | null;
  device: TicketDeviceSummaryDTO | null;
  technician: TechnicianSummaryDTO | null;
}

/** Street, municipality and neighborhood travel together or not at all (TKT-007). */
export interface TicketAddressInput {
  street: string;
  municipality: string;
  neighborhood: string;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateTicketDTO {
  title: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  customerId?: string | null;
  deviceId?: string | null;
  /** Assigns on creation — the ticket comes back ASSIGNED. */
  technicianId?: string | null;
  address?: TicketAddressInput | null;
  scheduledFor?: string | null;
}

/**
 * Descriptive fields only. Status, technician and schedule move through the
 * action endpoints instead.
 */
export interface UpdateTicketDTO {
  title?: string;
  description?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  customerId?: string | null;
  deviceId?: string | null;
  address?: TicketAddressInput | null;
}

export interface AssignTicketDTO {
  technicianId: string;
  /** Optional: set the visit day in the same call. */
  scheduledFor?: string | null;
}

export interface ListTicketsQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  technicianId?: string;
  customerId?: string;
  deviceId?: string;
  scheduledFrom?: string; // 'YYYY-MM-DD', inclusive
  scheduledTo?: string; // 'YYYY-MM-DD', inclusive
  /** The dispatcher's inbox. Overrides `technicianId` server-side — don't send both. */
  unassignedOnly?: boolean;
  /** Excludes RESOLVED and CANCELLED. Overrides `status` server-side — don't send both. */
  openOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface TicketListResponse {
  tickets: TicketDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

/**
 * A technician's tasks for one calendar day, already ordered
 * (URGENT → HIGH → NORMAL → LOW, then oldest first). Never paginated:
 * `total` is always `tickets.length`.
 */
export interface TechnicianDaySheetDTO {
  technician: TechnicianSummaryDTO;
  date: string; // 'YYYY-MM-DD', echoed back
  tickets: TicketDetailDTO[];
  total: number;
}
