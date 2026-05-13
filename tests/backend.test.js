const axios = require('axios');
jest.mock('axios');

beforeEach(() => {
  jest.clearAllMocks();
});

test('marks imgur unreachable on ECONNREFUSED', async () => {
  axios.head = jest.fn().mockImplementation((url) => {
    if (url.includes('imgur')) {
      const err = new Error('connect ECONNREFUSED');
      err.code = 'ECONNREFUSED';
      return Promise.reject(err);
    }
    return Promise.resolve({ status: 200 });
  });

  const mod = require('../src/healthcheck');
  const result = await mod.checkExternalServices({ forceRefresh: true });
  expect(result.imgur).toBe('unreachable');
  expect(result.gist).toBe('reachable');
});

test('marks both reachable when APIs return HTTP errors (4xx)', async () => {
  axios.head = jest.fn().mockImplementation(() => {
    const err = new Error('Request failed with status code 401');
    err.response = { status: 401 };
    return Promise.reject(err);
  });

  const mod = require('../src/healthcheck');
  const result = await mod.checkExternalServices({ forceRefresh: true });
  expect(result.imgur).toBe('reachable');
  expect(result.gist).toBe('reachable');
});

test('uses cache within TTL', async () => {
  axios.head = jest.fn().mockResolvedValue({ status: 200 });

  const mod = require('../src/healthcheck');
  await mod.checkExternalServices({ forceRefresh: true });
  await mod.checkExternalServices(); // should use cache
  expect(axios.head).toHaveBeenCalledTimes(2); // only 2 calls from first check
});

const request = require('supertest');

describe('POST /api/contacts', () => {
  let appModule;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('redis', () => ({
      createClient: () => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
      }),
    }));
    jest.mock('libsodium-wrappers', () => ({
      ready: Promise.resolve(),
      crypto_box_keypair: () => ({
        publicKey: new Uint8Array(32).fill(1),
        privateKey: new Uint8Array(32).fill(2),
      }),
      from_string: (s) => Buffer.from(s),
      crypto_generichash: () => new Uint8Array(32).fill(3),
      crypto_scalarmult_base: () => new Uint8Array(32).fill(4),
    }));
    appModule = require('../src/index');
  });

  test('creates contact and returns it with id and fingerprint', async () => {
    const res = await request(appModule.app)
      .post('/api/contacts')
      .send({
        name: 'Bob',
        publicKey: 'a'.repeat(64),
        seed: 'test-seed',
        githubUser: 'bobhandle',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Bob');
    expect(res.body.fingerprint).toBe('a'.repeat(8));
    expect(res.body.id).toMatch(/^contact-\d+$/);
    expect(res.body.publicKey).toBe('a'.repeat(64));
    expect(res.body.seed).toBe('test-seed');
  });

  test('returns 400 when name is missing', async () => {
    const res = await request(appModule.app)
      .post('/api/contacts')
      .send({ publicKey: 'a'.repeat(64) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  test('returns 400 when publicKey is not 64 hex chars', async () => {
    const res = await request(appModule.app)
      .post('/api/contacts')
      .send({ name: 'Bob', publicKey: 'tooshort' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/publicKey/i);
  });

  test('returns 409 when contact with same publicKey already exists', async () => {
    jest.resetModules();
    jest.mock('redis', () => ({
      createClient: () => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(JSON.stringify([
          { id: 'contact-1', name: 'Bob', publicKey: 'a'.repeat(64) }
        ])),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
      }),
    }));
    jest.mock('libsodium-wrappers', () => ({
      ready: Promise.resolve(),
      crypto_box_keypair: () => ({ publicKey: new Uint8Array(32).fill(1), privateKey: new Uint8Array(32).fill(2) }),
      from_string: (s) => Buffer.from(s),
      crypto_generichash: () => new Uint8Array(32).fill(3),
      crypto_scalarmult_base: () => new Uint8Array(32).fill(4),
    }));
    const mod = require('../src/index');
    const res = await request(mod.app)
      .post('/api/contacts')
      .send({ name: 'Bob2', publicKey: 'a'.repeat(64) });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/contacts/:contactId', () => {
  let appModule;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('redis', () => ({
      createClient: () => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(JSON.stringify([
          { id: 'contact-abc', name: 'Bob', publicKey: 'a'.repeat(64) },
        ])),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
      }),
    }));
    jest.mock('libsodium-wrappers', () => ({
      ready: Promise.resolve(),
      crypto_box_keypair: () => ({ publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) }),
      from_string: (s) => Buffer.from(s),
      crypto_generichash: () => new Uint8Array(32),
      crypto_scalarmult_base: () => new Uint8Array(32),
    }));
    appModule = require('../src/index');
  });

  test('removes contact and returns success', async () => {
    const res = await request(appModule.app).delete('/api/contacts/contact-abc');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for unknown contactId', async () => {
    const res = await request(appModule.app).delete('/api/contacts/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/stats/:contactId', () => {
  let appModule;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('libsodium-wrappers', () => ({
      ready: Promise.resolve(),
      crypto_box_keypair: () => ({ publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) }),
      from_string: (s) => Buffer.from(s),
      crypto_generichash: () => new Uint8Array(32),
      crypto_scalarmult_base: () => new Uint8Array(32),
    }));
  });

  test('returns zeroed defaults when no stats exist', async () => {
    jest.mock('redis', () => ({
      createClient: () => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
      }),
    }));
    appModule = require('../src/index');
    const res = await request(appModule.app).get('/api/stats/contact-1');
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(0);
    expect(res.body.received).toBe(0);
    expect(res.body.channelUsage).toEqual({ imgur: 0.5, gist: 0.5 });
    expect(res.body.lastRatchet).toBeNull();
  });

  test('returns correct values when stats exist in Redis', async () => {
    jest.mock('redis', () => ({
      createClient: () => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockImplementation((key) => {
          const vals = {
            'stats:sent:contact-1': '10',
            'stats:recv:contact-1': '7',
            'stats:imgur:contact-1': '6',
            'stats:gist:contact-1': '4',
            'stats:ratchet:contact-1': '1715000000000',
          };
          return Promise.resolve(vals[key] || null);
        }),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
      }),
    }));
    appModule = require('../src/index');
    const res = await request(appModule.app).get('/api/stats/contact-1');
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(10);
    expect(res.body.received).toBe(7);
    expect(res.body.channelUsage.imgur).toBeCloseTo(0.6);
    expect(res.body.channelUsage.gist).toBeCloseTo(0.4);
    expect(res.body.lastRatchet).toBe(1715000000000);
  });

  test('channelUsage defaults to 0.5/0.5 when both counters are zero', async () => {
    jest.mock('redis', () => ({
      createClient: () => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
      }),
    }));
    appModule = require('../src/index');
    const res = await request(appModule.app).get('/api/stats/contact-1');
    expect(res.body.channelUsage).toEqual({ imgur: 0.5, gist: 0.5 });
  });
});

