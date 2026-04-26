const axios = require('axios');
const FormData = require('form-data');

/**
 * @module imgur
 * @description Imgur dead-drop channel (L0).
 * Uploads stego images anonymously or via Client-ID, and retrieves them by URL.
 */

const API_BASE = 'https://api.imgur.com/3';

/**
 * Upload a raw image buffer to Imgur.
 *
 * @param {Buffer} imageBuffer  - PNG/JPEG bytes.
 * @param {string} clientId     - Imgur API Client ID (from env).
 * @param {string} [title]      - Optional title (may include rendezvous tag).
 * @param {string} [description]- Optional description.
 * @returns {Promise<string>}   - Public direct image URL.
 * @throws {Error} On API failure.
 */
async function upload(imageBuffer, clientId, title = '', description = '') {
  const form = new FormData();
  form.append('image', imageBuffer.toString('base64'));
  if (title) form.append('title', title);
  if (description) form.append('description', description);

  const resp = await axios.post(`${API_BASE}/image`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Client-ID ${clientId}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  if (!resp.data || !resp.data.success) {
    throw new Error(`Imgur upload failed: ${resp.data?.data?.error || 'unknown'}`);
  }
  return resp.data.data.link;
}

/**
 * Fetch a raw image buffer from a public Imgur URL.
 *
 * @param {string} url
 * @returns {Promise<Buffer>}
 * @throws {Error} On network failure.
 */
async function fetchImage(url) {
  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
  });
  return Buffer.from(resp.data);
}

/**
 * Poll Imgur gallery search for images whose title or description
 * contain the given rendezvous_id.
 *
 * @param {string} rendezvousId - 32-char hex rendezvous tag.
 * @param {string} clientId     - Imgur API Client ID.
 * @returns {Promise<string[]>} - Array of matching image URLs.
 */
async function poll(rendezvousId, clientId) {
  const resp = await axios.get(
    `${API_BASE}/gallery/search/time/all/0`,
    {
      params: { q: rendezvousId },
      headers: { Authorization: `Client-ID ${clientId}` },
    }
  );

  const items = resp.data?.data || [];
  return items
    .filter(
      (item) =>
        (item.title && item.title.includes(rendezvousId)) ||
        (item.description && item.description.includes(rendezvousId))
    )
    .map((item) => item.link || item.images?.[0]?.link)
    .filter(Boolean);
}

module.exports = { upload, fetchImage, poll };
