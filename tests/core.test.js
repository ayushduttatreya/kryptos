const sharp = require('sharp');
const sodium = require('libsodium-wrappers');
const { send } = require('../src/core/send');
const { receive } = require('../src/core/receive');

describe('L6 Core Pipeline (integration)', () => {
  let imgurStore = {};
  let gistStore = {};
  let nextImgurId = 1;
  let nextGistId = 1;

  async function makeCarriers() {
    const img = await sharp({
      create: { width: 80, height: 80, channels: 3, background: { r: 120, g: 180, b: 60 } },
    }).png().toBuffer();
    return [
      { type: 'imgur', buffer: img },
      { type: 'gist', text: 'function example() {\n  return 42;\n}\n// notes' },
      { type: 'imgur', buffer: img },
      { type: 'gist', text: 'const x = 1;\nconst y = 2;\n' },
      { type: 'imgur', buffer: img },
      { type: 'gist', text: '# README\n\nHello world\n' },
      { type: 'imgur', buffer: img },
      { type: 'gist', text: 'class Foo {\n  bar() {}\n}\n' },
    ];
  }

  function buildOverrides() {
    imgurStore = {};
    gistStore = {};
    nextImgurId = 1;
    nextGistId = 1;

    return {
      router: (shards) =>
        shards.map((_, idx) => ({
          shardId: String(idx),
          channel: idx % 2 === 0 ? 'imgur' : 'gist',
          delayMs: 0,
        })),
      uploadImgur: async (buffer, rid) => {
        const id = `img-${nextImgurId++}`;
        imgurStore[id] = { buffer, rid };
        return `https://i.imgur.com/${id}.png`;
      },
      uploadGist: async (content, rid) => {
        const id = `gist-${nextGistId++}`;
        gistStore[id] = { content, rid };
        return id;
      },
      pollImgur: async (rid) => {
        return Object.entries(imgurStore)
          .filter(([, v]) => v.rid === rid)
          .map(([k]) => `https://i.imgur.com/${k}.png`);
      },
      pollGist: async (rid) => {
        return Object.entries(gistStore)
          .filter(([, v]) => v.rid === rid)
          .map(([, v]) => v.content);
      },
      fetchImage: async (url) => {
        const id = url.replace('https://i.imgur.com/', '').replace('.png', '');
        if (!imgurStore[id]) throw new Error('Not found');
        return imgurStore[id].buffer;
      },
    };
  }

  beforeAll(async () => {
    await sodium.ready;
  });

  test('Alice sends, Bob receives, message matches', async () => {
    const seed = 'qr-scanned-seed-phrase-42';
    const message = 'Meet at the clock tower at midnight. Bring the package.';
    const carriers = await makeCarriers();
    const overrides = buildOverrides();

    // Alice sends
    const receipts = await send({
      message,
      seed,
      carriers,
      overrides,
    });

    expect(receipts.length).toBeGreaterThan(0);

    // Bob receives (same seed, same overrides)
    const recovered = await receive({
      seed,
      overrides: {
        pollImgur: overrides.pollImgur,
        pollGist: overrides.pollGist,
        fetchImage: overrides.fetchImage,
      },
    });

    expect(recovered).toBe(message);
  }, 30000);

  test('returns null when no shards are found', async () => {
    const overrides = buildOverrides();
    const recovered = await receive({
      seed: 'empty-seed',
      overrides: {
        pollImgur: overrides.pollImgur,
        pollGist: overrides.pollGist,
        fetchImage: overrides.fetchImage,
      },
    });
    expect(recovered).toBeNull();
  });

  test('survives missing shards (3-of-5)', async () => {
    const seed = 'resilient-seed-007';
    const message = 'This message must survive two dead drops being unavailable.';
    const carriers = await makeCarriers();
    const overrides = buildOverrides();

    const receipts = await send({
      message,
      seed,
      carriers,
      overrides,
    });

    // Delete 2 imgur uploads to simulate dead drops going offline
    const imgurReceipts = receipts.filter((r) => r.channel === 'imgur');
    expect(imgurReceipts.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 2; i++) {
      const id = imgurReceipts[i].url.replace('https://i.imgur.com/', '').replace('.png', '');
      delete imgurStore[id];
    }

    const recovered = await receive({
      seed,
      overrides: {
        pollImgur: overrides.pollImgur,
        pollGist: overrides.pollGist,
        fetchImage: overrides.fetchImage,
      },
    });

    expect(recovered).toBe(message);
  }, 30000);

  test('rejects tampered shard (integrity check)', async () => {
    const seed = 'tamper-seed-99';
    const message = 'Sensitive data';
    const carriers = await makeCarriers();
    const overrides = buildOverrides();

    const receipts = await send({
      message,
      seed,
      carriers,
      overrides,
    });

    // Tamper one imgur image by re-saving with a pixel flipped
    const imgurReceipt = receipts.find((r) => r.channel === 'imgur');
    expect(imgurReceipt).toBeDefined();
    const id = imgurReceipt.url.replace('https://i.imgur.com/', '').replace('.png', '');
    const buf = imgurStore[id].buffer;
    // Corrupt the raw pixel data by writing noise into early bytes
    const raw = await sharp(buf).ensureAlpha().raw().toBuffer();
    raw[0] ^= 0xFF; // flip a pixel channel
    const corrupted = await sharp(raw, {
      raw: { width: 80, height: 80, channels: 4 },
    }).png().toBuffer();
    imgurStore[id].buffer = corrupted;

    // Bob should still recover because only 1 of 5 shards is bad
    const recovered = await receive({
      seed,
      overrides: {
        pollImgur: overrides.pollImgur,
        pollGist: overrides.pollGist,
        fetchImage: overrides.fetchImage,
      },
    });

    expect(recovered).toBe(message);
  }, 30000);
});
