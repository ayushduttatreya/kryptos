/**
 * @module crypto
 * @description Aggregates all L1 cryptographic primitives:
 *   - keyExchange  (X25519 DH)
 *   - encrypt      (XSalsa20-Poly1305)
 *   - shard        (Shamir 3-of-5)
 *   - integrity    (BLAKE2b-256)
 */

const keyExchange = require('./keyExchange');
const encrypt     = require('./encrypt');
const shard       = require('./shard');
const integrity   = require('./integrity');

module.exports = {
  keyExchange,
  encrypt,
  shard,
  integrity,
};
