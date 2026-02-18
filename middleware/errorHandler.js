function notFoundHandler(req, res) {
  return res.status(404).json({ error: "Route introuvable." });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  return res.status(status).json({
    error: err.message || "Erreur serveur."
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
