# better-config

Companion module for `@nestjs/config` that warns you about environment variables that were declared but never accessed — with zero migration cost.

## Install

```bash
# npm
npm install better-config

# yarn
yarn add better-config

# pnpm
pnpm add better-config
```

> **Peer dependencies:** `@nestjs/common ^10`, `@nestjs/core ^10`, `@nestjs/config ^3`

---

## Setup

`ConfigModule` stays **completely untouched**. Just add `BetterConfigModule` alongside it.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BetterConfigModule } from 'better-config';
import { z } from 'zod';

@Module({
  imports: [
    // ── before: unchanged ──────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: z.object({
        DATABASE_URL: z.string().url(),
        PORT: z.string().default('3000'),
      }),
    }),

    // ── after: just add this ────────────────────────────────────
    BetterConfigModule.forRoot({
      validationSchema: z.object({
        DATABASE_URL: z.string().url(),
        PORT: z.string().default('3000'),
      }),
      envFilePath: '.env',
      audit: {
        enabled: true,
        warnOnUnused: true,
        throwOnUnused: false,
        ignoreKeys: ['NODE_ENV'],
        ignorePrefixes: ['npm_'],
      },
    }),
  ],
})
export class AppModule {}
```

---

## Startup output

When unused variables are found:

```
[Nest] WARN  [BetterConfig] 3 environment variable(s) declared but never accessed:
[Nest] WARN  [BetterConfig]   ✗ OLD_STRIPE_WEBHOOK_SECRET
[Nest] WARN  [BetterConfig]   ✗ LEGACY_REDIS_URL
[Nest] WARN  [BetterConfig]   ✗ DEPRECATED_API_KEY
[Nest] WARN  [BetterConfig] These may be safe to remove. Disable with audit.warnOnUnused: false
```

When all variables are accounted for:

```
[Nest] LOG   [BetterConfig] All environment variables are accounted for. ✓
```

---

## Audit options

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `NODE_ENV !== 'production'` | Master switch. When `false`, module registers but all audit logic is skipped — zero overhead. |
| `warnOnUnused` | `boolean` | `true` | Log a `WARN` for each undeclared variable. |
| `throwOnUnused` | `boolean` | `false` | Throw an `Error` after logging when unused variables are found. Set `true` in CI. |
| `ignoreKeys` | `string[]` | `[]` | Exact key names to exclude from the unused report. |
| `ignorePrefixes` | `string[]` | `[]` | Key prefixes to exclude. Any key starting with a listed prefix is ignored. |

---

## Zod schema integration

Pass the same Zod schema you use in `ConfigModule`. `better-config` extracts the declared key list from `schema.shape` — Zod is never imported as a hard dependency.

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('3000'),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    BetterConfigModule.forRoot({
      validationSchema: envSchema,        // same object — or a separate copy
      audit: { enabled: true },
    }),
  ],
})
export class AppModule {}
```

---

## `.env` fallback (no schema)

No Zod schema? Pass `envFilePath` and `better-config` parses the file with `dotenv.parse()` to build the declared key list. `dotenv.config()` is never called — no side effects to `process.env`.

```typescript
BetterConfigModule.forRoot({
  envFilePath: '.env',
  audit: { enabled: true },
})
```

If `envFilePath` is omitted too, it falls back to `.env` in the current working directory.

---

## CI usage

Set `throwOnUnused: true` to fail the process when unused variables are detected:

```typescript
BetterConfigModule.forRoot({
  validationSchema: envSchema,
  audit: {
    enabled: true,
    throwOnUnused: process.env.CI === 'true',
  },
})
```

`better-config` logs the unused key list before throwing, so you always know what to clean up.

---

## Ignoring keys and prefixes

```typescript
BetterConfigModule.forRoot({
  validationSchema: envSchema,
  audit: {
    enabled: true,
    // exact keys — e.g. always-present runtime variables
    ignoreKeys: ['NODE_ENV', 'TZ'],
    // prefixes — e.g. npm injects dozens of npm_* variables into process.env
    ignorePrefixes: ['npm_', 'NEXT_', 'VERCEL_'],
  },
})
```

---

## Known limitations

- **Lazy config reads are not tracked.** Keys accessed inside request handlers, cron jobs, event listeners, or any code that runs after `onApplicationBootstrap` will not appear in `usedKeys`. They will be reported as unused even if they are actively consumed. This is a documented v0 caveat — see the Roadmap.
- **`forRootAsync` is not yet supported.** If you need async config factories (e.g. reading schema from a remote source), wait for v1.

---

## Roadmap

**v1**
- `forRootAsync` support — async config factories, `useFactory`, `useClass`
- ESLint plugin (`eslint-plugin-better-config`) — static analysis of `configService.get()` calls at lint time

**v2**
- TypeScript compiler plugin — full static analysis without runtime tracking
- Request-scoped and lazy config tracking

---

## Contributing

1. Fork the repo and create a feature branch
2. `npm install`
3. Make your changes — ensure `npm run lint` and `npm test` pass
4. Open a pull request with a clear description of the change

All contributions welcome: bug reports, feature requests, documentation improvements.

---

## License

MIT
