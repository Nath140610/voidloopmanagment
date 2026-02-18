const jwt = require("jsonwebtoken");
const SessionKey = require("../models/SessionKey");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Authentification requise." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const key = await SessionKey.findById(decoded.keyId);

    if (!key || !key.isActive) {
      return res.status(401).json({ error: "Clé invalide ou désactivée." });
    }

    req.user = {
      keyId: key._id.toString(),
      pseudo: key.pseudo,
      role: key.role,
      permissions: key.permissions
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Session invalide." });
  }
}

module.exports = {
  authMiddleware
};
