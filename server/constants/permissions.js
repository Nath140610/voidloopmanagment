const ALL_PERMISSIONS = [
  "VIEW_DASHBOARD",
  "VIEW_MEMBERS",
  "VIEW_LOGS",
  "VIEW_CONNECTIONS",
  "WARN_MEMBER",
  "ADD_NOTE",
  "TEMP_MUTE",
  "REQUEST_BAN",
  "TEMP_BAN",
  "PERM_BAN",
  "REMOVE_BAN",
  "KICK_MEMBER",
  "MANAGE_KEYS"
];

const ROLE_ORDER = ["Modérateur", "Admin", "SuperAdmin", "Fondateur"];

const ROLE_DEFAULT_PERMISSIONS = {
  "Modérateur": [
    "VIEW_DASHBOARD",
    "VIEW_MEMBERS",
    "WARN_MEMBER",
    "ADD_NOTE",
    "TEMP_MUTE",
    "REQUEST_BAN",
    "KICK_MEMBER"
  ],
  Admin: [
    "VIEW_DASHBOARD",
    "VIEW_MEMBERS",
    "VIEW_LOGS",
    "WARN_MEMBER",
    "ADD_NOTE",
    "TEMP_MUTE",
    "REQUEST_BAN",
    "KICK_MEMBER"
  ],
  SuperAdmin: [
    "VIEW_DASHBOARD",
    "VIEW_MEMBERS",
    "VIEW_LOGS",
    "VIEW_CONNECTIONS",
    "WARN_MEMBER",
    "ADD_NOTE",
    "TEMP_MUTE",
    "REQUEST_BAN",
    "TEMP_BAN",
    "PERM_BAN",
    "REMOVE_BAN",
    "KICK_MEMBER"
  ],
  Fondateur: ["*"]
};

function sanitizePermissions(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return [...new Set(input.filter((item) => ALL_PERMISSIONS.includes(item)))];
}

function resolvePermissions(role, customPermissions) {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
  if (defaults.includes("*")) {
    return ["*"];
  }

  const sanitizedCustom = sanitizePermissions(customPermissions);
  return [...new Set([...defaults, ...sanitizedCustom])];
}

module.exports = {
  ALL_PERMISSIONS,
  ROLE_ORDER,
  ROLE_DEFAULT_PERMISSIONS,
  sanitizePermissions,
  resolvePermissions
};
