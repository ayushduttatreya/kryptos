const axios = require('axios');

let cache = { imgur: 'unknown', gist: 'unknown', lastCheck: 0 };
const TTL = 60000;

async function checkExternalServices({ forceRefresh = false } = {}) {
  if (!forceRefresh && Date.now() - cache.lastCheck < TTL) return cache;

  const probe = async (url) => {
    try {
      await axios.head(url, { timeout: 5000 });
      return 'reachable';
    } catch (err) {
      // Any HTTP response (even 4xx) means the service is up.
      // Only network-level errors (no response) mean unreachable.
      if (err.response) return 'reachable';
      return 'unreachable';
    }
  };

  const [imgur, gist] = await Promise.all([
    probe('https://api.imgur.com/3/credits'),
    probe('https://api.github.com'),
  ]);

  cache = { imgur, gist, lastCheck: Date.now() };
  return cache;
}

module.exports = { checkExternalServices };
