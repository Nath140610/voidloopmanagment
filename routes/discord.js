const express = require("express");

const { authMiddleware } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const DiscordUserRecord = require("../models/DiscordUserRecord");
const {
  searchGuildMembers,
  getGuildMemberProfile,
  timeoutMember,
  kickMember,
  banMember,
  unbanMember,
  buildDiscordOAuthUrl,
  getBotInviteLink
} = require("../server/utils/discordService");
const { logActivity } = require("../server/utils/activity");
const { notifyFounders } = require("../server/realtime");

const router = express.Router();

router.use(authMiddleware);

async function upsertRecord(discordUserId, username = "Unknown") {
  let record = await DiscordUserRecord.findOne({ discordUserId });
  if (!record) {
    record = await DiscordUserRecord.create({ discordUserId, username });
  } else if (username && record.username !== username) {
    record.username = username;
    record.lastUpdated = new Date();
    await record.save();
  }

  return record;
}

router.get("/oauth/login-url", (req, res) => {
  return res.json({
    oauthUrl: buildDiscordOAuthUrl(),
    botInvite: getBotInviteLink()
  });
});

router.get("/oauth/callback", (req, res) => {
  const code = req.query.code ? String(req.query.code) : null;
  if (!code) {
    return res.status(400).json({ error: "Code OAuth2 manquant." });
  }

  return res.json({
    message: "Callback OAuth2 recu.",
    code
  });
});

router.get("/members", requirePermission("VIEW_MEMBERS"), async (req, res, next) => {
  try {
    const query = req.query.q ? String(req.query.q).trim() : "";
    const members = await searchGuildMembers(query);
    return res.json({ members });
  } catch (error) {
    return next(error);
  }
});

router.get("/member/:id", requirePermission("VIEW_MEMBERS"), async (req, res, next) => {
  try {
    const profile = await getGuildMemberProfile(req.params.id);
    const record = await upsertRecord(req.params.id, profile.pseudo);
    return res.json({ profile, record });
  } catch (error) {
    return next(error);
  }
});

router.get("/member/:id/history", requirePermission("VIEW_MEMBERS"), async (req, res, next) => {
  try {
    const record = await upsertRecord(req.params.id);
    return res.json({ record });
  } catch (error) {
    return next(error);
  }
});

router.post("/member/:id/warn", requirePermission("WARN_MEMBER"), async (req, res, next) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ error: "Raison du warn requise." });
    }

    const profile = await getGuildMemberProfile(req.params.id);
    const record = await upsertRecord(req.params.id, profile.pseudo);
    record.warns.push({
      reason,
      staffPseudo: req.user.pseudo
    });
    record.lastUpdated = new Date();
    await record.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "DISCORD_WARN",
      targetType: "discord_user",
      targetId: req.params.id,
      details: { reason, username: profile.pseudo, warnCount: record.warns.length }
    });

    return res.json({ success: true, warnCount: record.warns.length });
  } catch (error) {
    return next(error);
  }
});

router.post("/member/:id/note", requirePermission("ADD_NOTE"), async (req, res, next) => {
  try {
    const note = String(req.body.note || "").trim();
    if (!note) {
      return res.status(400).json({ error: "Note requise." });
    }

    const profile = await getGuildMemberProfile(req.params.id);
    const record = await upsertRecord(req.params.id, profile.pseudo);
    record.notes.push({
      note,
      staffPseudo: req.user.pseudo
    });
    record.lastUpdated = new Date();
    await record.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "DISCORD_NOTE",
      targetType: "discord_user",
      targetId: req.params.id,
      details: { note, username: profile.pseudo }
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/member/:id/mute-temp", requirePermission("TEMP_MUTE"), async (req, res, next) => {
  try {
    const durationMinutes = Number(req.body.durationMinutes || 0);
    const reason = String(req.body.reason || "").trim();

    if (!durationMinutes || durationMinutes < 1 || !reason) {
      return res.status(400).json({ error: "Durée et raison requises." });
    }

    const profile = await timeoutMember(req.params.id, durationMinutes, reason);
    const record = await upsertRecord(req.params.id, profile.pseudo);

    const endAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    record.mutes.push({
      reason,
      durationMinutes,
      staffPseudo: req.user.pseudo,
      endAt
    });
    record.lastUpdated = new Date();
    await record.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "DISCORD_TEMP_MUTE",
      targetType: "discord_user",
      targetId: req.params.id,
      details: { reason, durationMinutes, username: profile.pseudo }
    });

    return res.json({ success: true, until: endAt });
  } catch (error) {
    return next(error);
  }
});

