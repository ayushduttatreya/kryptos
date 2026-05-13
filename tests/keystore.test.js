const sodium = require('libsodium-wrappers');
const { loadOrGenerate, exportPublicKey, importPublicKey } = require('../src/keystore');

beforeAll(async () => { await sodium.ready; });

test('generates a new keypair when store is empty', async () => {
  const store = {};
  const kp = await loadOrGenerate({ store });
  expect(kp.publicKey).toBeInstanceOf(Uint8Array);
  expect(kp.privateKey).toBeInstanceOf(Uint8Array);
  expect(kp.publicKey.length).toBe(32);
  expect(kp.privateKey.length).toBe(32);
});

test('returns the same keypair on second call', async () => {
  const store = {};
  const kp1 = await loadOrGenerate({ store });
  const kp2 = await loadOrGenerate({ store });
  expect(Buffer.compare(Buffer.from(kp1.publicKey), Buffer.from(kp2.publicKey))).toBe(0);
  expect(Buffer.compare(Buffer.from(kp1.privateKey), Buffer.from(kp2.privateKey))).toBe(0);
});

test('exportPublicKey returns a 64-char hex string', async () => {
  const store = {};
  const kp = await loadOrGenerate({ store });
  const hex = exportPublicKey(kp);
  expect(typeof hex).toBe('string');
  expect(hex.length).toBe(64);
  expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
});

test('importPublicKey parses hex back to Uint8Array(32)', () => {
  const hex = 'a'.repeat(64);
  const key = importPublicKey(hex);
  expect(key).toBeInstanceOf(Uint8Array);
  expect(key.length).toBe(32);
});

test('DH works between two generated keypairs', async () => {
  const storeA = {};
  const storeB = {};
  const alice = await loadOrGenerate({ store: storeA });
  const bob = await loadOrGenerate({ store: storeB });

  const { deriveSharedSecret } = require('../src/crypto/keyExchange');
  const s1 = deriveSharedSecret(alice.privateKey, bob.publicKey);
  const s2 = deriveSharedSecret(bob.privateKey, alice.publicKey);
  expect(Buffer.compare(Buffer.from(s1), Buffer.from(s2))).toBe(0);
});

test('loads keypair from Redis when store is empty', async () => {
  const storeA = {};
  const kpOriginal = await loadOrGenerate({ store: storeA });

  // Simulate a fresh process: empty in-process store, but Redis has the serialized key
  const serialized = storeA['kryptos_keypair'];
  const mockRedis = { get: jest.fn().mockResolvedValue(serialized) };
  const storeB = {};

  const kpFromRedis = await loadOrGenerate({ store: storeB, redisClient: mockRedis });

  expect(mockRedis.get).toHaveBeenCalledWith('kryptos_keypair');
  expect(Buffer.compare(Buffer.from(kpFromRedis.publicKey), Buffer.from(kpOriginal.publicKey))).toBe(0);
  expect(Buffer.compare(Buffer.from(kpFromRedis.privateKey), Buffer.from(kpOriginal.privateKey))).toBe(0);
});

test('importPublicKey throws on non-hex characters', () => {
  expect(() => importPublicKey('z'.repeat(64))).toThrow(/valid hex/);
});
