import { Logger } from '@nestjs/common';
import { EnvAuditService } from '../src/env-audit.service';

describe('EnvAuditService', () => {
  let service: EnvAuditService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new EnvAuditService();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('zero unused vars', () => {
    it('logs all-accounted message when every declared key was used', () => {
      service.configure(
        ['DATABASE_URL', 'PORT'],
        new Set(['DATABASE_URL', 'PORT']),
        { enabled: true },
      );
      service.onApplicationBootstrap();
      expect(logSpy).toHaveBeenCalledWith('All environment variables are accounted for. ✓');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('logs all-accounted when declaredKeys is empty', () => {
      service.configure([], new Set(), { enabled: true });
      service.onApplicationBootstrap();
      expect(logSpy).toHaveBeenCalledWith('All environment variables are accounted for. ✓');
    });
  });

  describe('unused vars detected', () => {
    it('warns with correct count', () => {
      service.configure(
        ['DATABASE_URL', 'OLD_KEY', 'DEAD_VAR'],
        new Set(['DATABASE_URL']),
        { enabled: true, warnOnUnused: true },
      );
      service.onApplicationBootstrap();
      expect(warnSpy).toHaveBeenCalledWith(
        '2 environment variable(s) declared but never accessed:',
      );
    });

    it('warns each unused key individually', () => {
      service.configure(
        ['OLD_KEY', 'DEAD_VAR'],
        new Set(),
        { enabled: true, warnOnUnused: true },
      );
      service.onApplicationBootstrap();
      expect(warnSpy).toHaveBeenCalledWith('  ✗ OLD_KEY');
      expect(warnSpy).toHaveBeenCalledWith('  ✗ DEAD_VAR');
    });

    it('warns with disable hint', () => {
      service.configure(['OLD_KEY'], new Set(), { enabled: true, warnOnUnused: true });
      service.onApplicationBootstrap();
      expect(warnSpy).toHaveBeenCalledWith(
        'These may be safe to remove. Disable with audit.warnOnUnused: false',
      );
    });

    it('suppresses warn output when warnOnUnused: false', () => {
      service.configure(
        ['OLD_KEY'],
        new Set(),
        { enabled: true, warnOnUnused: false, throwOnUnused: false },
      );
      service.onApplicationBootstrap();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('ignoreKeys', () => {
    it('excludes ignored keys from unused report', () => {
      service.configure(
        ['DATABASE_URL', 'NODE_ENV', 'OLD_KEY'],
        new Set(['DATABASE_URL']),
        { enabled: true, warnOnUnused: true, ignoreKeys: ['NODE_ENV'] },
      );
      service.onApplicationBootstrap();
      const calls = warnSpy.mock.calls.flat();
      expect(calls).not.toContain('  ✗ NODE_ENV');
      expect(calls).toContain('  ✗ OLD_KEY');
    });

    it('logs all-accounted when only ignored keys are unused', () => {
      service.configure(
        ['NODE_ENV'],
        new Set(),
        { enabled: true, ignoreKeys: ['NODE_ENV'] },
      );
      service.onApplicationBootstrap();
      expect(logSpy).toHaveBeenCalledWith('All environment variables are accounted for. ✓');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('ignorePrefixes', () => {
    it('excludes keys matching any ignored prefix from unused report', () => {
      service.configure(
        ['DATABASE_URL', 'npm_lifecycle_event', 'npm_config_cache'],
        new Set(['DATABASE_URL']),
        { enabled: true, warnOnUnused: true, ignorePrefixes: ['npm_'] },
      );
      service.onApplicationBootstrap();
      const calls = warnSpy.mock.calls.flat();
      expect(calls).not.toContain('  ✗ npm_lifecycle_event');
      expect(calls).not.toContain('  ✗ npm_config_cache');
    });

    it('logs all-accounted when only prefix-ignored keys are unused', () => {
      service.configure(
        ['npm_lifecycle_event'],
        new Set(),
        { enabled: true, ignorePrefixes: ['npm_'] },
      );
      service.onApplicationBootstrap();
      expect(logSpy).toHaveBeenCalledWith('All environment variables are accounted for. ✓');
    });
  });

  describe('throwOnUnused', () => {
    it('throws after logging when throwOnUnused: true', () => {
      service.configure(
        ['OLD_KEY', 'DEAD_VAR'],
        new Set(),
        { enabled: true, warnOnUnused: true, throwOnUnused: true },
      );
      expect(() => service.onApplicationBootstrap()).toThrow(
        'BetterConfig: 2 unused environment variable(s) detected.',
      );
      expect(warnSpy).toHaveBeenCalled();
    });

    it('does not throw when throwOnUnused: false', () => {
      service.configure(
        ['OLD_KEY'],
        new Set(),
        { enabled: true, throwOnUnused: false },
      );
      expect(() => service.onApplicationBootstrap()).not.toThrow();
    });

    it('does not throw when no unused vars even if throwOnUnused: true', () => {
      service.configure(
        ['DATABASE_URL'],
        new Set(['DATABASE_URL']),
        { enabled: true, throwOnUnused: true },
      );
      expect(() => service.onApplicationBootstrap()).not.toThrow();
    });
  });

  describe('custom reporter', () => {
    it('routes unused report through provided IReporter', () => {
      const reporter = {
        reportUnused: jest.fn(),
        reportAllAccounted: jest.fn(),
      };
      service.configure(['OLD_KEY'], new Set(), { enabled: true }, reporter);
      service.onApplicationBootstrap();
      expect(reporter.reportUnused).toHaveBeenCalledWith(['OLD_KEY']);
      expect(reporter.reportAllAccounted).not.toHaveBeenCalled();
    });

    it('routes all-accounted report through provided IReporter', () => {
      const reporter = {
        reportUnused: jest.fn(),
        reportAllAccounted: jest.fn(),
      };
      service.configure(
        ['DATABASE_URL'],
        new Set(['DATABASE_URL']),
        { enabled: true },
        reporter,
      );
      service.onApplicationBootstrap();
      expect(reporter.reportAllAccounted).toHaveBeenCalled();
      expect(reporter.reportUnused).not.toHaveBeenCalled();
    });
  });

  describe('enabled: false', () => {
    it('skips all audit logic silently', () => {
      service.configure(['OLD_KEY', 'DEAD_VAR'], new Set(), { enabled: false });
      service.onApplicationBootstrap();
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not throw even when throwOnUnused: true', () => {
      service.configure(
        ['OLD_KEY'],
        new Set(),
        { enabled: false, throwOnUnused: true },
      );
      expect(() => service.onApplicationBootstrap()).not.toThrow();
    });
  });
});
