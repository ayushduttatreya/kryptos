const crypto = require('crypto');

/**
 * @module aiRouter
 * @description Local CSPRNG shard router (L3).
 * Uses crypto.randomBytes for channel selection and uniform jitter in 500–8000ms.
 * Synchronous — no network calls, no third-party metadata leakage.
 */

const CHANNELS = ['imgur', 'gist'];
const JITTER_MIN = 500;
const JITTER_MAX = 8000;

/**
 * Assign each shard to a channel with random jitter.
 *
 * @param {Array<{id: number|string, size: number, urgency: boolean}>} shards
 * @returns {Array<{shardId: string, channel: string, delayMs: number}>}
 */
function route(shards) {
  if (!Array.isArray(shards) || shards.length === 0) {
    throw new Error('Shards array must be non-empty');
  }

  return shards.map((s) => {
    const channelByte = crypto.randomBytes(1)[0];
    const jitterBytes = crypto.randomBytes(2).readUInt16BE(0);
    const channel = CHANNELS[channelByte & 1];
    const delayMs = JITTER_MIN + Math.floor((jitterBytes / 65535) * (JITTER_MAX - JITTER_MIN));

    return {
      shardId: String(s.id ?? s.shardId ?? 'unknown'),
      channel,
      delayMs,
    };
  });
}

module.exports = { route };
