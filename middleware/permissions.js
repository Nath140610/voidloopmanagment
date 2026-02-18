const { ROLE_ORDER } = require("../server/constants/permissions");

function requireRole(minRole) {
  return (req, res, next) => {
    const currentRoleIndex = ROLE_ORDER.indexOf(req.user?.role);
    const minRoleIndex = ROLE_ORDER.indexOf(minRole);

    if (currentRoleIndex === -1 || minRoleIndex === -1 || currentRoleIndex < minRoleIndex) {
      return res.status(403).json({ error: "Rôle insuffisant." });
    }

    return next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    const currentPermissions = req.user?.permissions || [];
    if (currentPermissions.includes("*") || currentPermissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({ error: `Permission manquante: ${permission}` });
  };
}

const founderOnly = requireRole("Fondateur");

module.exports = {
  requireRole,
  requirePermission,
  founderOnly
};
