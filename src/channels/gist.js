const axios = require('axios');

/**
 * @module gist
 * @description GitHub Gist dead-drop channel (L0).
 * Creates public gists and retrieves them by ID.
 */

const API_BASE = 'https://api.github.com';

/**
 * Create a public GitHub Gist.
 *
 * @param {string} content       - File content (stego text or raw).
 * @param {string} token         - GitHub personal access token (from env).
 * @param {string} [description]- Optional gist description (rendezvous tag).
 * @param {string} [filename]    - Optional filename.
 * @returns {Promise<string>}    - Gist ID.
 * @throws {Error} On API failure.
 */
async function create(content, token, description = '', filename = 'notes.txt') {
  const resp = await axios.post(
    `${API_BASE}/gists`,
    {
      description,
      public: true,
      files: {
        [filename]: { content },
      },
    },
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );
  return resp.data.id;
}

/**
 * Fetch the raw content of a gist by ID.
 *
 * @param {string} gistId
 * @returns {Promise<string>}
 * @throws {Error} On API failure.
 */
async function fetch(gistId) {
  const resp = await axios.get(`${API_BASE}/gists/${gistId}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  // Return content of the first file
  const files = Object.values(resp.data.files);
  if (!files.length) {
    throw new Error(`Gist ${gistId} contains no files`);
  }
  return files[0].content;
}

/**
 * Poll a GitHub user's public gists and return those whose description
 * contains the given rendezvous_id.
 *
 * @param {string} rendezvousId - 32-char hex rendezvous tag.
 * @param {string} token          - GitHub token (for auth and higher rate limits).
 * @param {string} username       - GitHub username to poll.
 * @returns {Promise<string[]>}   - Array of matching gist contents.
 */
async function poll(rendezvousId, token, username) {
  const resp = await axios.get(`${API_BASE}/users/${username}/gists`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    params: { per_page: 100 },
  });

  const gists = resp.data || [];
  const matches = gists.filter(
    (g) => g.description && g.description.includes(rendezvousId)
  );

  // Fetch raw content for each match
  const contents = await Promise.all(
    matches.map(async (g) => {
      try {
        return await fetch(g.id);
      } catch (err) {
        return null;
      }
    })
  );
  return contents.filter(Boolean);
}

module.exports = { create, fetch, poll };