describe('src/poller.js', () => {
  let poller;
  let mockRedis;
  let mockReceive;
  let mockGetContacts;

  beforeEach(() => {
    jest.resetModules();
    mockReceive = jest.fn().mockResolvedValue(null);
    jest.mock('../src/core/receive', () => ({ receive: mockReceive }));
    jest.mock('../src/rendezvous', () => ({
      getCurrentRendezvousId: jest.fn().mockReturnValue('aabbccdd'),
    }));

    mockGetContacts = jest.fn().mockResolvedValue([
      { id: 'contact-abc', seed: 'test-seed', githubUser: 'alice' },
    ]);
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      setEx: jest.fn().mockResolvedValue('OK'),
      incr: jest.fn().mockResolvedValue(1),
      rPush: jest.fn().mockResolvedValue(1),
      lTrim: jest.fn().mockResolvedValue('OK'),
      expire: jest.fn().mockResolvedValue(1),
    };

    poller = require('../src/poller');
    poller.init(mockRedis, mockGetContacts, new Map());
  });

  afterEach(() => {
    poller.shutdown();
  });

  test('register adds contact to active set', () => {
    poller.register('contact-abc');
    expect(poller.isActive('contact-abc')).toBe(true);
  });

  test('deregister removes contact from active set', () => {
    poller.register('contact-abc');
    poller.deregister('contact-abc');
    expect(poller.isActive('contact-abc')).toBe(false);
  });

  test('deregister is idempotent for unknown contactId', () => {
    expect(() => poller.deregister('never-registered')).not.toThrow();
  });

  test('pollContact calls receive() with correct args', async () => {
    poller.register('contact-abc');
    await poller.pollContact('contact-abc');
    expect(mockReceive).toHaveBeenCalledWith(expect.objectContaining({
      seed: 'test-seed',
      contactId: 'contact-abc',
    }));
  });

  test('pollContact skips contact with no seed', async () => {
    mockGetContacts.mockResolvedValueOnce([
      { id: 'contact-abc', seed: null },
    ]);
    poller.register('contact-abc');
    await poller.pollContact('contact-abc');
    expect(mockReceive).not.toHaveBeenCalled();
  });

  test('pollContact saves inbound message to Redis when plaintext received', async () => {
    mockReceive.mockResolvedValueOnce('hello world');
    poller.register('contact-abc');
    await poller.pollContact('contact-abc');
    expect(mockRedis.get).toHaveBeenCalledWith('messages:contact-abc');
    expect(mockRedis.get.mock.invocationCallOrder[0])
      .toBeLessThan(mockRedis.setEx.mock.invocationCallOrder[0]);
    expect(mockRedis.setEx).toHaveBeenCalledWith(
      'messages:contact-abc',
      172800,
      expect.any(String)
    );
    const saved = JSON.parse(mockRedis.setEx.mock.calls[0][2]);
    expect(Array.isArray(saved)).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0].text).toBe('hello world');
    expect(saved[0].sent).toBe(false);
  });

  test('inactivity timeout deregisters contact', async () => {
    jest.useFakeTimers();
    poller.register('contact-abc');
    poller._setLastActivity('contact-abc', Date.now() - 11 * 60 * 1000);
    await poller.runTick();
    expect(poller.isActive('contact-abc')).toBe(false);
    jest.useRealTimers();
  });

  test('tick skips contacts not yet due for polling', async () => {
    poller.register('contact-abc');
    poller._setLastPollAt('contact-abc', Date.now());
    await poller.runTick();
    expect(mockReceive).not.toHaveBeenCalled();
  });
});

