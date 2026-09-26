export type CollectionAccountStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface CollectionAccountLineItemDTO {
  description: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CollectionAccountDTO {
  id: string;
  code: number | null;
  number: string | null; // 'CC-0007' — what is printed on the document
  status: CollectionAccountStatus;
  customerId: string | null;
  customerName: string;
  customerDocument: string | null; // cédula / NIT
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  lineItems: CollectionAccountLineItemDTO[];
  total: number;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionAccountLineItemDTO {
  description: string;
  unitPrice: number;
  quantity: number;
}

/**
 * With `customerId`, name, phone, email and cédula are copied from the customer
 * record (a typed cédula is kept only if the customer has none); the address
 * always comes from here.
 */
export interface CreateCollectionAccountDTO {
  customerId?: string;
  customerName?: string;
  customerDocument?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  lineItems: CreateCollectionAccountLineItemDTO[];
}

export interface ListCollectionAccountsQuery {
  customerId?: string;
  status?: CollectionAccountStatus;
  limit?: number;
  offset?: number;
}

export interface CollectionAccountListResponse {
  collectionAccounts: CollectionAccountDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
