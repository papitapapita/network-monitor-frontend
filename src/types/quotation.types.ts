export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface QuotationLineItemDTO {
  deviceModelId: string | null; // null if the catalog entry was later deleted
  deviceModelName: string;
  vendorName: string;
  deviceType: string;
  imageUrl: string | null;
  description: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface QuotationDTO {
  id: string;
  code: number | null;
  status: QuotationStatus;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  lineItems: QuotationLineItemDTO[];
  subtotal: number;
  total: number;
  validUntil: string;
  notes: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  expiredAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationLineItemDTO {
  deviceModelId: string;
  description?: string;
  unitPrice: number;
  quantity: number;
}

export interface CreateQuotationDTO {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  validUntil: string;
  notes?: string;
  lineItems: CreateQuotationLineItemDTO[];
}

/** All fields optional — only what's sent changes; there is no null-to-clear here. */
export interface UpdateQuotationDetailsDTO {
  validUntil?: string;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
}

export interface ReplaceQuotationLineItemsDTO {
  lineItems: CreateQuotationLineItemDTO[];
}

export interface RejectQuotationDTO {
  reason: string;
}

export interface ListQuotationsQuery {
  customerId?: string;
  status?: QuotationStatus;
  limit?: number;
  offset?: number;
}

export interface QuotationListResponse {
  quotations: QuotationDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
