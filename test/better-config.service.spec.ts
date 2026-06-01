import { ConfigService } from '@nestjs/config';
import { BetterConfigService } from '../src/better-config.service';

function makeMockConfigService(): jest.Mocked<Pick<ConfigService, 'get' | 'getOrThrow'>> & Record<string, unknown> {
  return {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };
}

describe('BetterConfigService', () => {
  let mock: ReturnType<typeof makeMockConfigService>;
  let svc: BetterConfigService;

  beforeEach(() => {
    mock = makeMockConfigService();
    svc = new BetterConfigService(mock as unknown as ConfigService);
  });

  describe('proxy.get()', () => {
    it('records key in usedKeys', () => {
      (mock.get as jest.Mock).mockReturnValue('value');
      svc.proxy.get('DATABASE_URL');
      expect(svc.usedKeys.has('DATABASE_URL')).toBe(true);
    });

    it('records multiple distinct keys', () => {
      (mock.get as jest.Mock).mockReturnValue('value');
      svc.proxy.get('DATABASE_URL');
      svc.proxy.get('PORT');
      expect(svc.usedKeys.size).toBe(2);
    });

    it('deduplicates repeated calls for same key', () => {
      (mock.get as jest.Mock).mockReturnValue('value');
      svc.proxy.get('DATABASE_URL');
      svc.proxy.get('DATABASE_URL');
      expect(svc.usedKeys.size).toBe(1);
    });

    it('returns identical value to original ConfigService', () => {
      (mock.get as jest.Mock).mockReturnValue('postgres://localhost/db');
      expect(svc.proxy.get('DATABASE_URL')).toBe('postgres://localhost/db');
    });

    it('forwards key to original ConfigService', () => {
      (mock.get as jest.Mock).mockReturnValue('3000');
      svc.proxy.get('PORT');
      expect(mock.get).toHaveBeenCalledWith('PORT');
    });

    it('forwards defaultValue to original ConfigService', () => {
      (mock.get as jest.Mock).mockReturnValue('8080');
      svc.proxy.get('PORT', '8080');
      expect(mock.get).toHaveBeenCalledWith('PORT', '8080');
    });

    it('preserves generic: get<string>() returns string value', () => {
      (mock.get as jest.Mock).mockReturnValue('hello');
      const result: string | undefined = svc.proxy.get<string>('KEY');
      expect(result).toBe('hello');
    });

    it('returns undefined when key absent and no default', () => {
      (mock.get as jest.Mock).mockReturnValue(undefined);
      expect(svc.proxy.get('MISSING')).toBeUndefined();
    });
  });

  describe('proxy.getOrThrow()', () => {
    it('calls original getOrThrow and returns result', () => {
      (mock.getOrThrow as jest.Mock).mockReturnValue('secret');
      expect(svc.proxy.getOrThrow('API_KEY')).toBe('secret');
      expect(mock.getOrThrow).toHaveBeenCalledWith('API_KEY');
    });

    it('does NOT record key in usedKeys', () => {
      (mock.getOrThrow as jest.Mock).mockReturnValue('secret');
      svc.proxy.getOrThrow('API_KEY');
      expect(svc.usedKeys.has('API_KEY')).toBe(false);
    });

    it('propagates throw from original getOrThrow', () => {
      (mock.getOrThrow as jest.Mock).mockImplementation(() => {
        throw new Error('Missing required key: API_KEY');
      });
      expect(() => svc.proxy.getOrThrow('API_KEY')).toThrow('Missing required key: API_KEY');
    });
  });

  describe('other properties', () => {
    it('passes through non-function properties', () => {
      (mock as any).isCacheEnabled = true;
      expect((svc.proxy as any).isCacheEnabled).toBe(true);
    });

    it('passes through arbitrary methods, calling them on the original instance', () => {
      const fn = jest.fn().mockReturnValue('result');
      (mock as any).someMethod = fn;
      expect((svc.proxy as any).someMethod()).toBe('result');
      expect(fn).toHaveBeenCalled();
    });
  });
});
