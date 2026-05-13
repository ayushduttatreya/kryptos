require('dotenv').config();
const express = require('express');
const redis = require('redis');
const path = require('path');
const { checkExternalServices } = require('./healthcheck');
const { send } = require('./core/send');
const { receive } = require('./core/receive');
const { loadOrGenerate, exportPublicKey } = require('./keystore');
const { getCurrentRendezvousId } = require('./rendezvous');
const poller = require('./poller');
const contactSeenHashes = new Map();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Redis client
let redisClient = null;
let redisConnected = false;
let nodeKeypair = null;

function sanitizeId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return null;
  return id;
}

async function connectRedis() {
  try {
    redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', () => { redisConnected = false; });
    redisClient.on('connect', () => { redisConnected = true; });
    await redisClient.connect();
    redisConnected = true;
  } catch (_e) {
    redisConnected = false;
  }
}

// Health endpoint — used by Docker healthcheck and frontend ChannelStatus
app.get('/health', async (_req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// API routes placeholder — will be wired in later phases
app.get('/api/status', (_req, res) => {
  res.json({ backend: true, version: '1.0.0' });
});

// Get identity
app.get('/api/identity', (_req, res) => {
  if (!nodeKeypair) return res.status(503).json({ error: 'Keypair not ready' });
  res.json({
    id: 'node-self',
    handle: process.env.NODE_HANDLE || 'Node',
    fingerprint: exportPublicKey(nodeKeypair).slice(0, 8),
    publicKey: exportPublicKey(nodeKeypair),
  });
});

// Get contacts list
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

app.post('/api/contacts', async (req, res) => {
  try {
    const { name, publicKey, seed, githubUser } = req.body;
    if (!name || !publicKey) {
      return res.status(400).json({ error: 'name and publicKey are required' });
    }
    if (!/^[0-9a-fA-F]{64}$/.test(publicKey)) {
      return res.status(400).json({ error: 'publicKey must be a 64-char hex string' });
    }

    let contacts = [];
    if (redisConnected && redisClient) {
      const data = await redisClient.get('contacts');
      if (data) contacts = JSON.parse(data);
    }

    if (contacts.find(c => c.publicKey === publicKey)) {
      return res.status(409).json({ error: 'Contact with this publicKey already exists' });
    }

    const contact = {
      id: `contact-${Date.now()}`,
      name,
      publicKey,
      fingerprint: publicKey.slice(0, 8),
      seed: seed || null,
      githubUser: githubUser || null,
      lastSeen: Date.now(),
    };

    contacts.push(contact);
    if (redisConnected && redisClient) {
      await redisClient.setEx('contacts', 172800, JSON.stringify(contacts));
    }
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    let contacts = [];
    if (redisConnected && redisClient) {
      const data = await redisClient.get('contacts');
      if (data) contacts = JSON.parse(data);
    }
    const idx = contacts.findIndex(c => c.id === contactId);
    if (idx === -1) return res.status(404).json({ error: 'Contact not found' });
    contacts.splice(idx, 1);
    if (redisConnected && redisClient) {
      await redisClient.setEx('contacts', 172800, JSON.stringify(contacts));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const getInt = async (key) => {
      if (!redisConnected || !redisClient) return 0;
      const val = await redisClient.get(key);
      return val ? parseInt(val, 10) : 0;
    };

    const [sent, recv, imgur, gist, ratchetRaw] = await Promise.all([
      getInt(`stats:sent:${contactId}`),
      getInt(`stats:recv:${contactId}`),
      getInt(`stats:imgur:${contactId}`),
      getInt(`stats:gist:${contactId}`),
      redisConnected && redisClient ? redisClient.get(`stats:ratchet:${contactId}`) : Promise.resolve(null),
    ]);

    const total = imgur + gist;
    const channelUsage = total === 0
      ? { imgur: 0.5, gist: 0.5 }
      : { imgur: imgur / total, gist: gist / total };

    res.json({
      sent,
      received: recv,
      channelUsage,
      lastRatchet: ratchetRaw ? parseInt(ratchetRaw, 10) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages for a contact
app.get('/api/messages/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    let messages = [];
    if (redisConnected && redisClient) {
      const data = await redisClient.get(`messages:${contactId}`);
      if (data) messages = JSON.parse(data);
    }
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a message
app.post('/api/messages', async (req, res) => {
  try {
    const { contactId, text, seed, carriers } = req.body;
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
      meta: null,
    };

    if (redisConnected && redisClient) {
      const key = `messages:${contactId}`;
      const data = await redisClient.get(key);
      const messages = data ? JSON.parse(data) : [];
      messages.push(message);
      await redisClient.setEx(key, 172800, JSON.stringify(messages));
    }

    if (seed && carriers && carriers.length > 0 &&
        (process.env.IMGUR_CLIENT_ID || process.env.GITHUB_TOKEN)) {
      send({
        message: text,
        seed,
        contactId,
        carriers,
        imgurClientId: process.env.IMGUR_CLIENT_ID,
        githubToken: process.env.GITHUB_TOKEN,
      }).then(async (receipts) => {
        if (!redisConnected || !redisClient) return;
        await redisClient.incr(`stats:sent:${contactId}`);
        for (const r of receipts) {
          if (r.channel === 'imgur') await redisClient.incr(`stats:imgur:${contactId}`);
          else if (r.channel === 'gist') await redisClient.incr(`stats:gist:${contactId}`);
        }
      }).catch((err) => console.error('Covert send failed:', err.message));
    }

    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get channel status
app.get('/api/channels/status', async (_req, res) => {
  try {
    const health = await checkExternalServices();
    res.json({
      imgur: { status: health.imgur, load: 0.3 },
      gist: { status: health.gist, load: 0.2 },
      redis: { status: redisConnected ? 'connected' : 'disconnected' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/poll/start', (req, res) => {
  const contactId = sanitizeId(req.body.contactId);
  if (!contactId) return res.status(400).json({ error: 'Invalid contactId' });
  poller.register(contactId);
  res.json({ success: true });
});

app.post('/api/poll/stop', (req, res) => {
  const contactId = sanitizeId(req.body.contactId);
  if (!contactId) return res.status(400).json({ error: 'Invalid contactId' });
  poller.deregister(contactId);
  res.json({ success: true });
});

async function main() {
  const sodium = require('libsodium-wrappers');
  await sodium.ready;
  nodeKeypair = await loadOrGenerate({ redisClient: redisConnected ? redisClient : null });

  const getContactsFn = async () => {
    if (!redisConnected || !redisClient) return [];
    const data = await redisClient.get('contacts');
    return data ? JSON.parse(data) : [];
  };
  poller.init(redisClient, getContactsFn, contactSeenHashes);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KRYPTOS backend listening on port ${PORT}`);
  });
}

// Connect to Redis eagerly so routes work without calling main()
connectRedis();

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = { app };
