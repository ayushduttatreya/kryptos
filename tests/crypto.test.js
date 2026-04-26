const { keyExchange, encrypt, shard, integrity } = require('../src/crypto');

describe('L1 Crypto Core', () => {
  beforeAll(async () => {
    await keyExchange.ready();
  });

  describe('keyExchange', () => {
    test('generates valid X25519 keypairs', () => {
      const alice = keyExchange.generateKeypair();
      expect(alice.publicKey).toBeInstanceOf(Uint8Array);
      expect(alice.privateKey).toBeInstanceOf(Uint8Array);
      expect(alice.publicKey.length).toBe(32);
      expect(alice.privateKey.length).toBe(32);
    });

    test('derives identical shared secrets for Alice and Bob', () => {
      const alice = keyExchange.generateKeypair();
      const bob   = keyExchange.generateKeypair();

      const aliceSecret = keyExchange.deriveSharedSecret(alice.privateKey, bob.publicKey);
      const bobSecret   = keyExchange.deriveSharedSecret(bob.privateKey, alice.publicKey);

      expect(aliceSecret).toBeInstanceOf(Uint8Array);
      expect(aliceSecret.length).toBe(32);
      expect(Buffer.compare(aliceSecret, bobSecret)).toBe(0);
    });

    test('rejects invalid key lengths', () => {
      expect(() => keyExchange.deriveSharedSecret(new Uint8Array(16), new Uint8Array(32)))
        .toThrow(/Invalid privateKey length/);
      expect(() => keyExchange.deriveSharedSecret(new Uint8Array(32), new Uint8Array(16)))
        .toThrow(/Invalid publicKey length/);
    });
  });

  describe('encrypt', () => {
    test('round-trips plaintext successfully', () => {
      const key = new Uint8Array(32);
      key[0] = 1;

      const plaintext = 'Hello, covert world! 🤐';
      const ciphertext = encrypt.encrypt(plaintext, key);
      expect(ciphertext.length).toBeGreaterThan(24); // nonce + MAC + payload

      const decrypted = encrypt.decrypt(ciphertext, key);
      expect(decrypted).toBe(plaintext);
    });

    test('fails with wrong key', () => {
      const key = new Uint8Array(32);
      key[0] = 1;
      const wrongKey = new Uint8Array(32);
      wrongKey[0] = 2;

      const ciphertext = encrypt.encrypt('secret', key);
      expect(() => encrypt.decrypt(ciphertext, wrongKey))
        .toThrow(/MAC verification failed/);
    });

    test('rejects short ciphertext', () => {
      const key = new Uint8Array(32);
      expect(() => encrypt.decrypt(new Uint8Array(10), key))
        .toThrow(/Ciphertext too short/);
    });

    test('rejects invalid key length', () => {
      expect(() => encrypt.encrypt('x', new Uint8Array(16)))
        .toThrow(/Invalid key length/);
    });
  });

  describe('shard', () => {
    test('splits into 5 shares and reconstructs from any 3', () => {
      const payload = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 255]);
      const shares = shard.split(payload);

      expect(shares.length).toBe(5);
      shares.forEach(s => expect(typeof s).toBe('string'));

      // Reconstruct from shares 0,2,4
      const reconstructed = shard.reconstruct([shares[0], shares[2], shares[4]]);
      expect(Buffer.compare(reconstructed, payload)).toBe(0);

      // Reconstruct from shares 1,3,4
      const reconstructed2 = shard.reconstruct([shares[1], shares[3], shares[4]]);
      expect(Buffer.compare(reconstructed2, payload)).toBe(0);
    });

    test('fails with fewer than 3 shares', () => {
      const payload = new Uint8Array([1, 2, 3]);
      const shares = shard.split(payload);
      expect(() => shard.reconstruct([shares[0], shares[1]]))
        .toThrow(/requires at least 3 shares/);
    });

    test('fails with corrupted shares', () => {
      const payload = new Uint8Array([1, 2, 3]);
      const shares = shard.split(payload);
      shares[0] = shares[0].slice(0, -4) + 'dead'; // corrupt last 4 hex chars
      expect(() => shard.reconstruct([shares[0], shares[1], shares[2]]))
        .toThrow(/CRC32 mismatch/);
    });
  });

  describe('integrity', () => {
    test('hashes shard deterministically', () => {
      const shardData = '1-abc123';
      const h1 = integrity.hash(shardData);
      const h2 = integrity.hash(shardData);
      expect(h1).toBe(h2);
      expect(h1.length).toBe(64); // 256 bits = 64 hex chars
    });

    test('hashes Uint8Array shards', () => {
      const data = new Uint8Array([0, 1, 2, 3]);
      const h = integrity.hash(data);
      expect(typeof h).toBe('string');
      expect(h.length).toBe(64);
    });

    test('verify returns true for matching hash', () => {
      const data = new Uint8Array([0, 1, 2, 3]);
      const h = integrity.hash(data);
      expect(integrity.verify(data, h)).toBe(true);
    });

    test('verify returns false for tampered data', () => {
      const data = new Uint8Array([0, 1, 2, 3]);
      const h = integrity.hash(data);
      const tampered = new Uint8Array([0, 1, 2, 4]);
      expect(integrity.verify(tampered, h)).toBe(false);
    });

    test('rejects invalid expectedHash length', () => {
      expect(() => integrity.verify(new Uint8Array([1]), 'abcd'))
        .toThrow(/Invalid expectedHash length/);
    });

    test('rejects non-Uint8Array non-string input', () => {
      expect(() => integrity.hash(12345))
        .toThrow(/must be a Uint8Array or hex string/);
    });
  });

  describe('end-to-end L1 flow', () => {
    test('plaintext → encrypt → shard → reconstruct → decrypt', () => {
      const alice = keyExchange.generateKeypair();
      const bob   = keyExchange.generateKeypair();
      const shared = keyExchange.deriveSharedSecret(alice.privateKey, bob.publicKey);

      const plaintext = 'This is a covert message hidden in plain sight.';
      const ciphertext = encrypt.encrypt(plaintext, shared);

      const shares = shard.split(ciphertext);
      expect(shares.length).toBe(5);

      // Alice attaches hashes
      const hashedShares = shares.map(s => ({
        shard: s,
        hash: integrity.hash(s),
      }));

      // Bob receives any 3 shards
      const received = [hashedShares[0], hashedShares[2], hashedShares[4]];

      // Bob verifies integrity
      received.forEach(({ shard: s, hash: h }) => {
        expect(integrity.verify(s, h)).toBe(true);
      });

      // Bob reconstructs and decrypts
      const reconstructed = shard.reconstruct(received.map(r => r.shard));
      const decrypted = encrypt.decrypt(reconstructed, shared);

      expect(decrypted).toBe(plaintext);
    });
  });
});
