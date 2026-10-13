import {
  DynamicModule,
  Inject,
  Module,
  OnModuleInit,
  Provider,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { BetterConfigAsyncOptions } from './interfaces/better-config-async-options.interface';
import { BetterConfigOptions } from './interfaces/better-config-options.interface';
import {
  BetterConfigService,
  trackConfigServiceKeys,
} from './better-config.service';
import { EnvAuditService } from './env-audit.service';
import { resolveEnvKeys } from './env-reader';

const BETTER_CONFIG_OPTIONS = 'BETTER_CONFIG_OPTIONS';
const MISSING_CONFIG_MODULE_ERROR =
  'BetterConfigModule requires ConfigModule to be imported before it in your module.';

@Module({})
export class BetterConfigModule implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(BETTER_CONFIG_OPTIONS)
    private readonly options: BetterConfigOptions,
    private readonly betterConfigService: BetterConfigService,
    private readonly envAuditService: EnvAuditService,
  ) {}

  static forRoot(options: BetterConfigOptions = {}): DynamicModule {
    return BetterConfigModule.buildModule({
      provide: BETTER_CONFIG_OPTIONS,
      useValue: options,
    });
  }

  static forRootAsync(asyncOptions: BetterConfigAsyncOptions): DynamicModule {
    return BetterConfigModule.buildModule(
      {
        provide: BETTER_CONFIG_OPTIONS,
        useFactory: asyncOptions.useFactory,
        inject: asyncOptions.inject ?? [],
      },
      asyncOptions.imports,
    );
  }

  private static buildModule(
    optionsProvider: Provider,
    imports: DynamicModule['imports'] = [],
  ): DynamicModule {
    // Patch ConfigService.prototype now — module definition time — so key
    // reads in consumer constructors (which run before lifecycle hooks) are
    // already tracked.
    const usedKeys = trackConfigServiceKeys();
    return {
      module: BetterConfigModule,
      imports,
      providers: [
        optionsProvider,
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
    this.betterConfigService.initialize(this.resolveConfigService());
    this.configureAudit();
  }

  private resolveConfigService(): ConfigService {
    const configService = this.findConfigService();
    if (!configService) throw new Error(MISSING_CONFIG_MODULE_ERROR);
    return configService;
  }

  private findConfigService(): ConfigService | undefined {
    try {
      return this.moduleRef.get(ConfigService, { strict: false });
    } catch {
      // moduleRef.get may throw in strict mode — treat as not found
      return undefined;
    }
  }

  private configureAudit(): void {
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
      this.options.reporter,
    );
  }
}
