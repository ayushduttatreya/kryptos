// Singleton axios mock — shared across module reloads (jest.resetModules)
// so tests can set axios.head once and healthcheck.js sees the same instance.
if (!global.__kryptos_axiosMock) {
  global.__kryptos_axiosMock = {
    head: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    create: jest.fn(),
    defaults: { headers: { common: {} } },
  };
}
module.exports = global.__kryptos_axiosMock;
