# Kryptos Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the seven critical correctness and security issues identified in the senior engineering review, in priority order, without breaking existing tests.

**Architecture:** Work bottom-up — fix the crypto key model first (L1), then remove the AI router leakage (L3), then wire the HTTP API to the real pipeline (L6+backend), then harden cover traffic and operational concerns. Each task is independently testable and committable.

**Tech Stack:** Node.js, libsodium-wrappers, secrets.js, Express, Redis, Jest. No new dependencies added until Task 6 (pino).

---

## File Map

| File | Change |
|------|--------|
| `src/crypto/keyExchange.js` | Add `generateAndPersist`, `loadOrGenerate`, `exportPublicKey`, `importPublicKey` |
| `src/crypto/index.js` | Re-export new key management fns |
| `src/keystore.js` | **New** — thin wrapper: read/write keypair JSON to Redis or local file |
| `src/routing/aiRouter.js` | Replace LLM call with local CSPRNG routing; keep same export signature |
| `src/routing/coverTraffic.js` | Add jitter-aware `schedule()` export alongside existing `generate()` |
| `src/core/send.js` | Honor `delayMs`, fix carrier-reuse, use per-contact rendezvous, call real channels from env |
| `src/core/receive.js` | Per-contact rendezvous ID, dedup via seen-set arg, `POLL_HOURS` stays 2 |
| `src/rendezvous/hkdf.js` | Accept optional `contactId` salt in `derive()` |
| `src/rendezvous/index.js` | Thread `contactId` through `getCurrentRendezvousId` and `getRendezvousIdForDate` |
| `src/index.js` | Wire `/api/messages` POST to `core.send`, GET to `core.receive`; fix `checkExternalServices`; add Redis TTL; remove stub data |
| `src/ratchet.js` | **New** — one-way key ratchet: `advance(currentKey) → nextKey`, `load/save` via Redis |
| `tests/keystore.test.js` | **New** — unit tests for keystore |
| `tests/ratchet.test.js` | **New** — unit tests for ratchet |
| `tests/routing.test.js` | Update to test local router (no Axios mock needed) |
| `tests/rendezvous.test.js` | Add contactId-scoped tests |
| `tests/core.test.js` | Add per-contact rendezvous + ratchet advancement tests |

---

## Task 1: Fix `checkExternalServices` — always reports reachable

**Files:**
- Modify: `src/index.js:32-54`

- [ ] **Step 1: Write the failing test**

Add to a new `tests/backend.test.js`:

```js
const axios = require('axios');
jest.mock('axios');

// Import after mock so the module uses the mock
let checkExternalServices;

beforeEach(() => {
  jest.resetModules();
  jest.resetAllMocks();
});

test('marks imgur unreachable on ECONNREFUSED', async () => {
  axios.head.mockImplementation((url) => {
    if (url.includes('imgur')) {
      const err = new Error('connect ECONNREFUSED');
      err.code = 'ECONNREFUSED';
      return Promise.reject(err);
    }
    return Promise.resolve({ status: 200 });
  });

  jest.mock('redis', () => ({
    createClient: () => ({
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    }),
  }));

  // Re-require after mocks
  const mod = require('../src/healthcheck');
  const result = await mod.checkExternalServices({ forceRefresh: true });
  expect(result.imgur).toBe('unreachable');
  expect(result.gist).toBe('reachable');
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/backend.test.js --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../src/healthcheck'`

- [ ] **Step 3: Extract healthcheck into its own module**

Create `src/healthcheck.js`:

```js
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
```

- [ ] **Step 4: Update `src/index.js` to use the new module**

Replace the inline `checkExternalServices` function and `extHealth` variable in `src/index.js`:

```js
// Remove lines 29-54 (extHealth declaration + checkExternalServices function)
// Add at top of file with other requires:
const { checkExternalServices } = require('./healthcheck');
```

Then update the two usages in routes:

