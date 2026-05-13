const sodium = require('libsodium-wrappers');

async function advance(currentKey) {
  await sodium.ready;
  // H(currentKey || "ratchet") — domain-separated so output ≠ HKDF rendezvous output
  const input = new Uint8Array(currentKey.length + 7);
  input.set(currentKey, 0);
  input.set(sodium.from_string('ratchet'), currentKey.length);
  return sodium.crypto_generichash(32, input);
}

async function loadKey(contactId, { store = {}, redisClient } = {}) {
  await sodium.ready;
  const KEY = `ratchet_key:${contactId}`;
  if (store[KEY]) return new Uint8Array(Buffer.from(store[KEY], 'hex'));
  if (redisClient) {
    const raw = await redisClient.get(KEY);
    if (raw) {
      store[KEY] = raw;
      return new Uint8Array(Buffer.from(raw, 'hex'));
    }
  }
  return null;
}

async function saveKey(contactId, key, { store = {}, redisClient } = {}) {
  const KEY = `ratchet_key:${contactId}`;
  const hex = Buffer.from(key).toString('hex');
  store[KEY] = hex;
  if (redisClient) {
    await redisClient.setEx(KEY, 172800, hex);
  }
}

module.exports = { advance, loadKey, saveKey };
