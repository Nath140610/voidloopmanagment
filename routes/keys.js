const express = require("express");

const SessionKey = require("../models/SessionKey");
const { authMiddleware } = require("../middleware/auth");
const { founderOnly } = require("../middleware/permissions");
const { resolvePermissions, ROLE_ORDER } = require("../server/constants/permissions");
const { generateSessionKey, hashSessionKey } = require("../server/utils/sessionKeys");
const { logActivity } = require("../server/utils/activity");

const router = express.Router();

router.use(authMiddleware, founderOnly);

router.get("/", async (req, res, next) => {
  try {
    const keys = await SessionKey.find().sort({ createdAt: -1 }).lean();
    return res.json({
      keys: keys.map((item) => ({
        id: item._id,
        pseudo: item.pseudo,
        role: item.role,
        permissions: item.permissions,
        isActive: item.isActive,
        createdBy: item.createdBy,
        lastUsedAt: item.lastUsedAt,
        createdAt: item.createdAt
      }))
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { pseudo, role, permissions, customKey } = req.body;
    if (!pseudo || typeof pseudo !== "string") {
      return res.status(400).json({ error: "Pseudo requis." });
    }

    if (!role || !ROLE_ORDER.includes(role)) {
      return res.status(400).json({ error: "Rôle invalide." });
    }

    const rawKey = typeof customKey === "string" && customKey.length >= 12 ? customKey : generateSessionKey();
    const keyHash = await hashSessionKey(rawKey);
    const resolvedPermissions = resolvePermissions(role, permissions);

    const created = await SessionKey.create({
      pseudo: pseudo.trim(),
      role,
      permissions: resolvedPermissions,
      keyHash,
      createdBy: req.user.pseudo
    });

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "KEY_CREATED",
      targetType: "session_key",
      targetId: created._id.toString(),
      details: { pseudo, role, permissions: resolvedPermissions }
    });

    return res.status(201).json({
      message: "Clé créée.",
      sessionKey: rawKey,
      key: {
        id: created._id,
        pseudo: created.pseudo,
        role: created.role,
        permissions: created.permissions
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/active", async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const key = await SessionKey.findById(req.params.id);
    if (!key) {
      return res.status(404).json({ error: "Clé introuvable." });
    }

    key.isActive = Boolean(isActive);
    await key.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: key.isActive ? "KEY_ENABLED" : "KEY_DISABLED",
      targetType: "session_key",
      targetId: key._id.toString(),
      details: { pseudo: key.pseudo, role: key.role }
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/permissions", async (req, res, next) => {
  try {
    const { permissions } = req.body;
    const key = await SessionKey.findById(req.params.id);
    if (!key) {
      return res.status(404).json({ error: "Clé introuvable." });
    }

    key.permissions = resolvePermissions(key.role, permissions);
    await key.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "KEY_PERMISSIONS_UPDATED",
      targetType: "session_key",
      targetId: key._id.toString(),
      details: { permissions: key.permissions }
    });

    return res.json({ success: true, permissions: key.permissions });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
