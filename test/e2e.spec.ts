import { Injectable, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { BetterConfigModule } from '../src/better-config.module';

// Real-world consumer: injects plain ConfigService, no better-config imports.
@Injectable()
class DatabaseService {
  readonly url: string;
  constructor(config: ConfigService) {
    this.url = config.getOrThrow('DATABASE_URL');
  }
}

@Injectable()
class HttpService {
  readonly port: string;
  constructor(config: ConfigService) {
    this.port = config.get('PORT', '3000');
  }
}

describe('e2e: zero-migration tracking through plain ConfigService', () => {
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://localhost/e2e';
    process.env.PORT = '4000';
    process.env.UNUSED_LEGACY_KEY = 'stale';
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.PORT;
    delete process.env.UNUSED_LEGACY_KEY;
    jest.restoreAllMocks();
  });

  const declaredSchema = {
    shape: {
      DATABASE_URL: {},
      PORT: {},
      UNUSED_LEGACY_KEY: {},
    },
  };

  async function bootApp() {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        BetterConfigModule.forRoot({
          validationSchema: declaredSchema,
          audit: { enabled: true },
        }),
      ],
      providers: [DatabaseService, HttpService],
    }).compile();
    await module.init(); // runs onModuleInit + onApplicationBootstrap
    return module;
  }

  it('keys read via plain ConfigService injection are not reported unused', async () => {
    const module = await bootApp();

    expect(module.get(DatabaseService).url).toBe('postgres://localhost/e2e');
    expect(module.get(HttpService).port).toBe('4000');

    const warnings = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(warnings.some((w) => w.includes('DATABASE_URL'))).toBe(false);
    expect(warnings.some((w) => w.includes('PORT'))).toBe(false);

    await module.close();
  });

  it('declared but never-read key is reported unused at bootstrap', async () => {
    const module = await bootApp();

    const warnings = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(warnings.some((w) => w.includes('UNUSED_LEGACY_KEY'))).toBe(true);
    expect(
      warnings.some((w) => w.includes('1 environment variable(s) declared')),
    ).toBe(true);

    await module.close();
  });

  it('logs all-accounted-for when every declared key is read', async () => {
    const schema = { shape: { DATABASE_URL: {}, PORT: {} } };
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        BetterConfigModule.forRoot({
          validationSchema: schema,
          audit: { enabled: true },
        }),
      ],
      providers: [DatabaseService, HttpService],
    }).compile();
    await module.init();

    const logs = logSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('accounted for'))).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();

    await module.close();
  });
});
