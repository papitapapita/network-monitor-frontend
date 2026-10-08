/** ADVANCE: a bill due in October is for October; ARREARS: for September. */
export type BillingMode = 'ADVANCE' | 'ARREARS';

/**
 * The install's billing cycle, edited by its administrator (BACKEND_API.md,
 * BIL-280). Until the first save the defaults apply, with automatic billing
 * off. A save applies from the next daily run.
 */
export interface BillingSettingsDTO {
  /** false: nothing is issued or marked overdue on its own. */
  automaticBillingEnabled: boolean;
  billingMode: BillingMode;
  /** 1–14: days before the due date the bill is issued. */
  issueLeadDays: number;
  /** 0–14: days after the due date before service is cut. */
  graceDays: number;
  /** false: nobody is cut or restored on their own. */
  automaticCutEnabled: boolean;
  /** Meta-approved template for payment reminders; null = email only. */
  reminderWhatsAppTemplate: string | null;
  /** Meta-approved template with a document header, for issued bills; null = email only (BIL-324). */
  billWhatsAppTemplate: string | null;
}
