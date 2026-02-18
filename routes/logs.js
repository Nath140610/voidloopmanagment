const express = require("express");

const ActionLog = require("../models/ActionLog");
const ConnectionLog = require("../models/ConnectionLog");
const { authMiddleware } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { rowsToCsv } = require("../server/utils/csv");

const router = express.Router();
router.use(authMiddleware);

router.get("/actions", requirePermission("VIEW_LOGS"), async (req, res, next) => {
  try {
    const logs = await ActionLog.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ logs });
  } catch (error) {
    return next(error);
  }
});

router.get("/connections", requirePermission("VIEW_CONNECTIONS"), async (req, res, next) => {
  try {
    const logs = await ConnectionLog.find().sort({ connectedAt: -1 }).limit(200).lean();
    return res.json({ logs });
  } catch (error) {
    return next(error);
  }
});

router.get("/actions/export.csv", requirePermission("VIEW_LOGS"), async (req, res, next) => {
  try {
    const logs = await ActionLog.find().sort({ createdAt: -1 }).lean();
    const headers = [
      "actorPseudo",
      "actorRole",
      "actionType",
      "targetType",
      "targetId",
      "ipAddress",
      "createdAt"
    ];
    const rows = logs.map((item) => ({
      actorPseudo: item.actorPseudo,
      actorRole: item.actorRole,
      actionType: item.actionType,
      targetType: item.targetType,
      targetId: item.targetId || "",
      ipAddress: item.ipAddress,
      createdAt: item.createdAt.toISOString()
    }));

    const csv = rowsToCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=action_logs.csv");
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
});

router.get("/connections/export.csv", requirePermission("VIEW_CONNECTIONS"), async (req, res, next) => {
  try {
    const logs = await ConnectionLog.find().sort({ connectedAt: -1 }).lean();
    const headers = ["pseudo", "role", "ipAddress", "userAgent", "connectedAt"];
    const rows = logs.map((item) => ({
      pseudo: item.pseudo,
      role: item.role,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      connectedAt: item.connectedAt.toISOString()
    }));
    const csv = rowsToCsv(headers, rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=connection_logs.csv");
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