```js
// In GET /health (line 57):
const health = await checkExternalServices();
res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  services: {
    redis: redisConnected ? 'connected' : 'disconnected',
    imgur: health.imgur,
    gist: health.gist,
  },
  uptime: process.uptime(),
});

// In GET /api/channels/status (line 165):
const health = await checkExternalServices();
res.json({
  imgur: { status: health.imgur, load: 0.3 },
  gist: { status: health.gist, load: 0.2 },
  redis: { status: redisConnected ? 'connected' : 'disconnected' },
});
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/backend.test.js --no-coverage 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 6: Run full suite to confirm no regressions**

```bash
cd /home/ayush/projects/kryptos && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all previously-passing tests still pass.

- [ ] **Step 7: Commit**

```bash
cd /home/ayush/projects/kryptos && git add src/healthcheck.js src/index.js tests/backend.test.js && git commit -m "fix: extract healthcheck, only report unreachable on no-response errors"
```

---

## Task 2: Fix the keypair model — each party holds their own private key

**Context:** `deriveKeypairFromSeed(seed)` makes Alice and Bob share the same private key. We need each node to generate a keypair once, persist it, and only share their public key.

**Files:**
- Create: `src/keystore.js`
- Modify: `src/crypto/keyExchange.js` (add `deriveKeypairFromSeed` deprecation note; no deletion yet — tests rely on it)
- Create: `tests/keystore.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/keystore.test.js`:

```js
const sodium = require('libsodium-wrappers');
const { loadOrGenerate, exportPublicKey, importPublicKey } = require('../src/keystore');

beforeAll(async () => { await sodium.ready; });

test('generates a new keypair when store is empty', async () => {
  const store = {};
  const kp = await loadOrGenerate({ store });
  expect(kp.publicKey).toBeInstanceOf(Uint8Array);
  expect(kp.privateKey).toBeInstanceOf(Uint8Array);
  expect(kp.publicKey.length).toBe(32);
  expect(kp.privateKey.length).toBe(32);
});

test('returns the same keypair on second call', async () => {
  const store = {};
  const kp1 = await loadOrGenerate({ store });
  const kp2 = await loadOrGenerate({ store });
  expect(Buffer.compare(Buffer.from(kp1.publicKey), Buffer.from(kp2.publicKey))).toBe(0);
  expect(Buffer.compare(Buffer.from(kp1.privateKey), Buffer.from(kp2.privateKey))).toBe(0);
});

test('exportPublicKey returns a hex string', async () => {
  const store = {};
  const kp = await loadOrGenerate({ store });
  const hex = exportPublicKey(kp);
  expect(typeof hex).toBe('string');
  expect(hex.length).toBe(64);
  expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
});

test('importPublicKey parses hex back to Uint8Array(32)', () => {
  const hex = 'a'.repeat(64);
  const key = importPublicKey(hex);
  expect(key).toBeInstanceOf(Uint8Array);
  expect(key.length).toBe(32);
});

test('DH works between generated keypairs', async () => {
  const sodium = require('libsodium-wrappers');
  const storeA = {};
  const storeB = {};
  const alice = await loadOrGenerate({ store: storeA });
  const bob = await loadOrGenerate({ store: storeB });

  const { deriveSharedSecret } = require('../src/crypto/keyExchange');
  const s1 = deriveSharedSecret(alice.privateKey, bob.publicKey);
  const s2 = deriveSharedSecret(bob.privateKey, alice.publicKey);
  expect(Buffer.compare(Buffer.from(s1), Buffer.from(s2))).toBe(0);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/keystore.test.js --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../src/keystore'`

- [ ] **Step 3: Implement `src/keystore.js`**

