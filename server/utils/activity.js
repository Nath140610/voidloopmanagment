const ActionLog = require("../../models/ActionLog");
const { pushRecentActivity } = require("../realtime");

async function logActivity({
  req,
  actorPseudo,
  actorRole,
  actorKeyId,
  actionType,
  targetType,
  targetId,
  details
}) {
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

  const action = await ActionLog.create({
    actorPseudo,
    actorRole,
    actorKeyId,
    actionType,
    targetType,
    targetId,
    details,
    ipAddress
  });

  pushRecentActivity({
    _id: action._id,
    actorPseudo,
    actorRole,
    actionType,
    targetType,
    targetId,
    details,
    createdAt: action.createdAt
  });

  return action;
}

module.exports = {
  logActivity
};
