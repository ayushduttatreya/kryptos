const sodium = require('libsodium-wrappers');

/**
 * @module hkdf
 * @description HKDF-style key derivation for time-based rendezvous IDs.
 * Uses BLAKE2b as the underlying PRF: extract phase hashes the seed
 * into a 32-byte key, then expand phase hashes the date+hour context
 * under that key to produce the rendezvous_id.
 */

/**
 * Convert bytes to lowercase hex string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive a deterministic rendezvous_id from a shared seed, date, and hour.
 *
 * Cryptographically:
 *   1. Extract: prk = BLAKE2b-256(seed)
 *   2. Expand:  rendezvous_id = BLAKE2b-128(date || "|" || hour, key=prk)
 *
 * @param {string} seed  - Shared seed phrase (arbitrary length).
 * @param {string} date  - ISO 8601 date string, e.g. "2026-04-27".
 * @param {number} hour  - Hour of day, 0–23 (UTC).
 * @returns {string}     - 32-char hex rendezvous_id.
 */
function derive(seed, date, hour) {
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new Error('Seed must be a non-empty string');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: expected YYYY-MM-DD, got "${date}"`);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: expected 0–23, got ${hour}`);
  }

  const seedBytes = sodium.from_string(seed);
  const prk = sodium.crypto_generichash(32, seedBytes);           // extract

  const context = sodium.from_string(`${date}|${hour}`);
  const idBytes = sodium.crypto_generichash(16, context, prk);    // expand

  return bytesToHex(idBytes); // 32 hex chars
}

module.exports = { derive };
