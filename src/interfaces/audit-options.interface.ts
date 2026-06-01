export interface AuditOptions {
  /**
   * Enable audit logic. Defaults to `process.env.NODE_ENV !== 'production'`
   * evaluated at forRoot() time.
   */
  enabled?: boolean;
  /** Warn on unused env vars. Default: true */
  warnOnUnused?: boolean;
  /** Throw after logging when unused vars are found. Default: false */
  throwOnUnused?: boolean;
  /** Keys to exclude from the unused report. Default: [] */
  ignoreKeys?: string[];
  /** Key prefixes to exclude from the unused report. Default: [] */
  ignorePrefixes?: string[];
}
