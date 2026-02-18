const express = require("express");
const jwt = require("jsonwebtoken");

const SessionKey = require("../models/SessionKey");
const ConnectionLog = require("../models/ConnectionLog");
const { authMiddleware } = require("../middleware/auth");
const { authLimiter } = require("../middleware/security");
const { compareSessionKey, hashSessionKey, generateSessionKey } = require("../server/utils/sessionKeys");
const { appendConnectionWorkbook } = require("../server/utils/csv");
const { logActivity } = require("../server/utils/activity");
const { notifyFounders } = require("../server/realtime");
const { resolvePermissions } = require("../server/constants/permissions");

const router = express.Router();

function getRequestIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { sessionKey } = req.body;
    if (!sessionKey || typeof sessionKey !== "string") {
      return res.status(400).json({ error: "Clé de session invalide." });
    }

    const activeKeys = await SessionKey.find({ isActive: true });
    let matchedKey = null;

    for (const key of activeKeys) {
      const isMatch = await compareSessionKey(sessionKey, key.keyHash);
      if (isMatch) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      return res.status(401).json({ error: "Clé refusée." });
    }

    matchedKey.lastUsedAt = new Date();
    await matchedKey.save();

    const token = jwt.sign(
      {
        keyId: matchedKey._id.toString(),
        pseudo: matchedKey.pseudo,
        role: matchedKey.role,
        permissions: matchedKey.permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    const ipAddress = getRequestIp(req);
    const userAgent = req.headers["user-agent"] || "unknown";
    const connectedAt = new Date();

    await ConnectionLog.create({
      sessionKeyId: matchedKey._id,
      pseudo: matchedKey.pseudo,
      role: matchedKey.role,
      ipAddress,
      userAgent,
      connectedAt
    });

    appendConnectionWorkbook({
      pseudo: matchedKey.pseudo,
      ipAddress,
      connectedAt
    });

    await logActivity({
      req,
      actorPseudo: matchedKey.pseudo,
      actorRole: matchedKey.role,
      actorKeyId: matchedKey._id,
      actionType: "AUTH_LOGIN",
      targetType: "session",
      targetId: matchedKey._id.toString(),
      details: { message: `${matchedKey.pseudo} s'est connecté` }
    });

    notifyFounders("founder:staff-login", {
      pseudo: matchedKey.pseudo,
      role: matchedKey.role,
      ipAddress,
      connectedAt
    });

    return res.json({
      token,
      user: {
        pseudo: matchedKey.pseudo,
        role: matchedKey.role,
        permissions: matchedKey.permissions
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", authMiddleware, async (req, res, next) => {
  try {
    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "AUTH_LOGOUT",
      targetType: "session",
      targetId: req.user.keyId
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

router.post("/bootstrap-founder", async (req, res, next) => {
  try {
    const count = await SessionKey.countDocuments();
    if (count > 0) {
      return res.status(400).json({ error: "Bootstrap impossible, des clés existent déjà." });
    }

    const pseudo = process.env.FOUNDER_BOOTSTRAP_PSEUDO || "VoidFounder";
    const rawKey = process.env.FOUNDER_BOOTSTRAP_KEY || generateSessionKey(28);
    const hash = await hashSessionKey(rawKey);
    const permissions = resolvePermissions("Fondateur", []);

    await SessionKey.create({
      pseudo,
      role: "Fondateur",
      permissions,
      keyHash: hash,
      createdBy: "bootstrap"
    });

    return res.json({
      message: "Clé fondateur créée.",
      pseudo,
      sessionKey: rawKey
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
