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
  message?: string;
}
