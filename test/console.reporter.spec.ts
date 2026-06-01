import { Logger } from '@nestjs/common';
import { ConsoleReporter } from '../src/reporters/console.reporter';

describe('ConsoleReporter', () => {
  let reporter: ConsoleReporter;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    reporter = new ConsoleReporter();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('reportUnused()', () => {
    it('warns with exact count message', () => {
      reporter.reportUnused([
        'OLD_STRIPE_WEBHOOK_SECRET',
        'LEGACY_REDIS_URL',
        'DEPRECATED_API_KEY',
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        '3 environment variable(s) declared but never accessed:',
      );
    });

    it('warns each key with ✗ prefix', () => {
      reporter.reportUnused(['OLD_STRIPE_WEBHOOK_SECRET', 'LEGACY_REDIS_URL']);
      expect(warnSpy).toHaveBeenCalledWith('  ✗ OLD_STRIPE_WEBHOOK_SECRET');
      expect(warnSpy).toHaveBeenCalledWith('  ✗ LEGACY_REDIS_URL');
    });

    it('warns with disable hint', () => {
      reporter.reportUnused(['OLD_KEY']);
      expect(warnSpy).toHaveBeenCalledWith(
        'These may be safe to remove. Disable with audit.warnOnUnused: false',
      );
    });

    it('does not call log() for unused vars', () => {
      reporter.reportUnused(['OLD_KEY']);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('handles single unused key with correct singular count', () => {
      reporter.reportUnused(['SOLO_KEY']);
      expect(warnSpy).toHaveBeenCalledWith(
        '1 environment variable(s) declared but never accessed:',
      );
    });
  });

  describe('reportAllAccounted()', () => {
    it('logs exact all-accounted message', () => {
      reporter.reportAllAccounted();
      expect(logSpy).toHaveBeenCalledWith(
        'All environment variables are accounted for. ✓',
      );
    });

    it('does not call warn() when all accounted', () => {
      reporter.reportAllAccounted();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