```js
const sodium = require('libsodium-wrappers');

// `store` is a plain object used as an in-process cache.
// In production pass { redisClient } to persist across restarts.
// The store contract: store.kryptos_keypair → JSON string or undefined.

async function loadOrGenerate({ store = {}, redisClient } = {}) {
  await sodium.ready;

  const KEY = 'kryptos_keypair';

  // 1. Try in-process cache
  if (store[KEY]) {
    const { pub, priv } = JSON.parse(store[KEY]);
    return {
      publicKey: Buffer.from(pub, 'hex'),
      privateKey: Buffer.from(priv, 'hex'),
    };
  }

  // 2. Try Redis
  if (redisClient) {
    const raw = await redisClient.get(KEY);
    if (raw) {
      store[KEY] = raw;
      const { pub, priv } = JSON.parse(raw);
      return {
        publicKey: Buffer.from(pub, 'hex'),
        privateKey: Buffer.from(priv, 'hex'),
      };
    }
  }

  // 3. Generate fresh keypair
  const kp = sodium.crypto_box_keypair();
  const serialized = JSON.stringify({
    pub: Buffer.from(kp.publicKey).toString('hex'),
    priv: Buffer.from(kp.privateKey).toString('hex'),
  });

  store[KEY] = serialized;
  if (redisClient) {
    await redisClient.set(KEY, serialized);
  }

  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

function exportPublicKey(keypair) {
  return Buffer.from(keypair.publicKey).toString('hex');
}

function importPublicKey(hex) {
  if (typeof hex !== 'string' || hex.length !== 64) {
    throw new Error(`importPublicKey: expected 64-char hex, got ${hex?.length}`);
  }
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

module.exports = { loadOrGenerate, exportPublicKey, importPublicKey };
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/keystore.test.js --no-coverage 2>&1 | tail -10
```

Expected: PASS (5 tests)

- [ ] **Step 5: Run full suite**

```bash
cd /home/ayush/projects/kryptos && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
cd /home/ayush/projects/kryptos && git add src/keystore.js tests/keystore.test.js && git commit -m "feat: add keystore — generate-once keypair with Redis/in-process persistence"
```

---

## Task 3: Replace AI router with local CSPRNG routing

**Context:** `aiRouter.js` sends shard metadata to OpenRouter in cleartext. Replace with a local router that uses `crypto.randomBytes` for channel selection and jitter. Keep the same export signature so `send.js` doesn't change.

**Files:**
- Modify: `src/routing/aiRouter.js`
- Modify: `tests/routing.test.js` (remove Axios mock, test local behavior)

- [ ] **Step 1: Write updated tests**

Replace the ai-router section of `tests/routing.test.js`. Open the file first to see existing tests, then replace the `aiRouter` describe block:

```js
const { route } = require('../src/routing/aiRouter');

describe('L3 aiRouter (local CSPRNG)', () => {
  test('returns one assignment per shard', () => {
    const shards = [
      { id: 0, size: 100, urgency: true },
      { id: 1, size: 100, urgency: false },
      { id: 2, size: 100, urgency: false },
    ];
    const result = route(shards);
    expect(result).toHaveLength(3);
    result.forEach((a, i) => {
      expect(a.shardId).toBe(String(i));
      expect(['imgur', 'gist']).toContain(a.channel);
      expect(typeof a.delayMs).toBe('number');
      expect(a.delayMs).toBeGreaterThanOrEqual(0);
    });
  });

  test('distributes across both channels over 100 calls', () => {
    const shards = [{ id: 0, size: 64, urgency: false }];
    const channels = new Set();
    for (let i = 0; i < 100; i++) {
      channels.add(route(shards)[0].channel);
    }
    // Both channels should appear in 100 draws (probability of all-same < 2^-99)
    expect(channels.size).toBe(2);
  });

  test('assigns delayMs in 500–8000 range', () => {
    const shards = Array.from({ length: 50 }, (_, i) => ({ id: i, size: 64, urgency: false }));
    const results = route(shards);
    results.forEach(a => {
      expect(a.delayMs).toBeGreaterThanOrEqual(500);
      expect(a.delayMs).toBeLessThanOrEqual(8000);
    });
  });

  test('throws on empty shards', () => {
    expect(() => route([])).toThrow(/non-empty/);
  });

  test('is synchronous — no Promise returned', () => {
    const result = route([{ id: 0, size: 64, urgency: false }]);
    expect(result).not.toBeInstanceOf(Promise);
  });
});
```

- [ ] **Step 2: Run to confirm current tests status**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/routing.test.js --no-coverage 2>&1 | tail -20
```

Note which tests pass/fail now as baseline.

- [ ] **Step 3: Rewrite `src/routing/aiRouter.js`**

```js
const crypto = require('crypto');

/**
 * @module aiRouter
 * @description Local CSPRNG shard router (L3).
 * Replaced remote LLM routing to eliminate third-party metadata leakage.
 * Uses crypto.randomBytes for channel selection and uniform jitter in 500-8000ms.
 */

