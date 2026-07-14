import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AuditOptions } from './interfaces/audit-options.interface';
import { IReporter } from './reporters/reporter.interface';
import { ConsoleReporter } from './reporters/console.reporter';

@Injectable()
export class EnvAuditService implements OnApplicationBootstrap {
  private reporter: IReporter = new ConsoleReporter();

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
    reporter?: IReporter,
  ): void {
    this.declaredKeys = declaredKeys;
    this.usedKeys = usedKeys;
    if (reporter) {
      this.reporter = reporter;
    }
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
      this.reporter.reportAllAccounted();
      return;
    }

    if (this.options.warnOnUnused) {
      this.reporter.reportUnused(unused);
    }

    if (this.options.throwOnUnused) {
      throw new Error(
        `BetterConfig: ${unused.length} unused environment variable(s) detected.`,
      );
    }
  }
}
