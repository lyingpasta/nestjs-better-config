import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';

const logger = new Logger('BetterConfig');

export interface EnvReaderOptions {
  validationSchema?: unknown;
  envFilePath?: string;
  ignoreKeys?: string[];
  ignorePrefixes?: string[];
}

function isZodSchema(
  schema: unknown,
): schema is { shape: Record<string, unknown> } {
  return (
    schema !== null &&
    typeof schema === 'object' &&
    'shape' in schema &&
    typeof (schema as Record<string, unknown>).shape === 'object' &&
    (schema as Record<string, unknown>).shape !== null
  );
}

function parseEnvFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return Object.keys(dotenv.parse(content));
  } catch {
    logger.warn(`Could not read env file: ${filePath}`);
    return [];
  }
}

export function resolveEnvKeys(options: EnvReaderOptions): string[] {
  const {
    validationSchema,
    envFilePath,
    ignoreKeys = [],
    ignorePrefixes = [],
  } = options;

  let keys: string[];

  if (isZodSchema(validationSchema)) {
    // Zod schema is present — use it even when empty (don't fall back)
    keys = Object.keys(validationSchema.shape);
  } else {
    const filePath = envFilePath ?? '.env';
    keys = parseEnvFile(filePath);
  }

  return keys.filter(
    (key) =>
      !ignoreKeys.includes(key) &&
      !ignorePrefixes.some((prefix) => key.startsWith(prefix)),
  );
}
