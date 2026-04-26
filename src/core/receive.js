const { keyExchange, encrypt, shard, integrity } = require('../crypto');
const { getCurrentRendezvousId, getRendezvousIdForDate } = require('../rendezvous');
const { lsb, whitespace } = require('../stego');

/**
 * @module receive
 * @description Full receive pipeline (L6 inbound).
 * Orchestrates: poll → detect → extract → reconstruct → decrypt.
 */

const POLL_HOURS = 2; // How many past/future hours to poll

/**
 * Receive a covert message.
 *
 * @param {Object} opts
 * @param {string} opts.seed          - Shared seed phrase.
 * @param {string} [opts.imgurClientId] - Imgur Client ID (from env).
 * @param {string} [opts.githubToken]   - GitHub token (from env).
 * @param {string} [opts.githubUser]    - GitHub username to poll.
 * @param {Object} [opts.overrides]     - Test overrides for channels/stego.
 * @returns {Promise<string|null>}      - Decrypted plaintext or null if nothing found.
 * @throws {Error} On pipeline failure.
 */
async function receive(opts) {
  const { seed, imgurClientId, githubToken, githubUser, overrides = {} } = opts;

  if (!seed) {
    throw new Error('receive requires seed');
  }

  // 1. Generate rendezvous windows to poll (current ± hours)
  const now = new Date();
  const windows = [];
  for (let h = -POLL_HOURS; h <= POLL_HOURS; h++) {
    const d = new Date(now.getTime() + h * 3600 * 1000);
    windows.push(getRendezvousIdForDate(seed, d));
  }
  // Also include the exact current hour
  windows.push(getCurrentRendezvousId(seed));
  const uniqueWindows = [...new Set(windows)];

  // 2. Poll all channels for each rendezvous window
  const foundItems = [];
  for (const rid of uniqueWindows) {
    if (overrides.pollImgur) {
      const urls = await overrides.pollImgur(rid);
      for (const url of urls) {
        foundItems.push({ channel: 'imgur', url, rid });
      }
    } else if (imgurClientId) {
      const { poll: imgurPoll } = require('../channels/imgur');
      const urls = await imgurPoll(rid, imgurClientId);
      for (const url of urls) {
        foundItems.push({ channel: 'imgur', url, rid });
      }
    }

    if (overrides.pollGist) {
      const contents = await overrides.pollGist(rid);
      for (const content of contents) {
        foundItems.push({ channel: 'gist', content, rid });
      }
    } else if (githubToken && githubUser) {
      const { poll: gistPoll } = require('../channels/gist');
      const contents = await gistPoll(rid, githubToken, githubUser);
      for (const content of contents) {
        foundItems.push({ channel: 'gist', content, rid });
      }
    }
  }

  if (foundItems.length === 0) {
    return null;
  }

  // 3. Extract stego data from each found item
  const rawPackets = [];
  for (const item of foundItems) {
    try {
      if (item.channel === 'imgur') {
        let imgBuf;
        if (overrides.fetchImage) {
          imgBuf = await overrides.fetchImage(item.url);
        } else {
          const { fetchImage } = require('../channels/imgur');
          imgBuf = await fetchImage(item.url);
        }
        const extracted = await lsb.extract(imgBuf);
        rawPackets.push({ rid: item.rid, packet: Buffer.from(extracted).toString('utf-8') });
      } else {
        let content = item.content;
        const extracted = whitespace.decode(content);
        rawPackets.push({ rid: item.rid, packet: Buffer.from(extracted).toString('utf-8') });
      }
    } catch (_err) {
      // Not a stego item or extraction failed; skip
    }
  }

  // 4. Parse packets: "shard|hash"
  const validShards = [];
  for (const { packet } of rawPackets) {
    const lastPipe = packet.lastIndexOf('|');
    if (lastPipe === -1) continue;
    const shardStr = packet.slice(0, lastPipe);
    const hash = packet.slice(lastPipe + 1);
    if (!shardStr || !hash) continue;
    if (integrity.verify(shardStr, hash)) {
      validShards.push(shardStr);
    }
  }

  if (validShards.length < shard.THRESHOLD) {
    return null; // Not enough shards to reconstruct
  }

  // 5. Reconstruct payload by trying combinations of 3 shards.
  // Fake shards pass the integrity check but fail Shamir reconstruction,
  // so we brute-force combinations until one reconstructs successfully.
  let payload;
  let reconstructed = false;
  const n = validShards.length;
  for (let i = 0; i < n - 2 && !reconstructed; i++) {
    for (let j = i + 1; j < n - 1 && !reconstructed; j++) {
      for (let k = j + 1; k < n && !reconstructed; k++) {
        try {
          payload = shard.reconstruct([validShards[i], validShards[j], validShards[k]]);
          reconstructed = true;
        } catch (_e) {
          // continue trying next combination
        }
      }
    }
  }
  if (!reconstructed) {
    return null;
  }

  // 6. Extract ephemeral public key and ciphertext
  if (payload.length < 32 + 24 + 16) {
    throw new Error('Reconstructed payload too small to contain ephemeral key + ciphertext');
  }
  const ephemeralPub = payload.slice(0, 32);
  const ciphertext = payload.slice(32);

  // 7. Derive static keypair from seed and compute shared secret
  const staticKp = keyExchange.deriveKeypairFromSeed(seed);
  const sharedSecret = keyExchange.deriveSharedSecret(staticKp.privateKey, ephemeralPub);

  // 8. Decrypt
  const plaintext = encrypt.decrypt(ciphertext, sharedSecret);
  return plaintext;
}

module.exports = { receive };