describe('POST /api/poll/start', () => {
  let appModule;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../src/poller', () => ({
      init: jest.fn(),
      register: jest.fn(),
      deregister: jest.fn(),
      isActive: jest.fn().mockReturnValue(false),
      shutdown: jest.fn(),
    }));
    jest.mock('redis', () => ({
      createClient: () => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
        hGetAll: jest.fn().mockResolvedValue({}),
      }),
    }));
    jest.mock('libsodium-wrappers', () => ({
      ready: Promise.resolve(),
      crypto_box_keypair: () => ({ publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) }),
      from_string: (s) => Buffer.from(s),
      crypto_generichash: () => new Uint8Array(32),
      crypto_scalarmult_base: () => new Uint8Array(32),
    }));
    appModule = require('../src/index');
  });

  test('returns 200 and calls poller.register', async () => {
    const pollerMock = require('../src/poller');
    const res = await request(appModule.app)
      .post('/api/poll/start')
      .send({ contactId: 'contact-abc' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(pollerMock.register).toHaveBeenCalledWith('contact-abc');
  });

  test('returns 400 for invalid contactId', async () => {
    const res = await request(appModule.app)
      .post('/api/poll/start')
      .send({ contactId: '../bad' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/poll/stop', () => {
  let appModule;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../src/poller', () => ({
      init: jest.fn(),
      register: jest.fn(),
      deregister: jest.fn(),
      isActive: jest.fn().mockReturnValue(false),
      shutdown: jest.fn(),
    }));
    jest.mock('redis', () => ({
      createClient: () => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
        hGetAll: jest.fn().mockResolvedValue({}),
      }),
    }));
    jest.mock('libsodium-wrappers', () => ({
      ready: Promise.resolve(),
      crypto_box_keypair: () => ({ publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) }),
      from_string: (s) => Buffer.from(s),
      crypto_generichash: () => new Uint8Array(32),
      crypto_scalarmult_base: () => new Uint8Array(32),
    }));
    appModule = require('../src/index');
  });

  test('returns 200 and calls poller.deregister', async () => {
    const pollerMock = require('../src/poller');
    const res = await request(appModule.app)
      .post('/api/poll/stop')
      .send({ contactId: 'contact-abc' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(pollerMock.deregister).toHaveBeenCalledWith('contact-abc');
  });

  test('is idempotent — returns 200 for unknown contactId', async () => {
    const res = await request(appModule.app)
      .post('/api/poll/stop')
      .send({ contactId: 'never-registered' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/messages/:contactId (pure Redis read)', () => {
  let appModule;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../src/poller', () => ({
      init: jest.fn(),
      register: jest.fn(),
      deregister: jest.fn(),
      isActive: jest.fn(),
      shutdown: jest.fn(),
    }));
    jest.mock('redis', () => ({
      createClient: () => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(JSON.stringify([
          { id: 'msg-1', text: 'hello', sent: false, time: '10:00', timestamp: 1715000000000, meta: null },
        ])),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
        hGetAll: jest.fn().mockResolvedValue({}),
      }),
    }));
    jest.mock('libsodium-wrappers', () => ({
      ready: Promise.resolve(),
      crypto_box_keypair: () => ({ publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) }),
      from_string: (s) => Buffer.from(s),
      crypto_generichash: () => new Uint8Array(32),
      crypto_scalarmult_base: () => new Uint8Array(32),
    }));
    appModule = require('../src/index');
  });

  test('returns messages from Redis without calling receive()', async () => {
    const res = await request(appModule.app).get('/api/messages/contact-1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].text).toBe('hello');
  });

  test('seed query param is ignored — no receive() call', async () => {
    const res = await request(appModule.app).get('/api/messages/contact-1?seed=topsecret');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
