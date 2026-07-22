export type BillStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface BillLineItemDTO {
  contractedServiceId: string;
  servicePlanId: string;
  planName: string;
  monthlyPrice: number;
}

export interface BillDTO {
  id: string;
  customerId: string;
  period: string; // 'YYYY-MM'
  status: BillStatus;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  total: number;
  lineItems: BillLineItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface GenerateBillDTO {
  customerId: string;
  year: number;
  month: number;
  issueDate?: string;
  dueDate?: string;
}

export interface GenerateBulkBillsDTO {
  year: number;
  month: number;
  issueDate?: string;
  dueDate?: string;
}

export interface BulkGenerateResult {
  period: string;
  generated: BillDTO[];
  skipped: Array<{ customerId: string; reason: string }>;
  failed: Array<{ customerId: string; error: string }>;
}

export interface ListBillsQuery {
  customerId?: string;
  status?: BillStatus;
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
}

export interface BillListResponse {
  bills: BillDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
