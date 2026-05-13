const sodium = require('libsodium-wrappers');
const { advance, loadKey, saveKey } = require('../src/ratchet');

beforeAll(async () => { await sodium.ready; });

test('advance derives a deterministic next key', async () => {
  const key = new Uint8Array(32).fill(1);
  const next1 = await advance(key);
  const next2 = await advance(key);
  expect(next1).toBeInstanceOf(Uint8Array);
  expect(next1.length).toBe(32);
  expect(Buffer.compare(Buffer.from(next1), Buffer.from(next2))).toBe(0);
});

test('advance produces a different key than the input', async () => {
  const key = new Uint8Array(32).fill(1);
  const next = await advance(key);
  expect(Buffer.compare(Buffer.from(key), Buffer.from(next))).not.toBe(0);
});

test('ratchet chain is one-directional', async () => {
  const key = new Uint8Array(32).fill(5);
  const next = await advance(key);
  const further = await advance(next);
  // Going further forward does not circle back to original
  expect(Buffer.compare(Buffer.from(further), Buffer.from(key))).not.toBe(0);
});

test('loadKey returns null when store is empty', async () => {
  const store = {};
  const key = await loadKey('contact-1', { store });
  expect(key).toBeNull();
});

test('saveKey persists and loadKey retrieves', async () => {
  const store = {};
  const key = new Uint8Array(32).fill(7);
  await saveKey('contact-1', key, { store });
  const loaded = await loadKey('contact-1', { store });
  expect(Buffer.compare(Buffer.from(loaded), Buffer.from(key))).toBe(0);
});
