import { ConfigService } from '@nestjs/config';
import {
  BetterConfigService,
  trackConfigServiceKeys,
} from '../src/better-config.service';

describe('trackConfigServiceKeys', () => {
  let usedKeys: Set<string>;
  let cs: ConfigService;

  beforeEach(() => {
    process.env.TRACK_TEST_KEY = 'value';
    process.env.TRACK_TEST_OTHER = 'other';
    usedKeys = trackConfigServiceKeys();
    cs = new ConfigService();
  });

  afterEach(() => {
    delete process.env.TRACK_TEST_KEY;
    delete process.env.TRACK_TEST_OTHER;
  });

  describe('get()', () => {
    it('records accessed key', () => {
      cs.get('TRACK_TEST_KEY');
      expect(usedKeys.has('TRACK_TEST_KEY')).toBe(true);
    });

    it('records multiple distinct keys', () => {
      cs.get('TRACK_TEST_KEY');
      cs.get('TRACK_TEST_OTHER');
      expect(usedKeys.size).toBe(2);
    });

    it('deduplicates repeated reads of same key', () => {
      cs.get('TRACK_TEST_KEY');
      cs.get('TRACK_TEST_KEY');
      expect(usedKeys.size).toBe(1);
    });

    it('returns the real value unchanged', () => {
      expect(cs.get('TRACK_TEST_KEY')).toBe('value');
    });

    it('returns defaultValue for missing key', () => {
      expect(cs.get('TRACK_TEST_MISSING', 'fallback')).toBe('fallback');
    });

    it('returns undefined for missing key without default', () => {
      expect(cs.get('TRACK_TEST_MISSING')).toBeUndefined();
    });

    it('records missing keys too (they were still asked for)', () => {
      cs.get('TRACK_TEST_MISSING');
      expect(usedKeys.has('TRACK_TEST_MISSING')).toBe(true);
    });
  });

  describe('getOrThrow()', () => {
    it('records accessed key and returns value', () => {
      expect(cs.getOrThrow('TRACK_TEST_KEY')).toBe('value');
      expect(usedKeys.has('TRACK_TEST_KEY')).toBe(true);
    });

    it('still throws on missing key', () => {
      expect(() => cs.getOrThrow('TRACK_TEST_MISSING')).toThrow();
    });
  });

  describe('patch semantics', () => {
    it('tracks reads from every ConfigService instance', () => {
      const other = new ConfigService();
      other.get('TRACK_TEST_OTHER');
      expect(usedKeys.has('TRACK_TEST_OTHER')).toBe(true);
    });

    it('tracks constructor-time reads (instance created after patch)', () => {
      class Consumer {
        readonly value: string | undefined;
        constructor(config: ConfigService) {
          this.value = config.get('TRACK_TEST_KEY');
        }
      }
      const consumer = new Consumer(new ConfigService());
      expect(consumer.value).toBe('value');
      expect(usedKeys.has('TRACK_TEST_KEY')).toBe(true);
    });

    it('calling again starts a fresh set without double-wrapping', () => {
      cs.get('TRACK_TEST_KEY');
      const fresh = trackConfigServiceKeys();
      expect(fresh.size).toBe(0);
      cs.get('TRACK_TEST_OTHER');
      expect(fresh.has('TRACK_TEST_OTHER')).toBe(true);
      expect(fresh.has('TRACK_TEST_KEY')).toBe(false);
    });
  });
});

describe('BetterConfigService', () => {
  it('configService getter throws before initialize', () => {
    const svc = new BetterConfigService();
    expect(() => svc.configService).toThrow(/not initialized/);
  });

  it('configService getter returns instance after initialize', () => {
    const svc = new BetterConfigService();
    const cs = new ConfigService();
    svc.initialize(cs);
    expect(svc.configService).toBe(cs);
  });

  it('uses the provided usedKeys set', () => {
    const shared = new Set<string>(['SEEDED']);
    const svc = new BetterConfigService(shared);
    expect(svc.usedKeys).toBe(shared);
    expect(svc.usedKeys.has('SEEDED')).toBe(true);
  });

  it('defaults to an empty set when none provided', () => {
    const svc = new BetterConfigService();
    expect(svc.usedKeys.size).toBe(0);
  });
});
