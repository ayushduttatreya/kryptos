const sodium = require('libsodium-wrappers');

const STORE_KEY = 'kryptos_keypair';

async function loadOrGenerate({ store = {}, redisClient } = {}) {
  await sodium.ready;

  // 1. Try in-process cache
  if (store[STORE_KEY]) {
    const { pub, priv } = JSON.parse(store[STORE_KEY]);
    return {
      publicKey: new Uint8Array(Buffer.from(pub, 'hex')),
      privateKey: new Uint8Array(Buffer.from(priv, 'hex')),
    };
  }

  // 2. Try Redis
  if (redisClient) {
    const raw = await redisClient.get(STORE_KEY);
    if (raw) {
      store[STORE_KEY] = raw;
      const { pub, priv } = JSON.parse(raw);
      return {
        publicKey: new Uint8Array(Buffer.from(pub, 'hex')),
        privateKey: new Uint8Array(Buffer.from(priv, 'hex')),
      };
    }
  }

  // 3. Generate fresh keypair
  const kp = sodium.crypto_box_keypair();
  const serialized = JSON.stringify({
    pub: Buffer.from(kp.publicKey).toString('hex'),
    priv: Buffer.from(kp.privateKey).toString('hex'),
  });

  store[STORE_KEY] = serialized;
  if (redisClient) {
    await redisClient.set(STORE_KEY, serialized);
  }

  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

function exportPublicKey(keypair) {
  return Buffer.from(keypair.publicKey).toString('hex');
}

function importPublicKey(hex) {
  if (typeof hex !== 'string' || hex.length !== 64) {
    throw new Error(`importPublicKey: expected 64-char hex, got length ${hex?.length}`);
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error('importPublicKey: input must be a valid hex string');
  }
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

module.exports = { loadOrGenerate, exportPublicKey, importPublicKey };
