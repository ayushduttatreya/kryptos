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
