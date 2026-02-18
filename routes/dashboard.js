const express = require("express");

const { authMiddleware } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const ActionLog = require("../models/ActionLog");
const DiscordUserRecord = require("../models/DiscordUserRecord");
const Ticket = require("../models/Ticket");
const ConnectionLog = require("../models/ConnectionLog");
const { getOnlineStaffCount } = require("../server/realtime");

const router = express.Router();

router.use(authMiddleware);

router.get("/stats", requirePermission("VIEW_DASHBOARD"), async (req, res, next) => {
  try {
    const records = await DiscordUserRecord.find({}, { warns: 1, bans: 1 }).lean();

    const warnCount = records.reduce((sum, record) => sum + (record.warns?.length || 0), 0);
    const banCount = records.reduce(
      (sum, record) => sum + (record.bans?.filter((ban) => ban.active).length || 0),
      0
    );
    const openTickets = await Ticket.countDocuments({ status: { $ne: "closed" } });

    return res.json({
      warnCount,
      banCount,
      staffConnected: getOnlineStaffCount(),
      openTickets
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/recent-activity", requirePermission("VIEW_DASHBOARD"), async (req, res, next) => {
  try {
    const activity = await ActionLog.find().sort({ createdAt: -1 }).limit(50).lean();
    return res.json({ activity });
  } catch (error) {
    return next(error);
  }
});

router.get("/recent-connections", requirePermission("VIEW_CONNECTIONS"), async (req, res, next) => {
  try {
    const connections = await ConnectionLog.find().sort({ connectedAt: -1 }).limit(50).lean();
    return res.json({ connections });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
