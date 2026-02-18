const mongoose = require("mongoose");

const ticketMessageSchema = new mongoose.Schema(
  {
    authorPseudo: { type: String, required: true },
    authorRole: { type: String, required: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "closed"],
      default: "open"
    },
    createdBy: {
      pseudo: { type: String, required: true },
      role: { type: String, required: true },
      keyId: { type: mongoose.Schema.Types.ObjectId, ref: "SessionKey", required: true }
    },
    assignedTo: { type: String },
    messages: { type: [ticketMessageSchema], default: [] }
  },
  { timestamps: true }
);

ticketSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("Ticket", ticketSchema);
