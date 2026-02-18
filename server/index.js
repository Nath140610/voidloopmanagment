const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const { applySecurityMiddleware } = require("../middleware/security");
const { notFoundHandler, errorHandler } = require("../middleware/errorHandler");
const authRoutes = require("../routes/auth");
const dashboardRoutes = require("../routes/dashboard");
const keysRoutes = require("../routes/keys");
const discordRoutes = require("../routes/discord");
const logsRoutes = require("../routes/logs");
const ticketsRoutes = require("../routes/tickets");
const usersRoutes = require("../routes/users");
const { initRealtime } = require("./realtime");
const { initDiscordClient } = require("./utils/discordService");
const { DATA_DIR } = require("./utils/csv");
const { startTempBanWatcher } = require("./jobs/tempBanExpiry");
const { normalizeMongoUri, maskMongoUri } = require("./utils/mongoUri");

dotenv.config();

async function bootstrap() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI manquant dans .env");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET manquant dans .env");
  }

  const app = express();
  const server = http.createServer(app);
  initRealtime(server);

  applySecurityMiddleware(app);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const mongoUri = normalizeMongoUri(process.env.MONGO_URI);
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000
    });
  } catch (error) {
    if (/bad auth|authentication failed/i.test(error.message || "")) {
      throw new Error(
        `MongoDB auth failed. Verifie MONGO_URI (user/mot de passe) et encode les caracteres speciaux. URI utilisee: ${maskMongoUri(mongoUri)}`
      );
    }
    throw error;
  }

  try {
    await initDiscordClient();
  } catch (error) {
    // Discord reste optionnel au boot, les routes renverront une erreur explicite.
    console.warn(`[Discord] ${error.message}`);
  }

  startTempBanWatcher();

  app.use("/api/auth", authRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/keys", keysRoutes);
  app.use("/api/discord", discordRoutes);
  app.use("/api/logs", logsRoutes);
  app.use("/api/tickets", ticketsRoutes);
  app.use("/api/users", usersRoutes);

  const clientPath = path.join(__dirname, "..", "client");
  app.use(express.static(clientPath));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return notFoundHandler(req, res);
    }
    return res.sendFile(path.join(clientPath, "index.html"));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  const port = Number(process.env.PORT || 5000);
  server.listen(port, () => {
    console.log(`VoidManagment panel running on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Boot error:", error.message);
  process.exit(1);
});
