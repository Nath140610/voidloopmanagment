const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

let ioInstance = null;
const activeStaffBySocket = new Map();

function initRealtime(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
      credentials: true
    }
  });

  ioInstance.use((socket, next) => {
    const authToken = socket.handshake.auth?.token;
    if (!authToken) {
      return next();
    }

    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized socket"));
    }
  });

  ioInstance.on("connection", (socket) => {
    if (socket.user?.role === "Fondateur") {
      socket.join("founders");
    }

    if (socket.user?.keyId) {
      activeStaffBySocket.set(socket.id, socket.user.keyId);
      ioInstance.emit("staff:online", { online: getOnlineStaffCount() });
    }

    socket.on("disconnect", () => {
      activeStaffBySocket.delete(socket.id);
      ioInstance.emit("staff:online", { online: getOnlineStaffCount() });
    });
  });

  return ioInstance;
}

function getIo() {
  return ioInstance;
}

function getOnlineStaffCount() {
  return new Set(activeStaffBySocket.values()).size;
}

function pushRecentActivity(payload) {
  if (!ioInstance) {
    return;
  }

  ioInstance.emit("activity:new", payload);
}

function notifyFounders(eventName, payload) {
  if (!ioInstance) {
    return;
  }

  ioInstance.to("founders").emit(eventName, payload);
}

module.exports = {
  initRealtime,
  getIo,
  getOnlineStaffCount,
  pushRecentActivity,
  notifyFounders
};
