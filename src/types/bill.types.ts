export type BillStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface BillLineItemDTO {
  contractedServiceId: string;
  servicePlanId: string;
  planName: string;
  monthlyPrice: number;
  /** What the line charges: the monthly price, or a prorated share in whole pesos (BIL-287…290). */
  amount: number;
  /** 'YYYY-MM-DD', the first and last day charged (both included); null on lines before 2026-10-06. */
  serviceFrom: string | null;
  serviceTo: string | null;
}

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'NEQUI' | 'DAVIPLATA' | 'BRE_B' | 'OTHER';

/** One per bill, never edited (BIL-300…303). */
export interface BillPaymentDTO {
  method: PaymentMethod;
  /** Receipt or transaction number. */
  reference: string | null;
  /** Always the bill's total. */
  amount: number;
  /** When the customer paid. */
  paidAt: string;
  /** The user who entered it. */
  recordedByUserId: string | null;
}

export interface PayBillDTO {
  method: PaymentMethod;
  reference?: string | null;
  /** ISO 8601; default now, never in the future. */
  paidAt?: string;
}

export interface BillDTO {
  id: string;
  customerId: string;
  period: string; // 'YYYY-MM'
  status: BillStatus;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  /** Null until paid, and on bills paid before 2026-10-06. */
  payment: BillPaymentDTO | null;
  /** Sum of the line amounts. */
  total: number;
  lineItems: BillLineItemDTO[];
  createdAt: string;
  updatedAt: string;
}

/** One bill per contracted service and period (BIL-007). */
export interface GenerateBillDTO {
  contractedServiceId: string;
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
  skipped: Array<{ contractedServiceId: string; reason: string }>;
  failed: Array<{ contractedServiceId: string; error: string }>;
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
