// Smoke test: NestJS 12 ships ESM-only, which Jest (CommonJS) cannot load,
// so this boots a real Nest 12 app against the packed library instead.
// Exits non-zero when the audit does not report exactly the unused key.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BetterConfigModule } from 'nestjs-better-config';

const USED_KEY = 'SMOKE_USED_KEY';
const UNUSED_KEY = 'SMOKE_UNUSED_KEY';
const USED_VALUE = 'used';

process.env[USED_KEY] = USED_VALUE;
process.env[UNUSED_KEY] = 'unused';

// Duck-typed Zod schema: the library only reads `shape` keys.
const declaredKeysSchema = { shape: { [USED_KEY]: {}, [UNUSED_KEY]: {} } };

class RecordingReporter {
  unusedKeys = [];
  reportUnused(keys) {
    this.unusedKeys = keys;
  }
  reportAllAccounted() {}
}

// Reads config in its constructor, before any lifecycle hook runs.
class Consumer {
  constructor(configService) {
    this.value = configService.get(USED_KEY);
  }
}
Injectable()(Consumer);
Reflect.defineMetadata('design:paramtypes', [ConfigService], Consumer);

function buildAppModule(reporter) {
  class AppModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ ignoreEnvFile: true }),
      BetterConfigModule.forRoot({
        validationSchema: declaredKeysSchema,
        audit: { enabled: true },
        reporter,
      }),
    ],
    providers: [Consumer],
  })(AppModule);
  return AppModule;
}

async function main() {
  const reporter = new RecordingReporter();
  const app = await NestFactory.createApplicationContext(
    buildAppModule(reporter),
    { logger: false },
  );

  assert.equal(app.get(Consumer).value, USED_VALUE);
  assert.deepEqual(reporter.unusedKeys, [UNUSED_KEY]);

  await app.close();
  console.log('Nest 12 smoke test passed');
}

await main();
