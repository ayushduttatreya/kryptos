/**
 * @module routing
 * @description Routing orchestration layer (L3).
 * Combines AI-driven shard assignment with cover-traffic generation.
 */

const { route } = require('./aiRouter');
const { generate: generateCoverTraffic, FAKE_RATIO } = require('./coverTraffic');

module.exports = {
  route,
  generateCoverTraffic,
  FAKE_RATIO,
};
