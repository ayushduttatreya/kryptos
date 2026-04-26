require('dotenv').config();
const express = require('express');
const redis = require('redis');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Redis client
let redisClient = null;
let redisConnected = false;

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

// Cached external service health checks (60s TTL)
let extHealth = { imgur: 'unknown', gist: 'unknown', lastCheck: 0 };

async function checkExternalServices() {
  const now = Date.now();
  if (now - extHealth.lastCheck < 60000) return;

  let imgurStatus = 'unreachable';
  try {
    await axios.head('https://api.imgur.com/3/credits', { timeout: 5000 });
    imgurStatus = 'reachable';
  } catch (_e) {
    // Even a 401 means the service is up
    imgurStatus = 'reachable';
  }

  let gistStatus = 'unreachable';
  try {
    await axios.head('https://api.github.com', { timeout: 5000 });
    gistStatus = 'reachable';
  } catch (_e) {
    gistStatus = 'reachable';
  }

  extHealth = { imgur: imgurStatus, gist: gistStatus, lastCheck: now };
}

// Health endpoint — used by Docker healthcheck and frontend ChannelStatus
app.get('/health', async (_req, res) => {
  try {
    await checkExternalServices();
    const redisStatus = redisConnected ? 'connected' : 'disconnected';
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisStatus,
        imgur: extHealth.imgur,
        gist: extHealth.gist,
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

// Get identity (stub - will be derived from seed in production)
app.get('/api/identity', (_req, res) => {
  res.json({
    id: 'user-1',
    handle: 'Alice',
    fingerprint: 'a3f7c2b9',
    publicKey: 'stub-public-key',
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
    // Return stub data if no contacts in Redis
    if (contacts.length === 0) {
      contacts = [
        { id: 'contact-1', name: 'Bob', fingerprint: 'b9e4d2a1', lastSeen: Date.now() - 120000 },
        { id: 'contact-2', name: 'Charlie', fingerprint: 'c8f3a7e2', lastSeen: Date.now() - 3600000 },
      ];
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
    let messages = [];
    if (redisConnected && redisClient) {
      const data = await redisClient.get(`messages:${contactId}`);
      if (data) messages = JSON.parse(data);
    }
    // Return stub messages if none in Redis
    if (messages.length === 0) {
      messages = [
        { id: 'msg-1', contactId, text: 'The package has been successfully embedded. Keys are in the standard location.', sent: false, time: '14:35', timestamp: Date.now() - 300000 },
        { id: 'msg-2', contactId, text: "ok I'll check the drop", sent: true, time: '14:36', timestamp: Date.now() - 240000 },
      ];
    }
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a message
app.post('/api/messages', async (req, res) => {
  try {
    const { contactId, text, priority = false } = req.body;
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
      priority,
    };
    // Store in Redis if connected
    if (redisConnected && redisClient) {
      let messages = [];
      const data = await redisClient.get(`messages:${contactId}`);
      if (data) messages = JSON.parse(data);
      messages.push(message);
      await redisClient.set(`messages:${contactId}`, JSON.stringify(messages));
    }
    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get channel status
app.get('/api/channels/status', async (_req, res) => {
  try {
    await checkExternalServices();
    res.json({
      imgur: { status: extHealth.imgur, load: 0.3 },
      gist: { status: extHealth.gist, load: 0.2 },
      redis: { status: redisConnected ? 'connected' : 'disconnected' },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function main() {
  await connectRedis();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KRYPTOS backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
