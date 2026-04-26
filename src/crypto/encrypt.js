const sodium = require('libsodium-wrappers');

/**
 * @module encrypt
 * @description XSalsa20-Poly1305 authenticated encryption.
 * Encrypts plaintext with a 32-byte shared secret and prepends a random 24-byte nonce.
 */

const NONCE_LENGTH = 24; // sodium.crypto_secretbox_NONCEBYTES
const MACBYTES     = 16; // sodium.crypto_secretbox_MACBYTES
const KEY_LENGTH   = 32; // sodium.crypto_secretbox_KEYBYTES

/**
 * Encrypt a UTF-8 plaintext message under a 32-byte XSalsa20-Poly1305 key.
 *
 * Flow: random nonce (24 bytes) || XSalsa20-Poly1305(plaintext, nonce, key).
 *
 * @param {string} plaintext   - The message to encrypt.
 * @param {Uint8Array} key     - 32-byte shared secret.
 * @returns {Uint8Array}       - nonce || ciphertext (authenticated).
 */
function encrypt(plaintext, key) {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
  }
  const nonce = sodium.randombytes_buf(NONCE_LENGTH);
  const message = sodium.from_string(plaintext);
  const ciphertext = sodium.crypto_secretbox_easy(message, nonce, key);

  const out = new Uint8Array(nonce.length + ciphertext.length);
  out.set(nonce, 0);
  out.set(ciphertext, nonce.length);
  return out;
}

/**
 * Decrypt a nonce-prefixed XSalsa20-Poly1305 ciphertext.
 *
 * @param {Uint8Array} data  - nonce || ciphertext.
 * @param {Uint8Array} key   - 32-byte shared secret.
 * @returns {string}         - Decrypted UTF-8 plaintext.
 * @throws {Error} If authentication fails (tampered or wrong key).
 */
function decrypt(data, key) {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH}, got ${key.length}`);
  }
  if (data.length < NONCE_LENGTH + MACBYTES) {
    throw new Error('Ciphertext too short to contain nonce + MAC');
  }
  const nonce = data.slice(0, NONCE_LENGTH);
  const ciphertext = data.slice(NONCE_LENGTH);

  try {
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    return sodium.to_string(plaintext);
  } catch (err) {
    throw new Error('Decryption failed: MAC verification failed (wrong key or tampered data)');
  }
}

module.exports = { encrypt, decrypt };
