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
}
