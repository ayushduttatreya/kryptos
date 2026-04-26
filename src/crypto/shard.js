if (typeof window === 'undefined') {
  global.window = global;
}
const secrets = require('secrets.js');

/**
 * @module shard
 * @description Shamir's Secret Sharing (3-of-5 scheme).
 * Splits a ciphertext blob into 5 shards; any 3 can reconstruct it.
 */

const THRESHOLD = 3;
const SHARES    = 5;

/**
 * Convert a Uint8Array to a hex string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to a Uint8Array.
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

/**
 * Compute a CRC32 checksum of a Uint8Array.
 * @param {Uint8Array} bytes
 * @returns {number} 32-bit unsigned checksum.
 */
function crc32(bytes) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Split a ciphertext into 5 Shamir shards (3-of-5 threshold).
 *
 * Cryptographically: evaluates a random polynomial of degree 2 over a
 * finite field at 5 points. Each share encodes (x, f(x)) plus metadata.
 *
 * A 32-bit CRC32 checksum and 32-bit big-endian length prefix are
 * prepended to the secret hex so reconstruction can detect corrupted
 * shares (wrong polynomial).
 *
 * @param {Uint8Array} ciphertext - The encrypted payload.
 * @returns {string[]}            - 5 hex-encoded Shamir shares.
 */
function split(ciphertext) {
  const payloadHex = bytesToHex(ciphertext);
  const checksum = crc32(ciphertext).toString(16).padStart(8, '0');
  const lenPrefix = ciphertext.length.toString(16).padStart(8, '0');
  const secretHex = checksum + lenPrefix + payloadHex;
  const shares = secrets.share(secretHex, SHARES, THRESHOLD);
  return shares;
}

/**
 * Reconstruct the original ciphertext from at least 3 Shamir shares.
 *
 * Uses Lagrange interpolation in the same finite field to recover f(0).
 * Validates the 4-byte CRC32 checksum and 4-byte length prefix to detect
 * corrupted or mismatched shares.
 *
 * @param {string[]} shares - Array of at least 3 hex-encoded shares.
 * @returns {Uint8Array}    - The reconstructed ciphertext blob.
 * @throws {Error} If too few shares are provided or reconstruction fails.
 */
function reconstruct(shares) {
  if (!Array.isArray(shares) || shares.length < THRESHOLD) {
    throw new Error(`Reconstruction requires at least ${THRESHOLD} shares, got ${shares?.length ?? 0}`);
  }
  const secretHex = secrets.combine(shares);
  if (!secretHex || secretHex.length < 16) {
    throw new Error('Shamir reconstruction failed: invalid or corrupted shares');
  }
  const declaredCrc  = parseInt(secretHex.slice(0, 8), 16);
  const declaredLen  = parseInt(secretHex.slice(8, 16), 16);
  const payloadHex   = secretHex.slice(16);
  const payloadBytes = hexToBytes(payloadHex);

  if (payloadBytes.length !== declaredLen) {
    throw new Error('Shamir reconstruction failed: length mismatch (corrupted or mismatched shares)');
  }
  if (crc32(payloadBytes) !== declaredCrc) {
    throw new Error('Shamir reconstruction failed: CRC32 mismatch (corrupted or mismatched shares)');
  }
  return payloadBytes;
}

module.exports = { split, reconstruct, THRESHOLD, SHARES };
