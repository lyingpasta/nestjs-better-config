import {
  InjectionToken,
  ModuleMetadata,
  OptionalFactoryDependency,
} from '@nestjs/common';
import { BetterConfigOptions } from './better-config-options.interface';

export interface BetterConfigAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  /** Builds the options, synchronously or asynchronously. */
  useFactory: (
    ...args: any[]
  ) => BetterConfigOptions | Promise<BetterConfigOptions>;
  /** Providers injected into `useFactory` as arguments, in order. */
  inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
