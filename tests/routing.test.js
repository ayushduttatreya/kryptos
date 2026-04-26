jest.mock('axios');
const axios = require('axios');
const sodium = require('libsodium-wrappers');
const { route } = require('../src/routing/aiRouter');
const { generate: generateCoverTraffic, FAKE_RATIO } = require('../src/routing/coverTraffic');

describe('L3 AI Routing Engine', () => {
  beforeAll(async () => {
    await sodium.ready;
  });
  describe('aiRouter.route', () => {
    test('returns parsed assignments from OpenRouter', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { shardId: 1, channel: 'imgur', delayMs: 0 },
                  { shardId: 2, channel: 'gist', delayMs: 5000 },
                ]),
              },
            },
          ],
        },
      });

      const shards = [
        { id: 1, size: 100, urgency: true },
        { id: 2, size: 200, urgency: false },
      ];
      const status = { imgur: { load: 0.2 }, gist: { load: 0.1 } };
      const result = await route(shards, status, 'fake-api-key');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ shardId: '1', channel: 'imgur', delayMs: 0 });
      expect(result[1]).toEqual({ shardId: '2', channel: 'gist', delayMs: 5000 });
    });

    test('handles markdown-wrapped JSON', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: '```json\n[{"shardId":"a","channel":"imgur","delayMs":100}]\n```',
              },
            },
          ],
        },
      });

      const result = await route([{ id: 'a' }], {}, 'key');
      expect(result).toEqual([{ shardId: 'a', channel: 'imgur', delayMs: 100 }]);
    });

    test('handles nested object response', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  assignments: [{ shardId: 5, channel: 'gist', delayMs: 200 }],
                }),
              },
            },
          ],
        },
      });

      const result = await route([{ id: 5 }], {}, 'key');
      expect(result).toEqual([{ shardId: '5', channel: 'gist', delayMs: 200 }]);
    });

    test('throws on missing API key', async () => {
      await expect(route([{ id: 1 }], {}, '')).rejects.toThrow(/API key is required/);
    });

    test('throws on empty shards', async () => {
      await expect(route([], {}, 'key')).rejects.toThrow(/non-empty/);
    });

    test('throws on unparseable AI response', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'not-json-at-all' } }],
        },
      });
      await expect(route([{ id: 1 }], {}, 'key')).rejects.toThrow(/JSON/);
    });

    test('throws on non-array AI response', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: '{"foo":"bar"}' } }],
        },
      });
      await expect(route([{ id: 1 }], {}, 'key')).rejects.toThrow(/valid array/);
    });

    test('throws on empty OpenRouter response', async () => {
      axios.post.mockResolvedValueOnce({ data: { choices: [] } });
      await expect(route([{ id: 1 }], {}, 'key')).rejects.toThrow(/empty response/);
    });
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
