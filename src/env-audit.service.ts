import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AuditOptions } from './interfaces/audit-options.interface';
import { IReporter } from './reporters/reporter.interface';
import { ConsoleReporter } from './reporters/console.reporter';
import { LOGGER_CONTEXT, PRODUCTION_NODE_ENV } from './constants';
import { isIgnoredKey } from './key-filter';

const DEFAULT_WARN_ON_UNUSED = true;
const DEFAULT_THROW_ON_UNUSED = false;

/** State before `configure()` runs: audit disabled. */
function unconfiguredAuditOptions(): Required<AuditOptions> {
  return {
    enabled: false,
    warnOnUnused: DEFAULT_WARN_ON_UNUSED,
    throwOnUnused: DEFAULT_THROW_ON_UNUSED,
    ignoreKeys: [],
    ignorePrefixes: [],
  };
}

function isNonProductionEnv(): boolean {
  return process.env.NODE_ENV !== PRODUCTION_NODE_ENV;
}

function resolveAuditOptions(options: AuditOptions): Required<AuditOptions> {
  return {
    enabled: options.enabled ?? isNonProductionEnv(),
    warnOnUnused: options.warnOnUnused ?? DEFAULT_WARN_ON_UNUSED,
    throwOnUnused: options.throwOnUnused ?? DEFAULT_THROW_ON_UNUSED,
    ignoreKeys: options.ignoreKeys ?? [],
    ignorePrefixes: options.ignorePrefixes ?? [],
  };
}

function buildUnusedErrorMessage(unusedCount: number): string {
  return `${LOGGER_CONTEXT}: ${unusedCount} unused environment variable(s) detected.`;
}

@Injectable()
export class EnvAuditService implements OnApplicationBootstrap {
  private reporter: IReporter = new ConsoleReporter();

  private declaredKeys: string[] = [];
  private usedKeys: Set<string> = new Set();
  private options: Required<AuditOptions> = unconfiguredAuditOptions();

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
    this.options = resolveAuditOptions(options);
  }

  onApplicationBootstrap(): void {
    if (!this.options.enabled) return;

    const unused = this.findUnusedKeys();
    if (unused.length === 0) {
      this.reporter.reportAllAccounted();
      return;
    }

    this.warnIfEnabled(unused);
    this.throwIfEnabled(unused);
  }

  private findUnusedKeys(): string[] {
    return this.declaredKeys.filter((key) => this.isUnused(key));
  }

  private isUnused(key: string): boolean {
    return !this.usedKeys.has(key) && !isIgnoredKey(key, this.options);
  }

  private warnIfEnabled(unused: string[]): void {
    if (!this.options.warnOnUnused) return;
    this.reporter.reportUnused(unused);
  }

  private throwIfEnabled(unused: string[]): void {
    if (!this.options.throwOnUnused) return;
    throw new Error(buildUnusedErrorMessage(unused.length));
  }
}
