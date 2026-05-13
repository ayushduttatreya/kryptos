require('dotenv').config();
const express = require('express');
const redis = require('redis');
const path = require('path');
const { checkExternalServices } = require('./healthcheck');
const { send } = require('./core/send');
const { receive } = require('./core/receive');
const { loadOrGenerate, exportPublicKey } = require('./keystore');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Redis client
let redisClient = null;
let redisConnected = false;
let nodeKeypair = null;

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

// Get messages for a contact
app.get('/api/messages/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const { seed } = req.query;

    let messages = [];
    if (redisConnected && redisClient) {
      const data = await redisClient.get(`messages:${contactId}`);
      if (data) messages = JSON.parse(data);
    }

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
          if (redisConnected && redisClient) {
            await redisClient.setEx(`messages:${contactId}`, 172800, JSON.stringify(messages));
          }
        }
      } catch (err) {
        console.error('Covert receive failed:', err.message);
      }
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

async function main() {
  await connectRedis();

  const sodium = require('libsodium-wrappers');
  await sodium.ready;
  nodeKeypair = await loadOrGenerate({ redisClient: redisConnected ? redisClient : null });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KRYPTOS backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
