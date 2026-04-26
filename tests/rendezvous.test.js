const sodium = require('libsodium-wrappers');
const { derive, getRendezvousWindow, getCurrentRendezvousId, getRendezvousIdForDate } = require('../src/rendezvous');

describe('L4 Rendezvous Protocol', () => {
  beforeAll(async () => {
    await sodium.ready;
  });
  describe('derive', () => {
    test('produces deterministic 32-char hex IDs', () => {
      const id1 = derive('super-secret-seed', '2026-04-27', 14);
      const id2 = derive('super-secret-seed', '2026-04-27', 14);
      expect(id1).toBe(id2);
      expect(id1.length).toBe(32);
      expect(/^[0-9a-f]+$/.test(id1)).toBe(true);
    });

    test('produces different IDs for different seeds', () => {
      const id1 = derive('seed-a', '2026-04-27', 14);
      const id2 = derive('seed-b', '2026-04-27', 14);
      expect(id1).not.toBe(id2);
    });

    test('produces different IDs for different dates', () => {
      const id1 = derive('seed', '2026-04-27', 14);
      const id2 = derive('seed', '2026-04-28', 14);
      expect(id1).not.toBe(id2);
    });

    test('produces different IDs for different hours', () => {
      const id1 = derive('seed', '2026-04-27', 14);
      const id2 = derive('seed', '2026-04-27', 15);
      expect(id1).not.toBe(id2);
    });

    test('rejects invalid seed', () => {
      expect(() => derive('', '2026-04-27', 14)).toThrow(/Seed must be/);
      expect(() => derive(null, '2026-04-27', 14)).toThrow(/Seed must be/);
    });

    test('rejects invalid date format', () => {
      expect(() => derive('seed', '27-04-2026', 14)).toThrow(/Invalid date format/);
      expect(() => derive('seed', '2026/04/27', 14)).toThrow(/Invalid date format/);
    });

    test('rejects invalid hour', () => {
      expect(() => derive('seed', '2026-04-27', -1)).toThrow(/Invalid hour/);
      expect(() => derive('seed', '2026-04-27', 24)).toThrow(/Invalid hour/);
      expect(() => derive('seed', '2026-04-27', 3.5)).toThrow(/Invalid hour/);
    });
  });

  describe('getRendezvousWindow', () => {
    test('returns valid UTC date and hour', () => {
      const win = getRendezvousWindow();
      expect(win).toHaveProperty('date');
      expect(win).toHaveProperty('hour');
      expect(/\d{4}-\d{2}-\d{2}/.test(win.date)).toBe(true);
      expect(Number.isInteger(win.hour)).toBe(true);
      expect(win.hour).toBeGreaterThanOrEqual(0);
      expect(win.hour).toBeLessThanOrEqual(23);
    });
  });

  describe('getCurrentRendezvousId', () => {
    test('returns a 32-char hex string', () => {
      const id = getCurrentRendezvousId('my-shared-seed');
      expect(typeof id).toBe('string');
      expect(id.length).toBe(32);
    });

    test('is deterministic for the same seed within the same hour', () => {
      const id1 = getCurrentRendezvousId('seed-123');
      const id2 = getCurrentRendezvousId('seed-123');
      expect(id1).toBe(id2);
    });
  });

  describe('getRendezvousIdForDate', () => {
    test('matches derive for a known date/hour', () => {
      const date = new Date(Date.UTC(2026, 3, 27, 14, 30)); // Apr 27 14:30 UTC
      const id1 = getRendezvousIdForDate('seed', date);
      const id2 = derive('seed', '2026-04-27', 14);
      expect(id1).toBe(id2);
    });

    test('produces different IDs for different hours', () => {
      const d1 = new Date(Date.UTC(2026, 3, 27, 9, 0));
      const d2 = new Date(Date.UTC(2026, 3, 27, 10, 0));
      const id1 = getRendezvousIdForDate('seed', d1);
      const id2 = getRendezvousIdForDate('seed', d2);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Alice ↔ Bob cross-derivation', () => {
    test('both sides derive identical rendezvous IDs independently', () => {
      const seed = 'out-of-band-qr-scan-abc123';
      const date = '2026-04-27';
      const hour = 14;

      const aliceId = derive(seed, date, hour);
      const bobId   = derive(seed, date, hour);

      expect(aliceId).toBe(bobId);
      expect(aliceId.length).toBe(32);
    });
  });
});
