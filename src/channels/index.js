/**
 * @module channels
 * @description Unified dead-drop channel interface (L0).
 * Exposes Imgur image and GitHub Gist transports under one roof.
 */

const imgur = require('./imgur');
const gist = require('./gist');

module.exports = {
  imgur,
  gist,
};
