const { receive } = require('./core/receive');
const { getCurrentRendezvousId } = require('./rendezvous');

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const TICK_MS = 30 * 1000;
const JITTER_MIN_MS = 10 * 1000;
const JITTER_MAX_MS = 30 * 1000;
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

const activeContacts = new Map();

let _redisClient = null;
let _getContacts = null;
let _seenHashes = null;
let _tickInterval = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function init(redisClient, getContacts, seenHashes) {
  _redisClient = redisClient;
  _getContacts = getContacts;
  _seenHashes = seenHashes;
  _tickInterval = setInterval(runTick, TICK_MS);
}

function shutdown() {
  if (_tickInterval) {
    clearInterval(_tickInterval);
    _tickInterval = null;
  }
  activeContacts.clear();
}

function register(contactId) {
  const existing = activeContacts.get(contactId);
  activeContacts.set(contactId, {
    lastPollAt: existing ? existing.lastPollAt : 0,
    lastActivityAt: Date.now(),
  });
}

function deregister(contactId) {
  activeContacts.delete(contactId);
}

function isActive(contactId) {
  return activeContacts.has(contactId);
}

function _setLastPollAt(contactId, ts) {
  const s = activeContacts.get(contactId);
  if (s) s.lastPollAt = ts;
}

function _setLastActivity(contactId, ts) {
  const s = activeContacts.get(contactId);
  if (s) s.lastActivityAt = ts;
}

async function runTick() {
  const now = Date.now();

  for (const [contactId, state] of activeContacts) {
    if (now - state.lastActivityAt > INACTIVITY_TIMEOUT_MS) {
      activeContacts.delete(contactId);
    }
  }

  const due = [];
  for (const [contactId, state] of activeContacts) {
    if (now - state.lastPollAt >= POLL_INTERVAL_MS) {
      due.push(contactId);
    }
  }

  for (let i = 0; i < due.length; i++) {
    await pollContact(due[i]);
    if (i < due.length - 1) {
      const jitter = JITTER_MIN_MS + Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS);
      await sleep(jitter);
    }
  }
}

async function pollContact(contactId) {
  const state = activeContacts.get(contactId);
  if (!state) return;

  const contacts = await _getContacts();
  const contact = contacts.find(c => c.id === contactId);
  if (!contact || !contact.seed) return;

  if (!_seenHashes.has(contactId)) {
    _seenHashes.set(contactId, new Set());
  }

  try {
    const plaintext = await receive({
      seed: contact.seed,
      contactId,
      imgurClientId: process.env.IMGUR_CLIENT_ID,
      githubToken: process.env.GITHUB_TOKEN,
      githubUser: process.env.GITHUB_USER || contact.githubUser,
      seenHashes: _seenHashes.get(contactId),
    });

    if (plaintext) {
      const inbound = {
        id: `msg-recv-${Date.now()}`,
        contactId,
        text: plaintext,
        sent: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        meta: {
          rendezvousId: getCurrentRendezvousId(contact.seed, contactId),
          shardsFound: 3,
          channels: { imgur: 2, gist: 1 },
        },
      };

      const existing = await _redisClient.get(`messages:${contactId}`);
      const messages = existing ? JSON.parse(existing) : [];
      messages.push(inbound);
      const trimmed = messages.slice(-500);
      await _redisClient.setEx(`messages:${contactId}`, 172800, JSON.stringify(trimmed));
      await _redisClient.incr(`stats:recv:${contactId}`);
      await _redisClient.set(`stats:ratchet:${contactId}`, String(Date.now()));
    }

    state.lastPollAt = Date.now();
  } catch (err) {
    console.error(`Poller: receive failed for ${contactId}:`, err.message);
  }
}

module.exports = { init, shutdown, register, deregister, isActive, pollContact, runTick, _setLastPollAt, _setLastActivity };
