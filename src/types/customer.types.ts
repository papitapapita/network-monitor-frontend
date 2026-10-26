import type { DeviceResponseDTO } from './device.types';

export type PaymentDay = 15 | 30;

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
  /**
   * The day of the month this service's bill is due; the 30th is February's
   * last day. Each service has its own, so a customer's services can fall due
   * on different days and each gets its own bill (CUS-024, BIL-007).
   */
  paymentDay: PaymentDay;
  createdAt: string;
  updatedAt: string;
}

/**
 * What `GET /contracted-services` and `GET /:id` return: the plain record plus
 * read-only summaries of what it points at. `POST` and `PUT` still answer with
 * the plain `ContractedServiceDTO`.
 */
export interface ContractedServiceDetailDTO extends ContractedServiceDTO {
  customer: Pick<CustomerDTO, 'id' | 'fullName' | 'phone' | 'email' | 'cedula'>;
  servicePlan: Pick<ServicePlanDTO, 'id' | 'name' | 'downloadMbps' | 'uploadMbps' | 'monthlyPrice' | 'isActive'>;
  /** Null exactly when `deviceId` is. `deletedAt` is set while the device sits in the trash. */
  device: Pick<DeviceResponseDTO, 'id' | 'name' | 'ipAddress' | 'macAddress' | 'status' | 'category' | 'deletedAt'> | null;
}

export interface CreateContractedServiceDTO {
  customerId: string;
  servicePlanId: string;
  deviceId?: string | null;
  startDate?: string;
  /** Default 30. */
  paymentDay?: PaymentDay;
}

export interface UpdateContractedServiceDTO {
  servicePlanId?: string;
  deviceId?: string | null;
  status?: ContractedServiceTargetStatus;
  /** A cancelled service refuses it with 409. */
  paymentDay?: PaymentDay;
}

export interface ContractedServiceListResponse {
  contractedServices: ContractedServiceDetailDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
