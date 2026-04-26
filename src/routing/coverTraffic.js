const sodium = require('libsodium-wrappers');

/**
 * @module coverTraffic
 * @description Generates fake shards structurally identical to real shards.
 * Used to pad the traffic profile and reduce correlation attacks (L3).
 * Ratio: 3 fake per 1 real shard.
 */

const FAKE_RATIO = 3;

/**
 * Produce structurally identical fake shards to confuse traffic analysis.
 *
 * Each fake shard:
 *   - is a random hex string of the same length as a typical real share
 *   - carries a unique fake_id
 *   - is indistinguishable from a real Shamir share at the transport layer
 *
 * @param {number} realShardCount - Number of genuine shards.
 * @param {number} [shardLength]  - Target hex char length per fake shard (default 64).
 * @returns {Array<Object>}        - Fake shard objects: { id, shard, isFake: true }.
 */
function generate(realShardCount, shardLength = 64) {
  if (!Number.isInteger(realShardCount) || realShardCount < 0) {
    throw new Error('realShardCount must be a non-negative integer');
  }

  const count = realShardCount * FAKE_RATIO;
  const fakes = [];
  for (let i = 0; i < count; i++) {
    const bytes = sodium.randombytes_buf(Math.ceil(shardLength / 2));
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, shardLength);
    fakes.push({
      id: `fake-${i}`,
      shard: hex,
      isFake: true,
    });
  }
  return fakes;
}

module.exports = { generate, FAKE_RATIO };
