/**
 * The install's subscription (ADR 0002, R17). A missed payment escalates in
 * stages: GRACE (nothing yet) → READ_ONLY (writes refused, monitoring and
 * alerts stopped) → LOCKED (everything but sign-in refused). Nothing is
 * deleted in any stage.
 */
export type SubscriptionState = 'NOT_ENFORCED' | 'ACTIVE' | 'GRACE' | 'READ_ONLY' | 'LOCKED';

export interface SubscriptionStatusDTO {
  state: SubscriptionState;
  /** The first instant no longer paid for. */
  paidThrough: string | null;
  /** READ_ONLY from here. */
  graceEndsAt: string | null;
  /** LOCKED from here. */
  lockedAt: string | null;
  /** READ_ONLY or LOCKED. */
  readOnly: boolean;
  locked: boolean;
}
