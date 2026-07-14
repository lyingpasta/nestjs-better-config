import {
  DynamicModule,
  Inject,
  Module,
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { BetterConfigOptions } from './interfaces/better-config-options.interface';
import {
  BetterConfigService,
  trackConfigServiceKeys,
} from './better-config.service';
import { EnvAuditService } from './env-audit.service';
import { resolveEnvKeys } from './env-reader';

const BETTER_CONFIG_OPTIONS = 'BETTER_CONFIG_OPTIONS';

@Module({})
export class BetterConfigModule implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(BETTER_CONFIG_OPTIONS) private readonly options: BetterConfigOptions,
    private readonly betterConfigService: BetterConfigService,
    private readonly envAuditService: EnvAuditService,
  ) {}

  // TODO: implement forRootAsync (v1) — needed for async config factories
  static forRoot(options: BetterConfigOptions = {}): DynamicModule {
    // Patch ConfigService.prototype now — module definition time — so key
    // reads in consumer constructors (which run before lifecycle hooks) are
    // already tracked.
    const usedKeys = trackConfigServiceKeys();
    return {
      module: BetterConfigModule,
      providers: [
        { provide: BETTER_CONFIG_OPTIONS, useValue: options },
        {
          provide: BetterConfigService,
          useFactory: () => new BetterConfigService(usedKeys),
        },
        EnvAuditService,
      ],
      exports: [BetterConfigService, EnvAuditService],
    };
  }

  onModuleInit(): void {
    let configService: ConfigService | undefined;
    try {
      configService = this.moduleRef.get(ConfigService, { strict: false });
    } catch {
      // moduleRef.get may throw in strict mode — fall through to null check
    }
    if (!configService) {
      throw new Error(
        'BetterConfigModule requires ConfigModule to be imported before it in your module.',
      );
    }

    this.betterConfigService.initialize(configService);

    const auditOptions = this.options.audit ?? {};
    const declaredKeys = resolveEnvKeys({
      validationSchema: this.options.validationSchema,
      envFilePath: this.options.envFilePath,
      ignoreKeys: auditOptions.ignoreKeys,
      ignorePrefixes: auditOptions.ignorePrefixes,
    });
    this.envAuditService.configure(
      declaredKeys,
      this.betterConfigService.usedKeys,
      auditOptions,
    );
  }
}
