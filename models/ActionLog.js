const mongoose = require("mongoose");

const actionLogSchema = new mongoose.Schema(
  {
    actorPseudo: { type: String, required: true },
    actorRole: { type: String, required: true },
    actorKeyId: { type: mongoose.Schema.Types.ObjectId, ref: "SessionKey" },
    actionType: { type: String, required: true },
    targetType: { type: String, default: "system" },
    targetId: { type: String },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: "unknown" }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

actionLogSchema.index({ actionType: 1, createdAt: -1 });
actionLogSchema.index({ actorPseudo: 1, createdAt: -1 });

module.exports = mongoose.model("ActionLog", actionLogSchema);
