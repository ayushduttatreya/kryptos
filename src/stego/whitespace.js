/**
 * @module whitespace
 * @description Whitespace steganography for text carriers (e.g. GitHub Gists).
 * Encodes binary data as sequences of trailing spaces (0) and tabs (1).
 * Looks like a normal code snippet or notes file.
 */

const SPACE = ' '; // 0
const TAB   = '\t'; // 1
const BITS_PER_BYTE = 8;
const LENGTH_BYTES = 4; // 32-bit big-endian length header

/**
 * Encode a Uint8Array into whitespace (spaces and tabs) using the carrier text.
 *
 * Encoding:
 *   - First 4 bytes encode payload length (32 bits, 32 whitespace chars)
 *   - Remaining bytes encode the payload itself
 *   - Each line of carrier text gets trailing whitespace appended
 *   - If carrier has too few lines, blank comment lines are appended
 *   - If carrier has too many lines, extra lines are preserved unchanged
 *
 * @param {string} text     - Carrier text (multi-line string).
 * @param {Uint8Array} data - Payload to hide.
 * @returns {string}        - Stego text with hidden whitespace.
 */
function encode(text, data) {
  const lines = text.split('\n');
  const payload = new Uint8Array(LENGTH_BYTES + data.length);
  // Write 32-bit big-endian length
  payload[0] = (data.length >>> 24) & 0xFF;
  payload[1] = (data.length >>> 16) & 0xFF;
  payload[2] = (data.length >>> 8) & 0xFF;
  payload[3] = data.length & 0xFF;
  payload.set(data, LENGTH_BYTES);

  const totalBits = payload.length * BITS_PER_BYTE;
  const neededLines = totalBits;

  // Ensure we have enough lines: pad with harmless comment lines
  while (lines.length < neededLines) {
    lines.push('// ...');
  }

  for (let i = 0; i < totalBits; i++) {
    const byteIdx = Math.floor(i / BITS_PER_BYTE);
    const bitIdx = 7 - (i % BITS_PER_BYTE); // MSB first
    const bit = (payload[byteIdx] >>> bitIdx) & 1;
    lines[i] = lines[i].replace(/[ \t]+$/, '') + (bit ? TAB : SPACE);
  }

  return lines.join('\n');
}

/**
 * Decode hidden data from whitespace-stego text.
 *
 * Reads the last trailing whitespace character (space or tab) of each line
 * as a bit, reconstructing the 32-bit length header and then the payload.
 *
 * @param {string} stegoText - Text with hidden trailing whitespace.
 * @returns {Uint8Array}      - Recovered payload.
 * @throws {Error} If no data is detected or length is invalid.
 */
function decode(stegoText) {
  const lines = stegoText.split('\n');
  const bits = [];

  for (const line of lines) {
    const lastChar = line.slice(-1);
    if (lastChar === SPACE) {
      bits.push(0);
    } else if (lastChar === TAB) {
      bits.push(1);
    }
    // Lines ending with neither are ignored (carrier padding)
  }

  if (bits.length < LENGTH_BYTES * BITS_PER_BYTE) {
    throw new Error('No steganographic data detected: insufficient whitespace lines');
  }

  // Read length header
  let length = 0;
  for (let i = 0; i < LENGTH_BYTES * BITS_PER_BYTE; i++) {
    length = (length << 1) | bits[i];
  }

  if (length < 0 || length > 10 * 1024 * 1024) {
    throw new Error(`Suspicious decoded length: ${length}`);
  }

  const totalBitsNeeded = (LENGTH_BYTES + length) * BITS_PER_BYTE;
  if (bits.length < totalBitsNeeded) {
    throw new Error(
      `Incomplete stego data: need ${totalBitsNeeded} bits, found ${bits.length}`
    );
  }

  const data = new Uint8Array(length);
  for (let i = 0; i < length * BITS_PER_BYTE; i++) {
    const bit = bits[LENGTH_BYTES * BITS_PER_BYTE + i];
    const byteIdx = Math.floor(i / BITS_PER_BYTE);
    const bitIdx = 7 - (i % BITS_PER_BYTE);
    data[byteIdx] = (data[byteIdx] & ~(1 << bitIdx)) | (bit << bitIdx);
  }

  return data;
}

module.exports = { encode, decode };
