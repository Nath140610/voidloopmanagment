function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

function normalizeMongoUri(input) {
  const uri = String(input || "").trim();
  if (!uri) {
    return uri;
  }

  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)(.+)$/i);
  if (!match) {
    return uri;
  }

  const protocol = match[1];
  const remainder = match[2];
  const slashIndex = remainder.indexOf("/");
  const authority = slashIndex === -1 ? remainder : remainder.slice(0, slashIndex);
  const tail = slashIndex === -1 ? "" : remainder.slice(slashIndex);

  const atIndex = authority.lastIndexOf("@");
  if (atIndex === -1) {
    return uri;
  }

  const credentials = authority.slice(0, atIndex);
  const host = authority.slice(atIndex + 1);
  const colonIndex = credentials.indexOf(":");
  if (colonIndex === -1) {
    return uri;
  }

  const username = credentials.slice(0, colonIndex);
  const password = credentials.slice(colonIndex + 1);
  const normalizedPassword = encodeURIComponent(safeDecode(password));

  return `${protocol}${username}:${normalizedPassword}@${host}${tail}`;
}

function maskMongoUri(uri) {
  return String(uri || "").replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/i, "$1***$3");
}

module.exports = {
  normalizeMongoUri,
  maskMongoUri
};
