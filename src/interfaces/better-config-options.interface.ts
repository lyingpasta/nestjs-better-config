import { AuditOptions } from './audit-options.interface';
import { IReporter } from '../reporters/reporter.interface';

export interface BetterConfigOptions {
  /**
   * Zod schema — duck-typed, not imported directly.
   * Keys extracted from schema.shape when present.
   */
  validationSchema?: unknown;
  /** Path to .env file used as fallback source-of-truth when no schema provided. */
  envFilePath?: string;
  /** Audit behaviour options. */
  audit?: AuditOptions;
  /** Custom audit result reporter. Default: ConsoleReporter. */
  reporter?: IReporter;
}
