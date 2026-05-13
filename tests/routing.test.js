const sodium = require('libsodium-wrappers');
const { route } = require('../src/routing/aiRouter');
const { generate: generateCoverTraffic, FAKE_RATIO } = require('../src/routing/coverTraffic');

describe('L3 aiRouter (local CSPRNG)', () => {
  test('returns one assignment per shard', () => {
    const shards = [
      { id: 0, size: 100, urgency: true },
      { id: 1, size: 100, urgency: false },
      { id: 2, size: 100, urgency: false },
    ];
    const result = route(shards);
    expect(result).toHaveLength(3);
    result.forEach((a, i) => {
      expect(a.shardId).toBe(String(i));
      expect(['imgur', 'gist']).toContain(a.channel);
      expect(typeof a.delayMs).toBe('number');
      expect(a.delayMs).toBeGreaterThanOrEqual(500);
      expect(a.delayMs).toBeLessThanOrEqual(8000);
    });
  });

  test('distributes across both channels over 100 calls', () => {
    const shards = [{ id: 0, size: 64, urgency: false }];
    const channels = new Set();
    for (let i = 0; i < 100; i++) {
      channels.add(route(shards)[0].channel);
    }
    expect(channels.size).toBe(2);
  });

  test('assigns delayMs in 500–8000 range', () => {
    const shards = Array.from({ length: 50 }, (_, i) => ({ id: i, size: 64, urgency: false }));
    const results = route(shards);
    results.forEach(a => {
      expect(a.delayMs).toBeGreaterThanOrEqual(500);
      expect(a.delayMs).toBeLessThanOrEqual(8000);
    });
  });

  test('throws on empty shards', () => {
    expect(() => route([])).toThrow(/non-empty/);
  });

  test('is synchronous — no Promise returned', () => {
    const result = route([{ id: 0, size: 64, urgency: false }]);
    expect(result).not.toBeInstanceOf(Promise);
  });
});

describe('L3 AI Routing Engine', () => {
  beforeAll(async () => {
    await sodium.ready;
  });

  describe('coverTraffic.generate', () => {
    test('generates 3x fake shards per real shard', () => {
      const fakes = generateCoverTraffic(2, 64);
      expect(fakes.length).toBe(2 * FAKE_RATIO);
      fakes.forEach((f) => {
        expect(f.isFake).toBe(true);
        expect(f.shard).toMatch(/^[0-9a-f]+$/);
        expect(f.shard.length).toBe(64);
        expect(f.id).toMatch(/^fake-/);
      });
    });

    test('generates empty array for zero real shards', () => {
      const fakes = generateCoverTraffic(0);
      expect(fakes).toEqual([]);
    });

    test('respects custom shard length', () => {
      const fakes = generateCoverTraffic(1, 32);
      expect(fakes[0].shard.length).toBe(32);
    });

    test('rejects negative count', () => {
      expect(() => generateCoverTraffic(-1)).toThrow(/non-negative/);
    });

    test('fake shards are unique', () => {
      const fakes = generateCoverTraffic(5, 64);
      const shards = fakes.map((f) => f.shard);
      const unique = new Set(shards);
      expect(unique.size).toBe(shards.length);
    });
  });
});
