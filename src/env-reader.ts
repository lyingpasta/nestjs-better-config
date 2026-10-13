import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
import { DEFAULT_ENV_FILE_PATH, LOGGER_CONTEXT } from './constants';
import { isIgnoredKey } from './key-filter';

const ENV_FILE_ENCODING = 'utf-8';

const logger = new Logger(LOGGER_CONTEXT);

export interface EnvReaderOptions {
  validationSchema?: unknown;
  envFilePath?: string;
  ignoreKeys?: string[];
  ignorePrefixes?: string[];
}

function isZodSchema(
  schema: unknown,
): schema is { shape: Record<string, unknown> } {
  if (schema === null || typeof schema !== 'object') return false;
  if (!('shape' in schema)) return false;
  const candidate = schema as Record<string, unknown>;
  return typeof candidate.shape === 'object' && candidate.shape !== null;
}

function parseEnvFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, ENV_FILE_ENCODING);
    return Object.keys(dotenv.parse(content));
  } catch {
    logger.warn(`Could not read env file: ${filePath}`);
    return [];
  }
}

function readDeclaredKeys(
  validationSchema: unknown,
  envFilePath: string | undefined,
): string[] {
  if (isZodSchema(validationSchema)) {
    return Object.keys(validationSchema.shape);
  }
  return parseEnvFile(envFilePath ?? DEFAULT_ENV_FILE_PATH);
}

export function resolveEnvKeys(options: EnvReaderOptions): string[] {
  const {
    validationSchema,
    envFilePath,
    ignoreKeys = [],
    ignorePrefixes = [],
  } = options;
  const rules = { ignoreKeys, ignorePrefixes };

  function isKept(key: string): boolean {
    return !isIgnoredKey(key, rules);
  }

  return readDeclaredKeys(validationSchema, envFilePath).filter(isKept);
}