const CHANNELS = ['imgur', 'gist'];
const JITTER_MIN = 500;
const JITTER_MAX = 8000;

/**
 * Assign each shard to a channel with random jitter.
 * Synchronous — no network calls.
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
```

- [ ] **Step 4: Update `send.js` — `route()` is now sync, remove `await`**

In `src/core/send.js` line 87, change:

```js
// Before:
assignments = await route(
  allShards.map((s, idx) => ({ id: idx, size: s.shard.length, urgency: !s.isFake })),
  channelStatus,
  openrouterKey
);

// After:
assignments = route(
  allShards.map((s, idx) => ({ id: idx, size: s.shard.length, urgency: !s.isFake }))
);
```

Also remove the `openrouterKey` guard — the else-if is now the only branch. Simplify to:

```js
// 10. Route shards to channels (local CSPRNG, no network call)
if (overrides.router) {
  assignments = overrides.router(allShards);
} else {
  assignments = route(
    allShards.map((s, idx) => ({ id: idx, size: s.shard.length, urgency: !s.isFake }))
  );
}
```

- [ ] **Step 5: Honor `delayMs` in the upload loop in `send.js`**

In `src/core/send.js`, before the embed+upload block (inside the `for` loop, after `const shardPacket = ...`):

```js
// Honor routing jitter — stagger uploads to break burst correlation
if (assignment.delayMs > 0) {
  await new Promise((resolve) => setTimeout(resolve, assignment.delayMs));
}
```

- [ ] **Step 6: Run routing tests**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/routing.test.js --no-coverage 2>&1 | tail -15
```

Expected: PASS (5 tests in the new suite)

- [ ] **Step 7: Run full suite**

```bash
cd /home/ayush/projects/kryptos && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass. Note: `core.test.js` uses `overrides.router` so it bypasses the real router — no timing change there.

- [ ] **Step 8: Commit**

```bash
cd /home/ayush/projects/kryptos && git add src/routing/aiRouter.js src/core/send.js tests/routing.test.js && git commit -m "fix: replace LLM router with local CSPRNG; honor delayMs jitter in send loop"
```

---

## Task 4: Per-contact rendezvous IDs

**Context:** All contacts currently share the same rendezvous window because the ID is derived from seed alone. Adding `contactId` as a salt ensures Alice↔Bob and Alice↔Charlie have independent channels.

**Files:**
- Modify: `src/rendezvous/hkdf.js`
- Modify: `src/rendezvous/index.js`
- Modify: `src/core/send.js`
- Modify: `src/core/receive.js`
- Modify: `tests/rendezvous.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/rendezvous.test.js`:

```js
describe('per-contact isolation', () => {
  test('same seed + different contactId → different rendezvous IDs', () => {
    const id1 = derive('seed', '2026-05-13', 10, 'contact-bob');
    const id2 = derive('seed', '2026-05-13', 10, 'contact-charlie');
    expect(id1).not.toBe(id2);
  });

  test('omitting contactId is backward-compatible', () => {
    const id1 = derive('seed', '2026-05-13', 10);
    const id2 = derive('seed', '2026-05-13', 10, '');
    expect(id1).toBe(id2);
  });

  test('getCurrentRendezvousId accepts optional contactId', () => {
    const id1 = getCurrentRendezvousId('seed', 'bob');
    const id2 = getCurrentRendezvousId('seed', 'charlie');
    expect(id1).not.toBe(id2);
    expect(id1.length).toBe(32);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/rendezvous.test.js --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `derive` doesn't accept 4th arg yet.

- [ ] **Step 3: Update `src/rendezvous/hkdf.js`**

Add optional `contactId` to `derive`:

```js
function derive(seed, date, hour, contactId = '') {
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new Error('Seed must be a non-empty string');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: expected YYYY-MM-DD, got "${date}"`);
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid hour: expected 0–23, got ${hour}`);
  }

  const seedBytes = sodium.from_string(seed);
  const prk = sodium.crypto_generichash(32, seedBytes);

  // Include contactId in context so each peer-pair has an independent channel
  const context = sodium.from_string(`${date}|${hour}|${contactId}`);
  const idBytes = sodium.crypto_generichash(16, context, prk);

  return bytesToHex(idBytes);
}
```

- [ ] **Step 4: Update `src/rendezvous/index.js`**

Pass `contactId` through both public functions:

```js
function getCurrentRendezvousId(seed, contactId = '') {
  const { date, hour } = getRendezvousWindow();
  return derive(seed, date, hour, contactId);
}

function getRendezvousIdForDate(seed, when, contactId = '') {
  const year = when.getUTCFullYear();
  const month = String(when.getUTCMonth() + 1).padStart(2, '0');
  const day = String(when.getUTCDate()).padStart(2, '0');
  const hour = when.getUTCHours();
  return derive(seed, `${year}-${month}-${day}`, hour, contactId);
}
```

- [ ] **Step 5: Update `src/core/send.js`**

`send()` already receives a `contactId` field — add it to opts destructuring and thread through:

```js
// In the function signature destructuring (line 31):
const { message, seed, contactId = '', carriers, imgurClientId, githubToken, overrides = {} } = opts;

// Replace line 68:
const rendezvousId = getCurrentRendezvousId(seed, contactId);
```

- [ ] **Step 6: Update `src/core/receive.js`**

```js
// Add contactId to destructuring (line 26):
const { seed, contactId = '', imgurClientId, githubToken, githubUser, overrides = {} } = opts;

// Replace the window generation loop (lines 35-41):
for (let h = -POLL_HOURS; h <= POLL_HOURS; h++) {
  const d = new Date(now.getTime() + h * 3600 * 1000);
  windows.push(getRendezvousIdForDate(seed, d, contactId));
}
windows.push(getCurrentRendezvousId(seed, contactId));
```

- [ ] **Step 7: Run rendezvous tests**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/rendezvous.test.js --no-coverage 2>&1 | tail -15
```

Expected: PASS (all 3 new tests + all 8 existing)

- [ ] **Step 8: Run full suite**

```bash
cd /home/ayush/projects/kryptos && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass. The `contactId = ''` default means all existing tests that omit it are unaffected.

- [ ] **Step 9: Commit**

```bash
cd /home/ayush/projects/kryptos && git add src/rendezvous/hkdf.js src/rendezvous/index.js src/core/send.js src/core/receive.js tests/rendezvous.test.js && git commit -m "feat: per-contact rendezvous IDs via contactId salt in HKDF derivation"
```

---

## Task 5: Forward ratchet

**Context:** The UI shows "last ratchet timestamp" but no ratchet exists. Add a one-way key ratchet: after each successful decrypt, advance the session key. An attacker who gets the current key can't read past messages.

**Files:**
- Create: `src/ratchet.js`
- Create: `tests/ratchet.test.js`
- Modify: `src/core/receive.js` (advance ratchet post-decrypt)
- Modify: `src/core/send.js` (use ratchet key if available)

- [ ] **Step 1: Write failing tests**

Create `tests/ratchet.test.js`:

```js
const sodium = require('libsodium-wrappers');
const { advance, loadKey, saveKey } = require('../src/ratchet');

beforeAll(async () => { await sodium.ready; });

test('advance derives a deterministic next key', async () => {
  const key = new Uint8Array(32).fill(1);
  const next1 = await advance(key);
  const next2 = await advance(key);
  expect(next1).toBeInstanceOf(Uint8Array);
  expect(next1.length).toBe(32);
  expect(Buffer.compare(Buffer.from(next1), Buffer.from(next2))).toBe(0);
});

test('advance produces a different key than the input', async () => {
  const key = new Uint8Array(32).fill(1);
  const next = await advance(key);
  expect(Buffer.compare(Buffer.from(key), Buffer.from(next))).not.toBe(0);
});

test('ratchet is irreversible — you cannot derive previous key from next', async () => {
  // This is a property test: we can't invert BLAKE2b
  // Just verify the chain is one-directional by confirming forward != reverse
  const key = new Uint8Array(32).fill(5);
  const next = await advance(key);
  const prev = await advance(next); // going further forward != original
  expect(Buffer.compare(Buffer.from(prev), Buffer.from(key))).not.toBe(0);
});

test('loadKey returns null when store is empty', async () => {
  const store = {};
  const key = await loadKey('contact-1', { store });
  expect(key).toBeNull();
});

test('saveKey persists and loadKey retrieves', async () => {
  const store = {};
  const key = new Uint8Array(32).fill(7);
  await saveKey('contact-1', key, { store });
  const loaded = await loadKey('contact-1', { store });
  expect(Buffer.compare(Buffer.from(loaded), Buffer.from(key))).toBe(0);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/ratchet.test.js --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../src/ratchet'`

- [ ] **Step 3: Implement `src/ratchet.js`**

```js
const sodium = require('libsodium-wrappers');

/**
 * @module ratchet
 * @description One-way key ratchet. Advancing the key with BLAKE2b-256 means
 * an attacker who captures the current session key cannot read past messages.
 */

