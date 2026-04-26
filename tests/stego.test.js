const sharp = require('sharp');
const { lsb, whitespace } = require('../src/stego');

describe('L2 Steganography Engine', () => {
  describe('LSB image steganography', () => {
    async function createTestImage(width, height) {
      return sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 128, g: 64, b: 200 },
        },
      }).png().toBuffer();
    }

    test('embeds and extracts short payload', async () => {
      const image = await createTestImage(20, 20);
      const payload = new Uint8Array([0, 1, 2, 3, 255]);
      const stego = await lsb.embed(image, payload);
      expect(stego).toBeInstanceOf(Buffer);

      const recovered = await lsb.extract(stego);
      expect(recovered).toEqual(payload);
    });

    test('embeds and extracts longer payload', async () => {
      const image = await createTestImage(100, 100);
      const payload = new TextEncoder().encode(
        'The quick brown fox jumps over the lazy dog. '.repeat(10)
      );
      const stego = await lsb.embed(image, payload);
      const recovered = await lsb.extract(stego);
      expect(recovered).toEqual(payload);
    });

    test('stego image is visually similar (pixel diff <= 1)', async () => {
      const image = await createTestImage(10, 10);
      const payload = new Uint8Array([42]);
      const stego = await lsb.embed(image, payload);

      const origRaw = await sharp(image).ensureAlpha().raw().toBuffer();
      const stegoRaw = await sharp(stego).ensureAlpha().raw().toBuffer();

      let maxDiff = 0;
      for (let i = 0; i < origRaw.length; i++) {
        const diff = Math.abs(origRaw[i] - stegoRaw[i]);
        if (diff > maxDiff) maxDiff = diff;
      }
      expect(maxDiff).toBeLessThanOrEqual(1);
    });

    test('throws when image is too small', async () => {
      const image = await createTestImage(2, 2); // 4 pixels * 3 bits = 12 bits
      const payload = new Uint8Array(2); // 32 + 16 = 48 bits
      await expect(lsb.embed(image, payload)).rejects.toThrow(/Image too small/);
    });

    test('extract throws on image without enough header bits', async () => {
      const image = await createTestImage(1, 1); // 3 bits
      await expect(lsb.extract(image)).rejects.toThrow(/Image too small/);
    });
  });

  describe('Whitespace text steganography', () => {
    const carrier = `function hello() {
  console.log("Hello, world!");
}

// End of snippet`;

    test('encodes and decodes data in carrier text', () => {
      const payload = new TextEncoder().encode('Covert msg');
      const stego = whitespace.encode(carrier, payload);
      expect(stego).toContain('function hello()');
      expect(stego).not.toEqual(carrier); // trailing whitespace changed

      const recovered = whitespace.decode(stego);
      expect(recovered).toEqual(payload);
    });

    test('round-trips binary data', () => {
      const payload = new Uint8Array([0, 255, 128, 64, 32, 16, 8, 4, 2, 1]);
      const stego = whitespace.encode(carrier, payload);
      const recovered = whitespace.decode(stego);
      expect(recovered).toEqual(payload);
    });

    test('pads short carrier with extra lines', () => {
      const short = 'one line\nsecond line';
      const payload = new TextEncoder().encode('x'.repeat(5)); // 72 bits > 2 lines
      const stego = whitespace.encode(short, payload);
      const lines = stego.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(72); // at least 72 bits needed
      const recovered = whitespace.decode(stego);
      expect(recovered).toEqual(new TextEncoder().encode('x'.repeat(5)));
    });

    test('decode throws when no stego data present', () => {
      const plain = 'No hidden data here\nNone at all';
      expect(() => whitespace.decode(plain)).toThrow(/No steganographic data/);
    });

    test('decode throws on incomplete data', () => {
      // Manually craft: first line ends with space (0), second with tab (1)
      // That's only 2 bits, nowhere near a full length header
      const bad = 'line1 \nline2\t';
      expect(() => whitespace.decode(bad)).toThrow(/No steganographic data/);
    });

    test('preserves visible text content (modulo added padding lines)', () => {
      const payload = new TextEncoder().encode('hidden');
      const stego = whitespace.encode(carrier, payload);
      const lines = stego.split('\n');
      // Strip trailing whitespace from all lines
      const stripped = lines.map(l => l.replace(/[ \t]+$/, ''));
      // Original carrier lines should appear unchanged (minus trailing ws)
      const carrierLines = carrier.split('\n');
      carrierLines.forEach((line, idx) => {
        expect(stripped[idx]).toBe(line.replace(/[ \t]+$/, ''));
      });
      // Extra padding lines should look like harmless comments
      const extra = stripped.slice(carrierLines.length);
      extra.forEach(l => expect(l).toMatch(/^\/\/ \.\.\.$/));
    });
  });
});
