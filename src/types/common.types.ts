export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  /**
   * Form field `error` blames, when the failure is about one in particular
   * (a duplicate MAC, say). Lets a form mark the offending input instead of
   * re-parsing the prose.
   */
  errorField?: string;
  /**
   * HTTP status behind a failure, when there was a response at all. Lets callers
   * branch on the kind of failure (429 in particular) without matching on prose.
   */
  status?: number;
  message?: string;
  /**
   * Set only on the DEV-030 refusal: a device model delete blocked purely by
   * devices already in the recycle bin. Lets the caller offer a confirmation
   * and retry with the purge flag instead of dead-ending on the error text.
   */
  binnedDeviceCount?: number;
}

/**
 * The two buckets every bulk endpoint reports alongside what it did. They always
 * answer 200 — one bad id in a batch must not sink the rest, which is the whole
 * point after an outage storm trips alerts across several devices at once — so
 * the caller has to read these to know whether the batch fully landed.
 *
 * `skipped` is a no-op the backend declined for a reason the operator can live
 * with (already resolved, still open); `failed` is an id it could not act on at
 * all (not found, belongs to another device).
 */
export interface BulkReportBuckets {
  skipped: Array<{ id: string; reason: string }>;
  failed: Array<{ id: string; error: string }>;
}

/**
 * A bulk endpoint's report, normalised to what the UI has to say about it: the
 * ids it acted on, plus the two buckets. Each endpoint names its own success
 * bucket (`cleared`, `deleted`, …), so callers map theirs onto `succeeded`.
 */
export interface BulkActionSummary extends BulkReportBuckets {
  succeeded: string[];
}