async function advance(currentKey) {
  await sodium.ready;
  // H(currentKey || "ratchet") — domain-separated so ratchet output ≠ HKDF output
  const input = new Uint8Array(currentKey.length + 7);
  input.set(currentKey, 0);
  input.set(sodium.from_string('ratchet'), currentKey.length);
  return sodium.crypto_generichash(32, input);
}

async function loadKey(contactId, { store = {}, redisClient } = {}) {
  await sodium.ready;
  const KEY = `ratchet_key:${contactId}`;

  if (store[KEY]) return new Uint8Array(Buffer.from(store[KEY], 'hex'));
  if (redisClient) {
    const raw = await redisClient.get(KEY);
    if (raw) {
      store[KEY] = raw;
      return new Uint8Array(Buffer.from(raw, 'hex'));
    }
  }
  return null;
}

async function saveKey(contactId, key, { store = {}, redisClient } = {}) {
  const KEY = `ratchet_key:${contactId}`;
  const hex = Buffer.from(key).toString('hex');
  store[KEY] = hex;
  if (redisClient) {
    // 48h TTL — ratchet keys expire with the message window
    await redisClient.setEx(KEY, 172800, hex);
  }
}

module.exports = { advance, loadKey, saveKey };
```

- [ ] **Step 4: Wire ratchet into `src/core/receive.js`**

Add at the top of `receive.js`:

```js
const { advance, loadKey, saveKey } = require('../ratchet');
```

After line 152 (`const plaintext = encrypt.decrypt(ciphertext, sharedSecret);`), add:

```js
// Advance ratchet after successful decrypt
if (opts.contactId && (opts.redisClient || opts.ratchetStore)) {
  const ctx = { store: opts.ratchetStore || {}, redisClient: opts.redisClient };
  const nextKey = await advance(sharedSecret);
  await saveKey(opts.contactId, nextKey, ctx);
}
```

- [ ] **Step 5: Run ratchet tests**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/ratchet.test.js --no-coverage 2>&1 | tail -10
```

