const { derive } = require('./hkdf');

/**
 * @module rendezvous
 * @description Time-based rendezvous protocol (L4).
 * Both parties independently compute the same rendezvous_id from a shared
 * seed and the current UTC wall-clock window (date + hour), then rotate
 * automatically every hour with zero server coordination.
 */

/**
 * Get the current UTC date string (YYYY-MM-DD) and hour (0–23).
 *
 * @returns {{date: string, hour: number}}
 */
function getRendezvousWindow() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = now.getUTCHours();
  return { date: `${year}-${month}-${day}`, hour };
}

/**
 * Compute the current rendezvous_id from the shared seed.
 *
 * @param {string} seed - The out-of-band shared seed phrase.
 * @returns {string}    - 32-char hex rendezvous_id for the current hour.
 */
function getCurrentRendezvousId(seed) {
  const { date, hour } = getRendezvousWindow();
  return derive(seed, date, hour);
}

/**
 * Compute the rendezvous_id for an arbitrary past or future window.
 * Useful for Bob to poll recent windows (e.g. current-1h, current, current+1h).
 *
 * @param {string} seed - Shared seed phrase.
 * @param {Date}   when - Arbitrary Date object.
 * @returns {string}    - 32-char hex rendezvous_id.
 */
function getRendezvousIdForDate(seed, when) {
  const year = when.getUTCFullYear();
  const month = String(when.getUTCMonth() + 1).padStart(2, '0');
  const day = String(when.getUTCDate()).padStart(2, '0');
  const hour = when.getUTCHours();
  return derive(seed, `${year}-${month}-${day}`, hour);
}

module.exports = {
  derive,
  getRendezvousWindow,
  getCurrentRendezvousId,
  getRendezvousIdForDate,
};
