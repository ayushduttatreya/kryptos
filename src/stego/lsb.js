const sharp = require('sharp');

/**
 * @module lsb
 * @description LSB (Least Significant Bit) steganography for RGB images.
 * Hides binary data inside the least-significant bits of pixel channels.
 * Visually identical to the carrier image.
 */

/**
 * Embed a data payload into an image buffer using LSB in the R, G, B channels.
 *
 * Encoding format (big-endian):
 *   [32 bits: payload length in bytes] [N*8 bits: payload bytes]
 * Each RGB pixel contributes 3 bits (R LSB, G LSB, B LSB). Alpha is untouched.
 *
 * @param {Buffer} imageBuffer - Original image bytes (PNG/JPEG/etc).
 * @param {Uint8Array} data    - Payload to hide.
 * @returns {Promise<Buffer>}  - Stego image as PNG buffer.
 * @throws {Error} If the image is too small to hold the payload.
 */
async function embed(imageBuffer, data) {
  const { data: pixels, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalBits = 32 + data.length * 8;
  const pixelCount = info.width * info.height;
  const availableBits = pixelCount * 3; // R, G, B only

  if (totalBits > availableBits) {
    throw new Error(
      `Image too small: need ${totalBits} bits, have ${availableBits} bits (${pixelCount} pixels)`
    );
  }

  const buf = Buffer.from(pixels);
  const length = data.length;

  // Write length header (32 bits)
  for (let i = 0; i < 32; i++) {
    const bit = (length >>> (31 - i)) & 1;
    const pixelIdx = Math.floor(i / 3);
    const channelIdx = i % 3; // 0=R, 1=G, 2=B
    const byteIdx = pixelIdx * 4 + channelIdx;
    buf[byteIdx] = (buf[byteIdx] & 0xFE) | bit;
  }

  // Write payload bits
  for (let i = 0; i < data.length * 8; i++) {
    const bit = (data[Math.floor(i / 8)] >>> (7 - (i % 8))) & 1;
    const bitOffset = 32 + i;
    const pixelIdx = Math.floor(bitOffset / 3);
    const channelIdx = bitOffset % 3;
    const byteIdx = pixelIdx * 4 + channelIdx;
    buf[byteIdx] = (buf[byteIdx] & 0xFE) | bit;
  }

  return sharp(buf, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  }).png().toBuffer();
}

/**
 * Extract a hidden payload from a stego image buffer.
 *
 * @param {Buffer} imageBuffer - Stego image bytes.
 * @returns {Promise<Uint8Array>} - Recovered payload.
 * @throws {Error} If the declared length exceeds what the image can hold.
 */
async function extract(imageBuffer) {
  const { data: pixels, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  const availableBits = pixelCount * 3;

  if (availableBits < 32) {
    throw new Error('Image too small to contain a length header');
  }

  const buf = Buffer.from(pixels);

  // Read length header (32 bits)
  let length = 0;
  for (let i = 0; i < 32; i++) {
    const pixelIdx = Math.floor(i / 3);
    const channelIdx = i % 3;
    const byteIdx = pixelIdx * 4 + channelIdx;
    const bit = buf[byteIdx] & 1;
    length = (length << 1) | bit;
  }

  if (length < 0 || length > 100 * 1024 * 1024) {
    throw new Error(`Suspicious declared length: ${length}`);
  }

  const totalBits = 32 + length * 8;
  if (totalBits > availableBits) {
    throw new Error(
      `Declared payload (${length} bytes) exceeds image capacity (${availableBits} bits)`
    );
  }

  // Read payload bits
  const data = new Uint8Array(length);
  for (let i = 0; i < length * 8; i++) {
    const bitOffset = 32 + i;
    const pixelIdx = Math.floor(bitOffset / 3);
    const channelIdx = bitOffset % 3;
    const byteIdx = pixelIdx * 4 + channelIdx;
    const bit = buf[byteIdx] & 1;
    const bytePos = Math.floor(i / 8);
    const bitPos = 7 - (i % 8);
    data[bytePos] = (data[bytePos] & ~(1 << bitPos)) | (bit << bitPos);
  }

  return data;
}

module.exports = { embed, extract };
