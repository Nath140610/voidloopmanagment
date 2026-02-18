const mongoose = require("mongoose");

const connectionLogSchema = new mongoose.Schema(
  {
    sessionKeyId: { type: mongoose.Schema.Types.ObjectId, ref: "SessionKey", required: true },
    pseudo: { type: String, required: true },
    role: { type: String, required: true },
    ipAddress: { type: String, default: "unknown" },
    userAgent: { type: String, default: "unknown" },
    connectedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: false
  }
);

connectionLogSchema.index({ connectedAt: -1 });
connectionLogSchema.index({ pseudo: 1, connectedAt: -1 });

module.exports = mongoose.model("ConnectionLog", connectionLogSchema);
