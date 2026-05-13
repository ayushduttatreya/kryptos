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
