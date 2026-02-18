const express = require("express");

const ActionLog = require("../models/ActionLog");
const { authMiddleware } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();
router.use(authMiddleware);

function resolveStaffLevel(actionCount) {
  if (actionCount >= 500) return { level: 5, label: "Lead Guardian" };
  if (actionCount >= 250) return { level: 4, label: "Elite Sentinel" };
  if (actionCount >= 100) return { level: 3, label: "Senior Staff" };
  if (actionCount >= 40) return { level: 2, label: "Staff Confirmé" };
  return { level: 1, label: "Nouveau Staff" };
}

router.get("/me/profile", requirePermission("VIEW_DASHBOARD"), async (req, res, next) => {
  try {
    const actionCount = await ActionLog.countDocuments({ actorPseudo: req.user.pseudo });
    const { level, label } = resolveStaffLevel(actionCount);

    return res.json({
      pseudo: req.user.pseudo,
      role: req.user.role,
      permissions: req.user.permissions,
      stats: {
        actions: actionCount,
        level,
        levelLabel: label
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
