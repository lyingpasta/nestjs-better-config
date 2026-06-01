import { ConfigService } from '@nestjs/config';

export class BetterConfigService {
  readonly usedKeys = new Set<string>();
  readonly proxy: ConfigService;

  constructor(configService: ConfigService) {
    this.proxy = this.createProxy(configService);
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
