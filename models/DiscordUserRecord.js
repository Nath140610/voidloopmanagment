const mongoose = require("mongoose");

const discordUserRecordSchema = new mongoose.Schema(
  {
    discordUserId: { type: String, required: true, unique: true },
    username: { type: String, default: "Unknown" },
    warns: [
      {
        reason: { type: String, required: true },
        staffPseudo: { type: String, required: true },
        at: { type: Date, default: Date.now }
      }
    ],
    notes: [
      {
        note: { type: String, required: true },
        staffPseudo: { type: String, required: true },
        at: { type: Date, default: Date.now }
      }
    ],
    mutes: [
      {
        reason: { type: String, required: true },
        durationMinutes: { type: Number, required: true },
        staffPseudo: { type: String, required: true },
        startAt: { type: Date, default: Date.now },
        endAt: { type: Date, required: true },
        active: { type: Boolean, default: true }
      }
    ],
    bans: [
      {
        reason: { type: String, required: true },
        temporary: { type: Boolean, default: false },
        tempUntil: { type: Date },
        staffPseudo: { type: String, required: true },
        at: { type: Date, default: Date.now },
        active: { type: Boolean, default: true },
        removedAt: { type: Date },
        removedBy: { type: String }
      }
    ],
    banRequests: [
      {
        reason: { type: String, required: true },
        requestedBy: { type: String, required: true },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending"
        },
        reviewedBy: { type: String },
        reviewedAt: { type: Date },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    lastUpdated: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

discordUserRecordSchema.index({ discordUserId: 1 });

module.exports = mongoose.model("DiscordUserRecord", discordUserRecordSchema);
