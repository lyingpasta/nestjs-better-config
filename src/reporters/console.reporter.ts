import { Logger } from '@nestjs/common';
import { IReporter } from './reporter.interface';

export class ConsoleReporter implements IReporter {
  private readonly logger = new Logger('BetterConfig');

  reportUnused(keys: string[]): void {
    this.logger.warn(
      `${keys.length} environment variable(s) declared but never accessed:`,
    );
    for (const key of keys) {
      this.logger.warn(`  ✗ ${key}`);
    }
    this.logger.warn(
      'These may be safe to remove. Disable with audit.warnOnUnused: false',
    );
  }

  reportAllAccounted(): void {
    this.logger.log('All environment variables are accounted for. ✓');
  }
}
