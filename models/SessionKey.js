const mongoose = require("mongoose");
const { ROLE_ORDER } = require("../server/constants/permissions");

const sessionKeySchema = new mongoose.Schema(
  {
    pseudo: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLE_ORDER, required: true },
    permissions: { type: [String], default: [] },
    keyHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: String, default: "system" },
    lastUsedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

sessionKeySchema.index({ pseudo: 1 });
sessionKeySchema.index({ role: 1, isActive: 1 });

module.exports = mongoose.model("SessionKey", sessionKeySchema);
