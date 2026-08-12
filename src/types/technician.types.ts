/**
 * Field workers tickets are dispatched to.
 *
 * Deliberately not a `User`: a technician needs no login to be given work, and
 * `userId` is only the optional link for when they get one.
 */
export interface TechnicianDTO {
  id: string;
  fullName: string;
  phone: string; // normalized to '+' + digits, e.g. '+573001112233'
  email: string | null; // lowercased
  userId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** The projection tickets embed — same fields minus the audit trail. */
export interface TechnicianSummaryDTO {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
}

export interface CreateTechnicianDTO {
  fullName: string;
  phone: string;
  email?: string | null;
  userId?: string | null;
  isActive?: boolean;
}

export interface UpdateTechnicianDTO {
  fullName?: string;
  phone?: string;
  email?: string | null;
  userId?: string | null;
  /** false takes them off the rota. This is how you retire someone — see TKT-097. */
  isActive?: boolean;
}

export interface ListTechniciansQuery {
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface TechnicianListResponse {
  technicians: TechnicianDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
