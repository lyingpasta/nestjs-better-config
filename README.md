# nestjs-better-config

[![npm](https://img.shields.io/npm/v/nestjs-better-config)](https://www.npmjs.com/package/nestjs-better-config)
[![CI](https://github.com/lyingpasta/nestjs-better-config/actions/workflows/ci.yml/badge.svg)](https://github.com/lyingpasta/nestjs-better-config/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/nestjs-better-config)](./LICENSE)

Warns you at startup about environment variables that are declared but never
actually read by your NestJS app.

Every long-lived project accumulates them: the `.env` grows, features get
removed, and nobody dares delete `LEGACY_REDIS_URL` because *maybe something
still uses it*. This module answers that question. It watches every
`ConfigService.get()` and `getOrThrow()` call during startup, compares the
keys you read against the keys you declared, and prints the difference.

```
[Nest] WARN  [BetterConfig] 3 environment variable(s) declared but never accessed:
[Nest] WARN  [BetterConfig]   ✗ OLD_STRIPE_WEBHOOK_SECRET
[Nest] WARN  [BetterConfig]   ✗ LEGACY_REDIS_URL
[Nest] WARN  [BetterConfig]   ✗ DEPRECATED_API_KEY
[Nest] WARN  [BetterConfig] These may be safe to remove. Disable with audit.warnOnUnused: false
```

## Installation

```bash
npm install nestjs-better-config
```

Peer dependencies: `@nestjs/common ^10`, `@nestjs/core ^10`, `@nestjs/config ^3`.

## Usage

Keep your existing `ConfigModule` setup as is and register
`BetterConfigModule` next to it:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BetterConfigModule } from 'nestjs-better-config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('3000'),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    BetterConfigModule.forRoot({
      validationSchema: envSchema,
    }),
  ],
})
export class AppModule {}
```

That's the whole migration. Your services keep injecting `ConfigService` and
reading config exactly as before; nothing else changes.

The audit runs on `onApplicationBootstrap` and is enabled by default whenever
`NODE_ENV` is not `production`.

## Where the declared key list comes from

You have two options.

**A Zod schema.** Pass the same schema you already give to `ConfigModule`.
The key list is taken from `schema.shape`, so Zod stays a dev dependency of
your app, not of this package.

**A `.env` file.** If you don't use a schema, point `envFilePath` at your env
file (defaults to `.env` in the working directory). The file is parsed with
`dotenv.parse()` only; `dotenv.config()` is never called, so `process.env` is
not touched.

```typescript
BetterConfigModule.forRoot({
  envFilePath: '.env.production',
})
```

When both are provided, the schema wins.

## Options

```typescript
BetterConfigModule.forRoot({
  validationSchema: envSchema,
  envFilePath: '.env',
  audit: {
    enabled: true,
    warnOnUnused: true,
    throwOnUnused: false,
    ignoreKeys: ['NODE_ENV', 'TZ'],
    ignorePrefixes: ['npm_', 'VERCEL_'],
  },
})
```

| Option | Default | |
|---|---|---|
| `audit.enabled` | `NODE_ENV !== 'production'` | Master switch for the whole audit. |
| `audit.warnOnUnused` | `true` | Log a warning listing unused keys. |
| `audit.throwOnUnused` | `false` | Throw after logging. Useful in CI. |
| `audit.ignoreKeys` | `[]` | Exact keys to leave out of the report. |
| `audit.ignorePrefixes` | `[]` | Ignore any key starting with one of these. |
| `reporter` | `ConsoleReporter` | Custom `IReporter` implementation, see below. |

`ignoreKeys` and `ignorePrefixes` are handy for variables that exist for the
platform rather than for your code, like the `npm_*` family npm injects into
every process.

## Failing CI on unused variables

```typescript
BetterConfigModule.forRoot({
  validationSchema: envSchema,
  audit: {
    throwOnUnused: process.env.CI === 'true',
  },
})
```

The unused key list is logged before the throw, so the CI output tells you
what to clean up.

## Custom reporters

If warnings in the Nest logger aren't where you want this information,
implement `IReporter` and pass it in:

```typescript
import { IReporter } from 'nestjs-better-config';

class SlackReporter implements IReporter {
  reportUnused(keys: string[]) {
    // post to a channel, emit a metric, whatever fits your setup
  }
  reportAllAccounted() {}
}

BetterConfigModule.forRoot({
  validationSchema: envSchema,
  reporter: new SlackReporter(),
})
```

## How it works

`forRoot()` wraps `get` and `getOrThrow` on `ConfigService.prototype` at
module definition time, before Nest instantiates any provider. That ordering
matters: most config reads happen in constructors, which run before any
lifecycle hook fires, so patching later would miss them. Each accessed key
lands in a set, and at `onApplicationBootstrap` that set is diffed against
the declared keys.

There are no DI overrides and no wrapper service to inject. The trade-off is
a prototype patch, which is honest to name for what it is: a monkey-patch. It
is applied once, adds a set insertion per read, and is a no-op for behavior.

## Reading config the audit can see

The snapshot is taken at `onApplicationBootstrap`, so a key only counts as
used if it is read during bootstrap. In practice that means reading config in
constructors, provider factories, or `onModuleInit` — capturing values into
fields — rather than calling `configService.get()` lazily wherever the value
is needed:

```typescript
// ✅ Counted — read once at construction, cached in a field
@Injectable()
export class MailService {
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow('MAIL_API_KEY');
  }
}

// ❌ Not counted — first read happens at request time, after bootstrap
@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  send() {
    const apiKey = this.config.getOrThrow('MAIL_API_KEY');
  }
}
```

The eager style is worth adopting regardless of this module: a missing or
malformed variable fails at startup, not on the first request that happens to
need it. For keys that genuinely can only be read later, list them in
`ignoreKeys`.

## Limitations

- Only reads that happen up to `onApplicationBootstrap` are counted — see
  [Reading config the audit can see](#reading-config-the-audit-can-see). A key
  read for the first time inside a request handler or a cron job will show up
  as unused even though it isn't. If you have keys like that, put them in
  `ignoreKeys`.
- `forRootAsync` isn't implemented yet, so options can't come from an async
  factory.

Planned next: `forRootAsync`, and further out an ESLint plugin so the same
check can run statically at lint time instead of at runtime.

## Contributing

Bug reports and PRs welcome. Run `npm test` and `npm run lint` before
opening one.

## License

[MIT](./LICENSE)
