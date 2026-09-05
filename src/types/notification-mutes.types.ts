/**
 * A global, standing list of alert-type keys whose outbound notification is
 * suppressed everywhere — never the alert record, which still opens/lists
 * normally (BACKEND_API.md, NOT-190). Muting is by bare metric name, so one
 * entry silences both its WARNING and CRITICAL severities (NOT-191).
 */
export interface NotificationMutesDTO {
  metrics: string[];
}
