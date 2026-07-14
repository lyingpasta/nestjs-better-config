import { ConfigService } from '@nestjs/config';
import { BetterConfigService } from '../src/better-config.service';

function makeMockConfigService(): jest.Mocked<
  Pick<ConfigService, 'get' | 'getOrThrow'>
> &
  Record<string, unknown> {
  return {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };
}

describe('BetterConfigService', () => {
  let mock: ReturnType<typeof makeMockConfigService>;
  let origGet: jest.Mock;
  let origGetOrThrow: jest.Mock;
  let cs: ConfigService;
  let svc: BetterConfigService;

  beforeEach(() => {
    mock = makeMockConfigService();
    origGet = mock.get as jest.Mock;
    origGetOrThrow = mock.getOrThrow as jest.Mock;
    cs = mock as unknown as ConfigService;
    svc = new BetterConfigService(cs);
  });

  describe('patched get()', () => {
    it('records key in usedKeys', () => {
      origGet.mockReturnValue('value');
      cs.get('DATABASE_URL');
      expect(svc.usedKeys.has('DATABASE_URL')).toBe(true);
    });

    it('records multiple distinct keys', () => {
      origGet.mockReturnValue('value');
      cs.get('DATABASE_URL');
      cs.get('PORT');
      expect(svc.usedKeys.size).toBe(2);
    });

    it('deduplicates repeated calls for same key', () => {
      origGet.mockReturnValue('value');
      cs.get('DATABASE_URL');
      cs.get('DATABASE_URL');
      expect(svc.usedKeys.size).toBe(1);
    });

    it('returns identical value to original ConfigService', () => {
      origGet.mockReturnValue('postgres://localhost/db');
      expect(cs.get('DATABASE_URL')).toBe('postgres://localhost/db');
    });

    it('forwards key to original ConfigService', () => {
      origGet.mockReturnValue('3000');
      cs.get('PORT');
      expect(origGet).toHaveBeenCalledWith('PORT');
    });

    it('forwards defaultValue to original ConfigService', () => {
      origGet.mockReturnValue('8080');
      cs.get('PORT', '8080');
      expect(origGet).toHaveBeenCalledWith('PORT', '8080');
    });

    it('preserves arity: no extra arguments passed when omitted', () => {
      origGet.mockReturnValue('value');
      cs.get('KEY');
      expect(origGet).toHaveBeenCalledWith('KEY');
      expect(origGet.mock.calls[0]).toHaveLength(1);
    });

    it('preserves generic: get<string>() returns string value', () => {
      origGet.mockReturnValue('hello');
      const result: string | undefined = cs.get<string>('KEY');
      expect(result).toBe('hello');
    });

    it('returns undefined when key absent and no default', () => {
      origGet.mockReturnValue(undefined);
      expect(cs.get('MISSING')).toBeUndefined();
    });
  });

  describe('patched getOrThrow()', () => {
    it('calls original getOrThrow and returns result', () => {
      origGetOrThrow.mockReturnValue('secret');
      expect(cs.getOrThrow('API_KEY')).toBe('secret');
      expect(origGetOrThrow).toHaveBeenCalledWith('API_KEY');
    });

    it('records key in usedKeys', () => {
      origGetOrThrow.mockReturnValue('secret');
      cs.getOrThrow('API_KEY');
      expect(svc.usedKeys.has('API_KEY')).toBe(true);
    });

    it('propagates throw from original getOrThrow', () => {
      origGetOrThrow.mockImplementation(() => {
        throw new Error('Missing required key: API_KEY');
      });
      expect(() => cs.getOrThrow('API_KEY')).toThrow(
        'Missing required key: API_KEY',
      );
    });
  });

  describe('initialization', () => {
    it('configService getter throws before initialize', () => {
      const uninitialized = new BetterConfigService();
      expect(() => uninitialized.configService).toThrow(
        /not initialized/,
      );
    });

    it('configService getter returns instance after initialize', () => {
      expect(svc.configService).toBe(cs);
    });

    it('initialize is idempotent — no double-wrapping', () => {
      origGet.mockReturnValue('value');
      svc.initialize(cs);
      svc.initialize(cs);
      cs.get('KEY');
      expect(origGet).toHaveBeenCalledTimes(1);
      expect(svc.usedKeys.has('KEY')).toBe(true);
    });

    it('does not touch other properties of the instance', () => {
      (mock as any).isCacheEnabled = true;
      expect((cs as any).isCacheEnabled).toBe(true);
    });
  });
});
