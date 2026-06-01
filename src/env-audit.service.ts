import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AuditOptions } from './interfaces/audit-options.interface';

@Injectable()
export class EnvAuditService implements OnApplicationBootstrap {
  private readonly logger = new Logger('BetterConfig');

  private declaredKeys: string[] = [];
  private usedKeys: Set<string> = new Set();
  private options: Required<AuditOptions> = {
    enabled: false,
    warnOnUnused: true,
    throwOnUnused: false,
    ignoreKeys: [],
    ignorePrefixes: [],
  };

  configure(
    declaredKeys: string[],
    usedKeys: Set<string>,
    options: AuditOptions,
  ): void {
    this.declaredKeys = declaredKeys;
    this.usedKeys = usedKeys;
    this.options = {
      enabled: options.enabled ?? process.env.NODE_ENV !== 'production',
      warnOnUnused: options.warnOnUnused ?? true,
      throwOnUnused: options.throwOnUnused ?? false,
      ignoreKeys: options.ignoreKeys ?? [],
      ignorePrefixes: options.ignorePrefixes ?? [],
    };
  }

  onApplicationBootstrap(): void {
    if (!this.options.enabled) return;

    const unused = this.declaredKeys.filter(
      (key) =>
        !this.usedKeys.has(key) &&
        !this.options.ignoreKeys.includes(key) &&
        !this.options.ignorePrefixes.some((prefix) => key.startsWith(prefix)),
    );

    if (unused.length === 0) {
      this.logger.log('All environment variables are accounted for. ✓');
      return;
    }

    if (this.options.warnOnUnused) {
      this.logger.warn(
        `${unused.length} environment variable(s) declared but never accessed:`,
      );
      for (const key of unused) {
        this.logger.warn(`  ✗ ${key}`);
      }
      this.logger.warn(
        'These may be safe to remove. Disable with audit.warnOnUnused: false',
      );
    }

    if (this.options.throwOnUnused) {
      throw new Error(
        `BetterConfig: ${unused.length} unused environment variable(s) detected.`,
      );
    }
  }
}
