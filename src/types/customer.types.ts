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

export type ContractedServiceStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

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
  status?: ContractedServiceStatus;
}

export interface ContractedServiceListResponse {
  contractedServices: ContractedServiceDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
