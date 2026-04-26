const sodium = require('libsodium-wrappers');

/**
 * @module integrity
 * @description BLAKE2b-256 per-shard hashing for integrity verification.
 */

const HASH_LENGTH = 32; // 256 bits

/**
 * Compute a BLAKE2b-256 hash of the given shard bytes.
 *
 * @param {Uint8Array|string} shard - Raw shard bytes or hex string.
 * @returns {string}                - 64-char lowercase hex hash.
 */
function hash(shard) {
  let input;
  if (typeof shard === 'string') {
    // Convert hex string to Uint8Array
    input = new Uint8Array(shard.length / 2);
    for (let i = 0; i < input.length; i++) {
      input[i] = parseInt(shard.substr(i * 2, 2), 16);
    }
  } else if (shard instanceof Uint8Array) {
    input = shard;
  } else {
    throw new Error('Shard must be a Uint8Array or hex string');
  }

  const digest = sodium.crypto_generichash(HASH_LENGTH, input);
  return Array.from(digest)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify that a shard matches an expected BLAKE2b-256 hash.
 *
 * @param {Uint8Array|string} shard - The shard to check.
 * @param {string} expectedHash     - 64-char lowercase hex hash.
 * @returns {boolean}               - True if hash matches, else false.
 */
function verify(shard, expectedHash) {
  if (typeof expectedHash !== 'string' || expectedHash.length !== HASH_LENGTH * 2) {
    throw new Error(`Invalid expectedHash length: expected ${HASH_LENGTH * 2}, got ${expectedHash?.length}`);
  }
  const actualHash = hash(shard);
  // constant-time comparison would be nice, but for now a simple compare is fine
  // libsodium doesn't expose crypto_verify_32 in wrappers? Actually it does: sodium.compare
  const actualBytes = hexToBytes(actualHash);
  const expectedBytes = hexToBytes(expectedHash);
  return sodium.compare(actualBytes, expectedBytes) === 0;
}

/**
 * Convert hex string to Uint8Array (internal helper).
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

module.exports = { hash, verify };
