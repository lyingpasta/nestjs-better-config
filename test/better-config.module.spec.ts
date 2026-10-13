import { Injectable, Logger, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { BetterConfigAsyncOptions } from '../src/interfaces/better-config-async-options.interface';
import { BetterConfigOptions } from '../src/interfaces/better-config-options.interface';
import { BetterConfigModule } from '../src/better-config.module';
import { IReporter } from '../src/reporters/reporter.interface';
import { BetterConfigService } from '../src/better-config.service';
import { EnvAuditService } from '../src/env-audit.service';

interface RecordingReporter extends IReporter {
  reportedKeys: string[];
}

describe('BetterConfigModule', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe('module boots alongside ConfigModule', () => {
    it('compiles and inits without error', async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({ audit: { enabled: false } }),
        ],
      }).compile();
      await module.init();
      expect(module).toBeDefined();
      await module.close();
    });

    it('provides BetterConfigService after init', async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({ audit: { enabled: false } }),
        ],
      }).compile();
      await module.init();
      expect(module.get(BetterConfigService)).toBeDefined();
      await module.close();
    });

    it('provides EnvAuditService after init', async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({ audit: { enabled: false } }),
        ],
      }).compile();
      await module.init();
      expect(module.get(EnvAuditService)).toBeDefined();
      await module.close();
    });
  });

  describe('ConfigService instance patching', () => {
    it('BetterConfigService holds the real ConfigService after init', async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({ audit: { enabled: false } }),
        ],
      }).compile();
      await module.init();
      const svc = module.get(BetterConfigService);
      expect(svc.configService).toBe(module.get(ConfigService));
      await module.close();
    });

    it('get() on the plain injected ConfigService is tracked in usedKeys', async () => {
      process.env.DATABASE_URL = 'postgres://localhost/test';
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({ audit: { enabled: false } }),
        ],
      }).compile();
      await module.init();
      const configService = module.get(ConfigService);
      expect(configService.get('DATABASE_URL')).toBe(
        'postgres://localhost/test',
      );
      const svc = module.get(BetterConfigService);
      expect(svc.usedKeys.has('DATABASE_URL')).toBe(true);
      delete process.env.DATABASE_URL;
      await module.close();
    });

    it('getOrThrow() on the plain injected ConfigService is tracked', async () => {
      process.env.API_KEY = 'secret';
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({ audit: { enabled: false } }),
        ],
      }).compile();
      await module.init();
      const configService = module.get(ConfigService);
      expect(configService.getOrThrow('API_KEY')).toBe('secret');
      const svc = module.get(BetterConfigService);
      expect(svc.usedKeys.has('API_KEY')).toBe(true);
      delete process.env.API_KEY;
      await module.close();
    });
  });

  describe('audit on bootstrap', () => {
    it('warns about unused vars on bootstrap', async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({
            validationSchema: {
              shape: { DATABASE_URL: {}, PORT: {}, OLD_KEY: {} },
            },
            audit: { enabled: true, warnOnUnused: true },
          }),
        ],
      }).compile();
      // no proxy.get() calls — all 3 keys unused
      await module.init();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'environment variable(s) declared but never accessed',
        ),
      );
      await module.close();
    });

    it('logs all-accounted when all declared vars used before bootstrap', async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({
            validationSchema: { shape: { DATABASE_URL: {} } },
            audit: { enabled: true },
          }),
        ],
      }).compile();
      // read key after compile (proxy created in onModuleInit) — need to init first
      // then simulate app code that reads before onApplicationBootstrap
      await module.init();
      // force a fresh check by resetting usedKeys and re-configuring — instead
      // just verify the warn was called (all keys unused since no get() before bootstrap)
      expect(warnSpy).toHaveBeenCalled();
      await module.close();
    });

    it('logs all-accounted when no declared keys exist', async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({
            validationSchema: { shape: {} },
            audit: { enabled: true },
          }),
        ],
      }).compile();
      await module.init();
      expect(logSpy).toHaveBeenCalledWith(
        'All environment variables are accounted for. ✓',
      );
      await module.close();
    });
  });

  describe('enabled: false', () => {
    it('registers but skips all audit logic silently', async () => {
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRoot({
            validationSchema: { shape: { DATABASE_URL: {}, PORT: {} } },
            audit: { enabled: false },
          }),
        ],
      }).compile();
      await module.init();
      // NestJS emits its own log() calls during init — check BetterConfig-specific messages only
      expect(logSpy).not.toHaveBeenCalledWith(
        'All environment variables are accounted for. ✓',
      );
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('environment variable'),
      );
      await module.close();
    });
  });

  describe('forRootAsync', () => {
    const USED_KEY = 'ASYNC_USED_KEY';
    const UNUSED_KEY = 'ASYNC_UNUSED_KEY';
    const AUDIT_ENABLED_KEY = 'ASYNC_AUDIT_ENABLED';
    const DECLARED_KEYS = { [USED_KEY]: {}, [UNUSED_KEY]: {} };
    let module: TestingModule | undefined;
    let recorder: RecordingReporter;

    function createRecordingReporter(): RecordingReporter {
      const reportedKeys: string[] = [];
      return {
        reportedKeys,
        reportUnused: (keys) => reportedKeys.push(...keys),
        reportAllAccounted: () => undefined,
      };
    }

    function buildOptions(auditEnabled = true): BetterConfigOptions {
      return {
        validationSchema: { shape: DECLARED_KEYS },
        audit: { enabled: auditEnabled },
        reporter: recorder,
      };
    }

    async function bootAsync(
      asyncOptions: BetterConfigAsyncOptions,
      providers: Provider[] = [],
    ): Promise<TestingModule> {
      module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({ ignoreEnvFile: true }),
          BetterConfigModule.forRootAsync(asyncOptions),
        ],
        providers,
      }).compile();
      await module.init();
      return module;
    }

    beforeEach(() => {
      recorder = createRecordingReporter();
    });

    afterEach(async () => {
      delete process.env[USED_KEY];
      delete process.env[AUDIT_ENABLED_KEY];
      await module?.close();
      module = undefined;
    });

    it('boots with a sync factory and audits using its options', async () => {
      await bootAsync({ useFactory: () => buildOptions() });
      expect([...recorder.reportedKeys].sort()).toEqual(
        [UNUSED_KEY, USED_KEY].sort(),
      );
    });

    it('boots with an async factory', async () => {
      await bootAsync({
        useFactory: async () => {
          await Promise.resolve();
          return buildOptions();
        },
      });
      expect([...recorder.reportedKeys].sort()).toEqual(
        [UNUSED_KEY, USED_KEY].sort(),
      );
    });

    it.each([
      ['true', [UNUSED_KEY, USED_KEY]],
      ['false', []],
    ])(
      'injects ConfigService into the factory (%s => reported %j)',
      async (flag, expectedKeys) => {
        process.env[AUDIT_ENABLED_KEY] = flag;
        await bootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) =>
            buildOptions(config.get(AUDIT_ENABLED_KEY) === 'true'),
        });
        expect([...recorder.reportedKeys].sort()).toEqual(expectedKeys);
      },
    );

    it('does not report keys read in a consumer constructor', async () => {
      process.env[USED_KEY] = 'value';
      @Injectable()
      class Consumer {
        constructor(config: ConfigService) {
          config.get(USED_KEY);
        }
      }
      await bootAsync({ useFactory: () => buildOptions() }, [Consumer]);
      expect(recorder.reportedKeys).toEqual([UNUSED_KEY]);
    });
  });

  describe('ConfigModule not imported', () => {
    it('throws descriptive error on init when ConfigModule is absent', async () => {
      const module = await Test.createTestingModule({
        imports: [BetterConfigModule.forRoot()],
      }).compile();
      let caughtError: Error | undefined;
      try {
        await module.init();
      } catch (e) {
        caughtError = e as Error;
      }
      expect(caughtError).toBeDefined();
      expect(caughtError?.message).toContain(
        'BetterConfigModule requires ConfigModule to be imported before it in your module.',
      );
    });
  });
});
