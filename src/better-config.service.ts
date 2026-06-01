import { ConfigService } from '@nestjs/config';

export class BetterConfigService {
  readonly usedKeys = new Set<string>();
  private _proxy?: ConfigService;

  constructor(configService?: ConfigService) {
    if (configService !== undefined) {
      this._proxy = this.createProxy(configService);
    }
  }

  get proxy(): ConfigService {
    if (!this._proxy) {
      throw new Error(
        'BetterConfigService not initialized — ensure BetterConfigModule is properly imported.',
      );
    }
    return this._proxy;
  }

  initialize(configService: ConfigService): void {
    if (!this._proxy) {
      this._proxy = this.createProxy(configService);
    }
  }

  private createProxy(configService: ConfigService): ConfigService {
    const usedKeys = this.usedKeys;
    return new Proxy(configService, {
      get(target, prop, receiver) {
        if (prop === 'get') {
          return (key: string, defaultValue?: unknown) => {
            usedKeys.add(key);
            return defaultValue !== undefined
              ? (target as any).get(key, defaultValue)
              : (target as any).get(key);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }
}
