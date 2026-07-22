export interface CustomerDTO {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  cedula: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerDTO {
  fullName: string;
  phone: string;
  email?: string | null;
  cedula?: string | null;
}

export interface UpdateCustomerDTO {
  fullName?: string;
  phone?: string;
  email?: string | null;
  cedula?: string | null;
}

export interface CustomerListResponse {
  customers: CustomerDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface ServicePlanDTO {
  id: string;
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPrice: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServicePlanDTO {
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPrice: number;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateServicePlanDTO {
  name?: string;
  downloadMbps?: number;
  uploadMbps?: number;
  monthlyPrice?: number;
  description?: string | null;
  isActive?: boolean;
}

export interface ServicePlanListResponse {
  servicePlans: ServicePlanDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

// Services are created as PENDING; ACTIVE requires an assigned device.
// PENDING is a starting state only — it cannot be used as an update target.
export type ContractedServiceStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

/** Statuses the update endpoint accepts as a target (PENDING is rejected). */
export type ContractedServiceTargetStatus = Exclude<ContractedServiceStatus, 'PENDING'>;

export interface ContractedServiceDTO {
  id: string;
  customerId: string;
  servicePlanId: string;
  deviceId: string | null;
  status: ContractedServiceStatus;
  startDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractedServiceDTO {
  customerId: string;
  servicePlanId: string;
  deviceId?: string | null;
  startDate?: string;
}

export interface UpdateContractedServiceDTO {
  servicePlanId?: string;
  deviceId?: string | null;
  status?: ContractedServiceTargetStatus;
}

export interface ContractedServiceListResponse {
  contractedServices: ContractedServiceDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
