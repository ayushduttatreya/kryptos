/**
 * @module core
 * @description Core pipeline orchestration (L6).
 * Exports the end-to-end send and receive flows.
 */

const { send } = require('./send');
const { receive } = require('./receive');

module.exports = {
  send,
  receive,
};
