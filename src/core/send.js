const { keyExchange, encrypt, shard, integrity } = require('../crypto');
const { getCurrentRendezvousId } = require('../rendezvous');
const { lsb, whitespace } = require('../stego');
const { route } = require('../routing/aiRouter');
const { generate: generateCoverTraffic } = require('../routing/coverTraffic');

/**
 * @module send
 * @description Full send pipeline (L6 outbound).
 * Orchestrates: deterministic keypair → ephemeral keypair → X25519 shared
 * secret → XSalsa20 encryption → Shamir 3-of-5 sharding → integrity hashes
 * → rendezvous tagging → AI routing → steganographic embedding → upload.
 */

/**
 * Send a covert message.
 *
 * @param {Object} opts
 * @param {string} opts.message       - Plaintext message.
 * @param {string} opts.seed          - Shared seed phrase.
 * @param {Array<Object>} opts.carriers - Stego carriers:
 *   { type:'imgur', buffer:Buffer } or { type:'gist', text:string }.
 * @param {string} opts.openrouterKey - OpenRouter API key (from env).
 * @param {string} opts.imgurClientId - Imgur Client ID (from env).
 * @param {string} opts.githubToken   - GitHub token (from env).
 * @param {Object} [opts.overrides]   - Test overrides for router/channels.
 * @returns {Promise<Array<Object>>}  - Upload receipts.
 * @throws {Error} On pipeline failure.
 */
async function send(opts) {
  const { message, seed, carriers, openrouterKey, imgurClientId, githubToken, overrides = {} } = opts;

  if (!message || !seed || !carriers || carriers.length === 0) {
    throw new Error('send requires message, seed, and at least one carrier');
  }

  // 1. Derive deterministic static keypair from seed
  const staticKp = keyExchange.deriveKeypairFromSeed(seed);

  // 2. Generate ephemeral keypair for forward secrecy
  const ephemeralKp = keyExchange.generateKeypair();

  // 3. Shared secret = ephemeral_priv × static_pub (commutative, so Bob can
  //    recompute with static_priv × ephemeral_pub).
  const sharedSecret = keyExchange.deriveSharedSecret(
    ephemeralKp.privateKey,
    staticKp.publicKey
  );

  // 4. Encrypt plaintext
  const ciphertext = encrypt.encrypt(message, sharedSecret);

  // 5. Prepend ephemeral public key (32 bytes) so Bob can derive the same secret
  const payload = new Uint8Array(32 + ciphertext.length);
  payload.set(ephemeralKp.publicKey, 0);
  payload.set(ciphertext, 32);

  // 6. Shamir split (3-of-5)
  const shares = shard.split(payload);

  // 7. Attach BLAKE2b hash to each shard
  const hashedShares = shares.map((s) => ({
    shard: s,
    hash: integrity.hash(s),
  }));

  // 8. Rendezvous tag
  const rendezvousId = getCurrentRendezvousId(seed);
  const taggedShares = hashedShares.map((hs) => ({
    ...hs,
    rendezvousId,
  }));

  // 9. Cover traffic: 3 fake per real shard
  const fakes = generateCoverTraffic(taggedShares.length, taggedShares[0].shard.length);
  const allShards = [
    ...taggedShares.map((t) => ({ ...t, isFake: false })),
    ...fakes.map((f) => ({ ...f, rendezvousId, hash: integrity.hash(f.shard) })),
  ];

  // 10. AI routing
  let assignments;
  if (overrides.router) {
    assignments = overrides.router(allShards);
  } else if (openrouterKey) {
    const channelStatus = { imgur: { load: 0.3 }, gist: { load: 0.2 } };
    assignments = await route(
      allShards.map((s, idx) => ({ id: idx, size: s.shard.length, urgency: !s.isFake })),
      channelStatus,
      openrouterKey
    );
  } else {
    // Fallback deterministic round-robin when no AI key
    assignments = allShards.map((_, idx) => ({
      shardId: String(idx),
      channel: idx % 2 === 0 ? 'imgur' : 'gist',
      delayMs: 0,
    }));
  }

  // 11. Embed each shard into its assigned carrier and upload
  const results = [];
  for (let i = 0; i < allShards.length; i++) {
    const assignment = assignments.find((a) => a.shardId === String(i));
    if (!assignment) continue;

    const carrier = carriers[i % carriers.length];
    const shardPacket = `${allShards[i].shard}|${allShards[i].hash}`;
    let stegoData;

    if (assignment.channel === 'imgur' || carrier.type === 'imgur') {
      if (!carrier.buffer) throw new Error('Imgur carrier requires an image buffer');
      const shardBytes = Buffer.from(shardPacket);
      stegoData = await lsb.embed(carrier.buffer, shardBytes);
      if (overrides.uploadImgur) {
        const url = await overrides.uploadImgur(stegoData, rendezvousId);
        results.push({ channel: 'imgur', url, shardIdx: i });
      } else if (imgurClientId) {
        const { upload: imgurUpload } = require('../channels/imgur');
        const url = await imgurUpload(stegoData, imgurClientId, rendezvousId);
        results.push({ channel: 'imgur', url, shardIdx: i });
      } else {
        throw new Error('Imgur upload requires imgurClientId or override');
      }
    } else {
      if (!carrier.text) throw new Error('Gist carrier requires text');
      const stegoText = whitespace.encode(carrier.text, Buffer.from(shardPacket));
      if (overrides.uploadGist) {
        const id = await overrides.uploadGist(stegoText, rendezvousId);
        results.push({ channel: 'gist', id, shardIdx: i });
      } else if (githubToken) {
        const { create: gistCreate } = require('../channels/gist');
        const id = await gistCreate(stegoText, githubToken, rendezvousId);
        results.push({ channel: 'gist', id, shardIdx: i });
      } else {
        throw new Error('Gist upload requires githubToken or override');
      }
    }
  }

  return results;
}

module.exports = { send };
