/**
 * @module stego
 * @description Unified steganographic interface (L2).
 * Provides LSB image embedding and whitespace text embedding under one roof.
 */

const lsb = require('./lsb');
const whitespace = require('./whitespace');

module.exports = {
  lsb,
  whitespace,
};
