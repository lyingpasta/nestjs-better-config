import { Logger } from '@nestjs/common';
import { IReporter } from './reporter.interface';
import { LOGGER_CONTEXT } from '../constants';

const UNUSED_KEY_MARKER = '  ✗ ';
const UNUSED_HINT =
  'These may be safe to remove. Disable with audit.warnOnUnused: false';
const ALL_ACCOUNTED_MESSAGE = 'All environment variables are accounted for. ✓';

export class ConsoleReporter implements IReporter {
  private readonly logger = new Logger(LOGGER_CONTEXT);

  reportUnused(keys: string[]): void {
    this.logger.warn(
      `${keys.length} environment variable(s) declared but never accessed:`,
    );
    for (const key of keys) {
      this.logger.warn(`${UNUSED_KEY_MARKER}${key}`);
    }
    this.logger.warn(UNUSED_HINT);
  }

  reportAllAccounted(): void {
    this.logger.log(ALL_ACCOUNTED_MESSAGE);
  }
}