router.post("/member/:id/kick", requirePermission("KICK_MEMBER"), async (req, res, next) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ error: "Raison requise." });
    }

    const profile = await getGuildMemberProfile(req.params.id);
    await kickMember(req.params.id, reason);

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "DISCORD_KICK",
      targetType: "discord_user",
      targetId: req.params.id,
      details: { reason, username: profile.pseudo }
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/member/:id/ban-request", requirePermission("REQUEST_BAN"), async (req, res, next) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ error: "Raison requise." });
    }

    const profile = await getGuildMemberProfile(req.params.id);
    const record = await upsertRecord(req.params.id, profile.pseudo);
    const request = {
      reason,
      requestedBy: req.user.pseudo
    };

    record.banRequests.push(request);
    record.lastUpdated = new Date();
    await record.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "DISCORD_BAN_REQUEST",
      targetType: "discord_user",
      targetId: req.params.id,
      details: { reason, username: profile.pseudo }
    });

    notifyFounders("founder:ban-request", {
      discordUserId: req.params.id,
      username: profile.pseudo,
      reason,
      requestedBy: req.user.pseudo,
      requestedAt: new Date().toISOString()
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/member/:id/ban-temp", requirePermission("TEMP_BAN"), async (req, res, next) => {
  try {
    const reason = String(req.body.reason || "").trim();
    const durationHours = Number(req.body.durationHours || 0);

    if (!reason || !durationHours || durationHours < 1) {
      return res.status(400).json({ error: "Raison et durée (heures) requises." });
    }

    const profile = await getGuildMemberProfile(req.params.id);
    await banMember(req.params.id, reason, 0);
    const record = await upsertRecord(req.params.id, profile.pseudo);
    const tempUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    record.bans.push({
      reason,
      temporary: true,
      tempUntil,
      staffPseudo: req.user.pseudo
    });
    record.lastUpdated = new Date();
    await record.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "DISCORD_TEMP_BAN",
      targetType: "discord_user",
      targetId: req.params.id,
      details: { reason, durationHours, username: profile.pseudo }
    });

    notifyFounders("founder:ban-notification", {
      discordUserId: req.params.id,
      username: profile.pseudo,
      reason,
      temporary: true,
      durationHours,
      by: req.user.pseudo
    });

    return res.json({ success: true, tempUntil });
  } catch (error) {
    return next(error);
  }
});

router.post("/member/:id/ban", requirePermission("PERM_BAN"), async (req, res, next) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ error: "Raison requise." });
    }

    const profile = await getGuildMemberProfile(req.params.id);
    await banMember(req.params.id, reason, 0);
    const record = await upsertRecord(req.params.id, profile.pseudo);
    record.bans.push({
      reason,
      temporary: false,
      staffPseudo: req.user.pseudo
    });
    record.lastUpdated = new Date();
    await record.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "DISCORD_PERM_BAN",
      targetType: "discord_user",
      targetId: req.params.id,
      details: { reason, username: profile.pseudo }
    });

    notifyFounders("founder:ban-notification", {
      discordUserId: req.params.id,
      username: profile.pseudo,
      reason,
      temporary: false,
      by: req.user.pseudo
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.delete("/member/:id/ban", requirePermission("REMOVE_BAN"), async (req, res, next) => {
  try {
    const reason = String(req.body.reason || "Ban retiré par le staff");
    await unbanMember(req.params.id, reason);

    const record = await upsertRecord(req.params.id);
    const activeBan = [...record.bans].reverse().find((ban) => ban.active);
    if (activeBan) {
      activeBan.active = false;
      activeBan.removedAt = new Date();
      activeBan.removedBy = req.user.pseudo;
    }
    record.lastUpdated = new Date();
    await record.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "DISCORD_UNBAN",
      targetType: "discord_user",
      targetId: req.params.id,
      details: { reason }
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