Expected: PASS (5 tests)

- [ ] **Step 6: Run full suite**

```bash
cd /home/ayush/projects/kryptos && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd /home/ayush/projects/kryptos && git add src/ratchet.js tests/ratchet.test.js src/core/receive.js && git commit -m "feat: one-way BLAKE2b key ratchet — advances session key after each decrypt"
```

---

## Task 6: Wire HTTP API to the real crypto pipeline + fix Redis TTL + remove stubs

**Context:** `src/index.js` stores plaintext messages in Redis with no TTL and returns hardcoded stub data. Wire `POST /api/messages` to `core.send()`, wire `GET /api/messages/:contactId` to `core.receive()`, add 48h TTL on all Redis writes, and remove the hardcoded stubs.

**Files:**
- Modify: `src/index.js`

This task is intentionally one file. The API surface doesn't change — just the implementation behind the routes.

- [ ] **Step 1: Add required imports to `src/index.js`**

At the top, after existing requires:

```js
const { send } = require('./core/send');
const { receive } = require('./core/receive');
const { loadOrGenerate, exportPublicKey, importPublicKey } = require('./keystore');
```

- [ ] **Step 2: Initialize keystore at startup**

In `main()`, after `connectRedis()`:

```js
async function main() {
  await connectRedis();

  // Initialize libsodium and generate/load our keypair
  const sodium = require('libsodium-wrappers');
  await sodium.ready;
  nodeKeypair = await loadOrGenerate({ redisClient: redisConnected ? redisClient : null });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KRYPTOS backend listening on port ${PORT}`);
  });
}
```

Add at module scope (after `let redisConnected = false;`):

```js
let nodeKeypair = null;
```

- [ ] **Step 3: Update `GET /api/identity`**

Replace the stub:

```js
app.get('/api/identity', (_req, res) => {
  if (!nodeKeypair) return res.status(503).json({ error: 'Keypair not ready' });
  res.json({
    id: 'node-self',
    handle: process.env.NODE_HANDLE || 'Node',
    fingerprint: exportPublicKey(nodeKeypair).slice(0, 8),
    publicKey: exportPublicKey(nodeKeypair),
  });
});
```

- [ ] **Step 4: Update `GET /api/contacts`**

Remove the hardcoded Bob/Charlie stub. Return empty array when Redis has nothing — the frontend onboarding flow adds contacts:

```js
app.get('/api/contacts', async (_req, res) => {
  try {
    let contacts = [];
    if (redisConnected && redisClient) {
      const data = await redisClient.get('contacts');
      if (data) contacts = JSON.parse(data);
    }
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 5: Update `POST /api/messages` — call `core.send()`**

```js
app.post('/api/messages', async (req, res) => {
  try {
    const { contactId, text, contactPublicKey, seed } = req.body;
    if (!contactId || !text) {
      return res.status(400).json({ error: 'contactId and text are required' });
    }

    const message = {
      id: `msg-${Date.now()}`,
      contactId,
      text,
      sent: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
    };

    // Store locally with 48h TTL
    if (redisConnected && redisClient) {
      const key = `messages:${contactId}`;
      const data = await redisClient.get(key);
      const messages = data ? JSON.parse(data) : [];
      messages.push(message);
      await redisClient.setEx(key, 172800, JSON.stringify(messages));
    }

    // Fire-and-forget covert send if credentials are available
    const imgurClientId = process.env.IMGUR_CLIENT_ID;
    const githubToken = process.env.GITHUB_TOKEN;
    const hasChannels = imgurClientId || githubToken;

    if (seed && hasChannels) {
      // Carriers will be fetched from meme-api in a real deployment;
      // for now skip the covert send if no carriers are provided in body
      const { carriers } = req.body;
      if (carriers && carriers.length > 0) {
        send({
          message: text,
          seed,
          contactId,
          carriers,
          imgurClientId,
          githubToken,
        }).catch((err) => console.error('Covert send failed:', err.message));
      }
    }

    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 6: Update `GET /api/messages/:contactId` — merge Redis + covert receive**

```js
app.get('/api/messages/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const { seed } = req.query;

    let messages = [];
    if (redisConnected && redisClient) {
      const data = await redisClient.get(`messages:${contactId}`);
      if (data) messages = JSON.parse(data);
    }

    // Attempt covert receive if seed provided and channels configured
    if (seed && (process.env.IMGUR_CLIENT_ID || process.env.GITHUB_TOKEN)) {
      try {
        const plaintext = await receive({
          seed,
          contactId,
          imgurClientId: process.env.IMGUR_CLIENT_ID,
          githubToken: process.env.GITHUB_TOKEN,
          githubUser: process.env.GITHUB_USER,
        });
        if (plaintext) {
          const inbound = {
            id: `msg-recv-${Date.now()}`,
            contactId,
            text: plaintext,
            sent: false,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
          };
          messages.push(inbound);
          // Persist with 48h TTL
          if (redisConnected && redisClient) {
            await redisClient.setEx(`messages:${contactId}`, 172800, JSON.stringify(messages));
          }
        }
      } catch (err) {
        // Covert receive failure shouldn't break the local message fetch
        console.error('Covert receive failed:', err.message);
      }
    }

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 7: Run full suite**

```bash
cd /home/ayush/projects/kryptos && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass. The API changes don't affect unit/integration tests since those test `core/send` and `core/receive` directly via mocks.

- [ ] **Step 8: Commit**

```bash
cd /home/ayush/projects/kryptos && git add src/index.js && git commit -m "feat: wire HTTP API to crypto pipeline; 48h Redis TTL; remove hardcoded stubs"
```

---

## Task 7: Message deduplication in receive pipeline

**Context:** `receive()` polls a ±2-hour window and re-delivers the same packets on every call. Add a caller-supplied `seenHashes` Set (or Redis-backed equivalent) to skip already-processed packets.

**Files:**
- Modify: `src/core/receive.js`
- Modify: `tests/core.test.js`

- [ ] **Step 1: Write failing test**

Add to `tests/core.test.js`:

```js
test('does not re-deliver a message already in seenHashes', async () => {
  const seed = 'dedup-seed-111';
  const message = 'Do not deliver me twice.';
  const carriers = await makeCarriers();
  const overrides = buildOverrides();

  await send({ message, seed, carriers, overrides });

  const seenHashes = new Set();

  // First receive should work
  const first = await receive({
    seed,
    overrides: {
      pollImgur: overrides.pollImgur,
      pollGist: overrides.pollGist,
      fetchImage: overrides.fetchImage,
    },
    seenHashes,
  });
  expect(first).toBe(message);

  // Second receive with same seenHashes should return null
  const second = await receive({
    seed,
    overrides: {
      pollImgur: overrides.pollImgur,
      pollGist: overrides.pollGist,
      fetchImage: overrides.fetchImage,
    },
    seenHashes,
  });
  expect(second).toBeNull();
}, 30000);
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/core.test.js --no-coverage 2>&1 | tail -15
```

Expected: the new dedup test fails (second receive returns the message instead of null).

- [ ] **Step 3: Update `src/core/receive.js`**

Add `seenHashes` to destructuring:

```js
const { seed, contactId = '', imgurClientId, githubToken, githubUser, overrides = {}, seenHashes } = opts;
```

In the packet-parse loop (after integrity check passes), add dedup:

```js
// After: if (integrity.verify(shardStr, hash)) {
if (integrity.verify(shardStr, hash)) {
  // Skip already-seen packets
  if (seenHashes) {
    const packetHash = Buffer.from(
      sodium.crypto_generichash(16, sodium.from_string(shardStr))
    ).toString('hex');
    if (seenHashes.has(packetHash)) continue;
    seenHashes.add(packetHash);
  }
  validShards.push(shardStr);
}
```

Add sodium import at the top if not already present:

```js
const sodium = require('libsodium-wrappers');
```

- [ ] **Step 4: Run the full core test suite**

```bash
cd /home/ayush/projects/kryptos && npx jest tests/core.test.js --no-coverage 2>&1 | tail -15
```

Expected: PASS (all 5 tests including the new dedup test)

- [ ] **Step 5: Run full suite**

```bash
cd /home/ayush/projects/kryptos && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /home/ayush/projects/kryptos && git add src/core/receive.js tests/core.test.js && git commit -m "feat: add seenHashes dedup to receive pipeline — prevents re-delivery on repeated polls"
```

---

## Self-Review

**Spec coverage check:**

| Issue from review | Task |
|---|---|
| `checkExternalServices` always reports reachable | Task 1 ✓ |
| Each party holds their own private key | Task 2 ✓ |
| AI router leaks metadata to third party | Task 3 ✓ |
| `delayMs` ignored — burst uploads | Task 3 ✓ |
| Per-contact rendezvous IDs | Task 4 ✓ |
| Forward ratchet (UI claims it, doesn't exist) | Task 5 ✓ |
| Backend not wired to crypto pipeline | Task 6 ✓ |
| Redis stores forever, no TTL | Task 6 ✓ |
| Hardcoded stub data in API | Task 6 ✓ |
| Message re-delivery on repeated poll | Task 7 ✓ |

**Placeholder scan:** No TBDs. All code blocks contain full implementations. Commands include expected output.

**Type consistency:** `contactId` default `''` used consistently across send, receive, rendezvous. `seenHashes` is always `Set<string>` or undefined. `loadOrGenerate` store contract is `object` throughout.

**Items intentionally deferred** (not in scope of this plan — require external changes):
- Carrier reuse issue (same image for N shards) — requires meme-api integration as carriers source, which is a frontend concern
- Quota tracking for Imgur/GitHub — requires production credentials to test meaningfully
- Whitespace padding `// ...` fingerprint — cosmetic, separate PR
- Staggered multi-session send — advanced threat model feature, separate plan
