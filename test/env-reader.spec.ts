import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import { resolveEnvKeys } from '../src/env-reader';

jest.mock('fs');

describe('resolveEnvKeys', () => {
  const mockReadFileSync = jest.mocked(fs.readFileSync);
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('Zod schema source', () => {
    it('extracts keys from schema.shape', () => {
      const schema = { shape: { DATABASE_URL: {}, PORT: {}, NODE_ENV: {} } };
      expect(resolveEnvKeys({ validationSchema: schema })).toEqual([
        'DATABASE_URL',
        'PORT',
        'NODE_ENV',
      ]);
    });

    it('returns empty array for empty schema shape without warning', () => {
      const schema = { shape: {} };
      const result = resolveEnvKeys({ validationSchema: schema });
      expect(result).toEqual([]);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not read .env when Zod-like schema provided (even empty)', () => {
      const schema = { shape: {} };
      resolveEnvKeys({ validationSchema: schema });
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });
  });

  describe('.env file fallback', () => {
    it('parses specified envFilePath when no schema provided', () => {
      mockReadFileSync.mockReturnValue('DATABASE_URL=postgres\nPORT=3000\n' as any);
      const result = resolveEnvKeys({ envFilePath: '.env.test' });
      expect(result).toEqual(['DATABASE_URL', 'PORT']);
      expect(mockReadFileSync).toHaveBeenCalledWith('.env.test', 'utf-8');
    });

    it('falls back to .env in cwd when neither schema nor envFilePath provided', () => {
      mockReadFileSync.mockReturnValue('FOO=bar\n' as any);
      resolveEnvKeys({});
      expect(mockReadFileSync).toHaveBeenCalledWith('.env', 'utf-8');
    });

    it('falls back to .env when non-Zod object passed as validationSchema', () => {
      mockReadFileSync.mockReturnValue('FOO=bar\n' as any);
      const result = resolveEnvKeys({ validationSchema: { notShape: {} } });
      expect(result).toEqual(['FOO']);
    });

    it('returns empty array and warns when env file is missing', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      const result = resolveEnvKeys({ envFilePath: '.env.missing' });
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith('Could not read env file: .env.missing');
    });

    it('does not throw when env file is missing', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      expect(() => resolveEnvKeys({ envFilePath: '.env.missing' })).not.toThrow();
    });
  });

  describe('filtering', () => {
    const schema = {
      shape: {
        DATABASE_URL: {},
        NODE_ENV: {},
        PORT: {},
        npm_lifecycle_event: {},
        npm_config_cache: {},
      },
    };

    it('filters out ignoreKeys', () => {
      const result = resolveEnvKeys({ validationSchema: schema, ignoreKeys: ['NODE_ENV'] });
      expect(result).not.toContain('NODE_ENV');
      expect(result).toContain('DATABASE_URL');
    });

    it('filters out all keys matching ignorePrefixes', () => {
      const result = resolveEnvKeys({ validationSchema: schema, ignorePrefixes: ['npm_'] });
      expect(result).not.toContain('npm_lifecycle_event');
      expect(result).not.toContain('npm_config_cache');
      expect(result).toContain('DATABASE_URL');
    });

    it('applies ignoreKeys and ignorePrefixes together', () => {
      const result = resolveEnvKeys({
        validationSchema: schema,
        ignoreKeys: ['NODE_ENV'],
        ignorePrefixes: ['npm_'],
      });
      expect(result).toEqual(['DATABASE_URL', 'PORT']);
    });
  });
});
