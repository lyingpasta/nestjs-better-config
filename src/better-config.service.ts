import { ConfigService } from '@nestjs/config';

const PATCHED = Symbol('BetterConfigPatched');

export class BetterConfigService {
  readonly usedKeys = new Set<string>();
  private _configService?: ConfigService;

  constructor(configService?: ConfigService) {
    if (configService !== undefined) {
      this.initialize(configService);
    }
  }

  get configService(): ConfigService {
    if (!this._configService) {
      throw new Error(
        'BetterConfigService not initialized — ensure BetterConfigModule is properly imported.',
      );
    }
    return this._configService;
  }

  /**
   * Patches `get` and `getOrThrow` on the ConfigService instance in place,
   * recording every accessed key. All consumers injecting ConfigService share
   * the singleton instance, so no DI changes are needed. Idempotent.
   */
  initialize(configService: ConfigService): void {
    this._configService = configService;

    const target = configService as ConfigService & { [PATCHED]?: boolean };
    if (target[PATCHED]) {
      return;
    }
    target[PATCHED] = true;

    const usedKeys = this.usedKeys;
    for (const method of ['get', 'getOrThrow'] as const) {
      const original = (target[method] as (...args: unknown[]) => unknown).bind(
        target,
      );
      (target as any)[method] = (key: string, ...rest: unknown[]) => {
        usedKeys.add(key);
        return original(key, ...rest);
      };
    }
  }
}
