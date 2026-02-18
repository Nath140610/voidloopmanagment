const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+-=?";

function generateSessionKey(length = 22) {
  const bytes = crypto.randomBytes(length);
  let result = "";

  for (let i = 0; i < length; i += 1) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }

  return result;
}

async function hashSessionKey(rawKey) {
  return bcrypt.hash(rawKey, 12);
}

async function compareSessionKey(rawKey, hash) {
  return bcrypt.compare(rawKey, hash);
}

module.exports = {
  generateSessionKey,
  hashSessionKey,
  compareSessionKey
};
