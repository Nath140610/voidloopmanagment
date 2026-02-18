const crypto = require("crypto");
const express = require("express");

const Ticket = require("../models/Ticket");
const { authMiddleware } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { logActivity } = require("../server/utils/activity");
const { pushRecentActivity } = require("../server/realtime");

const router = express.Router();
router.use(authMiddleware);

router.get("/", requirePermission("VIEW_TICKETS"), async (req, res, next) => {
  try {
    const tickets = await Ticket.find().sort({ updatedAt: -1 }).limit(100).lean();
    return res.json({ tickets });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requirePermission("VIEW_TICKETS"), async (req, res, next) => {
  try {
    const subject = String(req.body.subject || "").trim();
    const description = String(req.body.description || "").trim();
    if (!subject || !description) {
      return res.status(400).json({ error: "Sujet et description requis." });
    }

    const ticketId = `VM-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const ticket = await Ticket.create({
      ticketId,
      subject,
      description,
      createdBy: {
        pseudo: req.user.pseudo,
        role: req.user.role,
        keyId: req.user.keyId
      },
      messages: [
        {
          authorPseudo: req.user.pseudo,
          authorRole: req.user.role,
          content: description
        }
      ]
    });

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "TICKET_CREATED",
      targetType: "ticket",
      targetId: ticket.ticketId,
      details: { subject }
    });

    pushRecentActivity({
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actionType: "TICKET_CREATED",
      targetType: "ticket",
      targetId: ticket.ticketId,
      createdAt: ticket.createdAt
    });

    return res.status(201).json({ ticket });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/status", requirePermission("MANAGE_TICKETS"), async (req, res, next) => {
  try {
    const status = String(req.body.status || "");
    if (!["open", "in_progress", "closed"].includes(status)) {
      return res.status(400).json({ error: "Statut invalide." });
    }

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket introuvable." });
    }

    ticket.status = status;
    await ticket.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "TICKET_STATUS_UPDATED",
      targetType: "ticket",
      targetId: ticket.ticketId,
      details: { status }
    });

    return res.json({ success: true, ticket });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/messages", requirePermission("VIEW_TICKETS"), async (req, res, next) => {
  try {
    const content = String(req.body.content || "").trim();
    if (!content) {
      return res.status(400).json({ error: "Message requis." });
    }

    const ticket = await Ticket.findOne({ ticketId: req.params.id });
    if (!ticket) {
      return res.status(404).json({ error: "Ticket introuvable." });
    }

    ticket.messages.push({
      authorPseudo: req.user.pseudo,
      authorRole: req.user.role,
      content
    });
    await ticket.save();

    await logActivity({
      req,
      actorPseudo: req.user.pseudo,
      actorRole: req.user.role,
      actorKeyId: req.user.keyId,
      actionType: "TICKET_MESSAGE_ADDED",
      targetType: "ticket",
      targetId: ticket.ticketId
    });

    return res.json({ success: true, ticket });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
