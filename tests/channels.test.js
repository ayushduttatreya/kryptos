const { imgur, gist } = require('../src/channels');
const sharp = require('sharp');

// Integration tests: skipped unless real API credentials are present in .env.
// To run these, copy .env.example to .env and fill in real tokens.

const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_USER = process.env.GITHUB_USER || '';

const hasImgur = !!IMGUR_CLIENT_ID;
const hasGitHub = !!(GITHUB_TOKEN && GITHUB_USER);

describe('L0 Dead Drop Channels (integration)', () => {
  describe('Imgur', () => {
    let imageBuffer;

    beforeAll(async () => {
      imageBuffer = await sharp({
        create: { width: 20, height: 20, channels: 3, background: { r: 100, g: 150, b: 200 } },
      }).png().toBuffer();
    });

    (hasImgur ? test : test.skip)('uploads an image and returns a URL', async () => {
      const url = await imgur.upload(imageBuffer, IMGUR_CLIENT_ID, 'kryptos-test', 'test-desc');
      expect(typeof url).toBe('string');
      expect(url).toMatch(/^https:\/\//);
    }, 30000);

    (hasImgur ? test : test.skip)('fetches image buffer from URL', async () => {
      const url = await imgur.upload(imageBuffer, IMGUR_CLIENT_ID, 'kryptos-test');
      const fetched = await imgur.fetchImage(url);
      expect(Buffer.isBuffer(fetched)).toBe(true);
      expect(fetched.length).toBeGreaterThan(0);
    }, 30000);

    test('fetchImage throws on invalid URL', async () => {
      await expect(imgur.fetchImage('https://example.com/nonexistent.png')).rejects.toThrow();
    });
  });

  describe('GitHub Gist', () => {
    (hasGitHub ? test : test.skip)('creates and fetches a gist', async () => {
      const content = 'Hello from Kryptos test suite.';
      const id = await gist.create(content, GITHUB_TOKEN, 'kryptos-test', 'test.txt');
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);

      const fetched = await gist.fetch(id);
      expect(fetched).toBe(content);
    }, 30000);

    test('fetch throws on non-existent gist', async () => {
      await expect(gist.fetch('00000000000000000000')).rejects.toThrow();
    });
  });
});
