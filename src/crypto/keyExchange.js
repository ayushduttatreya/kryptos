const sodium = require('libsodium-wrappers');

/**
 * @module keyExchange
 * @description X25519 Diffie-Hellman key exchange primitives.
 * Provides ephemeral keypair generation and shared-secret derivation.
 */

/**
 * Initialise libsodium. Must be awaited before any other call.
 * @returns {Promise<void>}
 */
async function ready() {
  await sodium.ready;
}

/**
 * Generate a new X25519 keypair.
 *
 * Cryptographically: produces a random 32-byte scalar clamped for Curve25519
 * and the corresponding 32-byte public point.
 *
 * @returns {{publicKey: Uint8Array, privateKey: Uint8Array}} 32-byte keys.
 */
function generateKeypair() {
  const kp = sodium.crypto_box_keypair();
  return {
    publicKey: kp.publicKey,
    privateKey: kp.privateKey,
  };
}

/**
 * Derive the 32-byte X25519 shared secret from our private key and
 * the remote party's public key.
 *
 * Cryptographically: performs the Curve25519 scalar multiplication
 * `shared = clamp(private) * publicPoint`.
 *
 * @param {Uint8Array} privateKey - 32-byte X25519 private scalar.
 * @param {Uint8Array} publicKey  - 32-byte X25519 public point.
 * @returns {Uint8Array} 32-byte shared secret.
 */
function deriveSharedSecret(privateKey, publicKey) {
  if (privateKey.length !== 32) {
    throw new Error(`Invalid privateKey length: expected 32, got ${privateKey.length}`);
  }
  if (publicKey.length !== 32) {
    throw new Error(`Invalid publicKey length: expected 32, got ${publicKey.length}`);
  }
  return sodium.crypto_scalarmult(privateKey, publicKey);
}

module.exports = {
  ready,
  generateKeypair,
  deriveSharedSecret,
};
