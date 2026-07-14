import { ConfigService } from '@nestjs/config';

const PATCHED = Symbol.for('nestjs-better-config:patched');
const ACTIVE_SET = Symbol.for('nestjs-better-config:active-set');

type PatchedPrototype = {
  [PATCHED]?: boolean;
  [ACTIVE_SET]?: Set<string>;
} & Record<'get' | 'getOrThrow', (...args: unknown[]) => unknown>;

/**
 * Patches `get` and `getOrThrow` on ConfigService.prototype so every key
 * access — including reads in consumer constructors, which run before any
 * lifecycle hook — is recorded. Returns the Set that receives the keys.
 *
 * Must run before consumers are instantiated; `forRoot()` calls it at module
 * definition time. Each call starts a fresh Set (one active audit per
 * process); the prototype is only wrapped once.
 */
export function trackConfigServiceKeys(): Set<string> {
  const proto = ConfigService.prototype as unknown as PatchedPrototype;
  const usedKeys = new Set<string>();
  proto[ACTIVE_SET] = usedKeys;

  if (!proto[PATCHED]) {
    proto[PATCHED] = true;
    for (const method of ['get', 'getOrThrow'] as const) {
      const original = proto[method];
      proto[method] = function (this: unknown, ...args: unknown[]) {
        proto[ACTIVE_SET]?.add(String(args[0]));
        return original.apply(this, args);
      };
    }
  }

  return usedKeys;
}

export class BetterConfigService {
  private _configService?: ConfigService;

  constructor(readonly usedKeys: Set<string> = new Set()) {}

  get configService(): ConfigService {
    if (!this._configService) {
      throw new Error(
        'BetterConfigService not initialized — ensure BetterConfigModule is properly imported.',
      );
    }
    return this._configService;
  }

  initialize(configService: ConfigService): void {
    this._configService = configService;
  }
}
