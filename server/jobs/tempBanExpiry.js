const DiscordUserRecord = require("../../models/DiscordUserRecord");
const ActionLog = require("../../models/ActionLog");
const { unbanMember } = require("../utils/discordService");
const { pushRecentActivity } = require("../realtime");

async function processExpiredTempBans() {
  const records = await DiscordUserRecord.find({
    bans: {
      $elemMatch: {
        active: true,
        temporary: true,
        tempUntil: { $lte: new Date() }
      }
    }
  });

  for (const record of records) {
    const expiredBans = record.bans.filter(
      (ban) => ban.active && ban.temporary && ban.tempUntil && ban.tempUntil <= new Date()
    );
    if (!expiredBans.length) {
      continue;
    }

    try {
      await unbanMember(record.discordUserId, "Fin automatique du ban temporaire");
    } catch (_) {
      // Si Discord est indisponible, on retentera au prochain cycle.
      continue;
    }

    let changed = false;
    for (const ban of record.bans) {
      if (ban.active && ban.temporary && ban.tempUntil && ban.tempUntil <= new Date()) {
        ban.active = false;
        ban.removedAt = new Date();
        ban.removedBy = "system:auto";
        changed = true;
      }
    }

    if (!changed) {
      continue;
    }

    record.lastUpdated = new Date();
    await record.save();

    const action = await ActionLog.create({
      actorPseudo: "system",
      actorRole: "system",
      actionType: "DISCORD_TEMP_BAN_AUTO_EXPIRE",
      targetType: "discord_user",
      targetId: record.discordUserId,
      details: { username: record.username }
    });

    pushRecentActivity({
      _id: action._id,
      actorPseudo: action.actorPseudo,
      actorRole: action.actorRole,
      actionType: action.actionType,
      targetType: action.targetType,
      targetId: action.targetId,
      details: action.details,
      createdAt: action.createdAt
    });
  }
}

function startTempBanWatcher() {
  const intervalMs = 60 * 1000;
  setInterval(() => {
    processExpiredTempBans().catch((error) => {
      console.error("[TempBanWatcher]", error.message);
    });
  }, intervalMs).unref();
}

module.exports = {
  startTempBanWatcher
};
