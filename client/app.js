const state = {
  token: localStorage.getItem("vm_token") || null,
  user: null,
  socket: null
};

const el = {
  loginScreen: document.getElementById("loginScreen"),
  app: document.getElementById("app"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  userLabel: document.getElementById("userLabel"),
  pageTitle: document.getElementById("pageTitle"),
  sidebarNav: document.getElementById("sidebarNav"),
  socketStatus: document.getElementById("socketStatus"),
  activityList: document.getElementById("activityList"),
  memberResults: document.getElementById("memberResults"),
  userHistory: document.getElementById("userHistory"),
  actionLogs: document.getElementById("actionLogs"),
  connectionLogs: document.getElementById("connectionLogs"),
  ticketList: document.getElementById("ticketList"),
  keysTable: document.getElementById("keysTable"),
  profileBox: document.getElementById("profileBox"),
  notificationTray: document.getElementById("notificationTray")
};

function hasPermission(permission) {
  if (!state.user) return false;
  return state.user.permissions.includes("*") || state.user.permissions.includes(permission);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }

  let body = options.body;
  if (body && typeof body === "object" && !(body instanceof FormData) && !options.rawBody) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body
  });

  if (!response.ok) {
    let message = "Erreur API";
    try {
      const error = await response.json();
      message = error.error || message;
    } catch (_) {
      // no-op
    }
    throw new Error(message);
  }

  if (options.expectBlob) {
    return response.blob();
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showPage(pageName) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === `page-${pageName}`);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === pageName);
  });
  el.pageTitle.textContent = document.querySelector(`.nav-item[data-page="${pageName}"]`)?.textContent || pageName;

  if (pageName === "dashboard") {
    loadDashboard();
  }
  if (pageName === "users") {
    el.memberResults.innerHTML = "";
  }
  if (pageName === "logs") {
    loadLogs();
  }
  if (pageName === "tickets") {
    loadTickets();
  }
  if (pageName === "keys" && state.user?.role === "Fondateur") {
    loadKeys();
  }
  if (pageName === "profile") {
    loadProfile();
  }
}

function notify(message, tone = "info") {
  const item = document.createElement("div");
  item.className = "notification";
  if (tone === "error") {
    item.style.borderLeftColor = "var(--danger)";
  }
  if (tone === "warn") {
    item.style.borderLeftColor = "var(--warning)";
  }
  item.innerHTML = `<strong>${escapeHtml(message)}</strong>`;
  el.notificationTray.prepend(item);
  setTimeout(() => {
    item.remove();
  }, 5000);
}

function setAuthenticatedView() {
  el.loginScreen.classList.add("hidden");
  el.app.classList.remove("hidden");
  el.userLabel.textContent = `${state.user.pseudo} - ${state.user.role}`;
  document.querySelectorAll(".founder-only").forEach((node) => {
    node.classList.toggle("hidden", state.user.role !== "Fondateur");
  });
}

function resetSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("vm_token");
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
  el.app.classList.add("hidden");
  el.loginScreen.classList.remove("hidden");
  el.loginError.textContent = "";
}

function renderActivity(items) {
  if (!items?.length) {
    el.activityList.innerHTML = "<li>Aucune activite.</li>";
    return;
  }

  el.activityList.innerHTML = items
    .map((item) => {
      const time = new Date(item.createdAt).toLocaleString("fr-FR");
      return `<li><strong>${escapeHtml(item.actorPseudo || "System")}</strong> - ${escapeHtml(item.actionType)}<br /><small>${escapeHtml(time)}</small></li>`;
    })
    .join("");
}

async function loadDashboard() {
  try {
    if (!hasPermission("VIEW_DASHBOARD")) {
      renderActivity([]);
      return;
    }

    const [stats, recent] = await Promise.all([
      api("/api/dashboard/stats"),
      api("/api/dashboard/recent-activity")
    ]);

    document.getElementById("statWarns").textContent = stats.warnCount;
    document.getElementById("statBans").textContent = stats.banCount;
    document.getElementById("statOnline").textContent = stats.staffConnected;
    document.getElementById("statTickets").textContent = stats.openTickets;
    renderActivity(recent.activity);
  } catch (error) {
    notify(error.message, "error");
  }
}

function renderMemberResults(members) {
  if (!members.length) {
    el.memberResults.innerHTML = "<p>Aucun membre trouve.</p>";
    return;
  }

  const rows = members
    .map((member) => {
      const roles = member.roles.map((role) => escapeHtml(role.name)).join(", ");
      return `
        <tr>
          <td>${escapeHtml(member.id)}</td>
          <td>${escapeHtml(member.pseudo)}</td>
          <td>${escapeHtml(roles || "Aucun")}</td>
          <td><button data-load-user="${escapeHtml(member.id)}">Charger</button></td>
        </tr>
      `;
    })
    .join("");

  el.memberResults.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Pseudo</th><th>Roles</th><th>Action</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderHistory(record) {
  const warns = record.warns?.length || 0;
  const notes = record.notes?.length || 0;
  const mutes = record.mutes?.length || 0;
  const bans = record.bans?.length || 0;
  const requests = record.banRequests?.length || 0;
  el.userHistory.innerHTML = `
    <p><strong>Utilisateur:</strong> ${escapeHtml(record.username || "Unknown")} (${escapeHtml(record.discordUserId)})</p>
    <p><strong>Warns:</strong> ${warns} | <strong>Notes:</strong> ${notes} | <strong>Mutes:</strong> ${mutes} | <strong>Bans:</strong> ${bans} | <strong>Demandes ban:</strong> ${requests}</p>
  `;
}

async function loadUserHistory(userId) {
  try {
    const data = await api(`/api/discord/member/${encodeURIComponent(userId)}/history`);
    renderHistory(data.record);
  } catch (error) {
    notify(error.message, "error");
  }
}

async function runModerationAction(action) {
  const userId = document.getElementById("targetUserId").value.trim();
  const reason = document.getElementById("actionReason").value.trim();
  const duration = Number(document.getElementById("actionDuration").value || 0);

  if (!userId) {
    notify("ID utilisateur requis.", "warn");
    return;
  }

  const map = {
    warn: { endpoint: `/api/discord/member/${userId}/warn`, body: { reason }, perm: "WARN_MEMBER" },
    note: { endpoint: `/api/discord/member/${userId}/note`, body: { note: reason }, perm: "ADD_NOTE" },
    mute: {
      endpoint: `/api/discord/member/${userId}/mute-temp`,
      body: { reason, durationMinutes: duration || 10 },
      perm: "TEMP_MUTE"
    },
    kick: { endpoint: `/api/discord/member/${userId}/kick`, body: { reason }, perm: "KICK_MEMBER" },
    "ban-request": {
      endpoint: `/api/discord/member/${userId}/ban-request`,
      body: { reason },
      perm: "REQUEST_BAN"
    },
    "ban-temp": {
      endpoint: `/api/discord/member/${userId}/ban-temp`,
      body: { reason, durationHours: duration || 1 },
      perm: "TEMP_BAN"
    },
    "ban-perm": {
      endpoint: `/api/discord/member/${userId}/ban`,
      body: { reason },
      perm: "PERM_BAN"
    },
    unban: {
      endpoint: `/api/discord/member/${userId}/ban`,
      body: { reason },
      method: "DELETE",
      perm: "REMOVE_BAN"
    }
  };

  const target = map[action];
  if (!target) return;
  if (!hasPermission(target.perm)) {
    notify(`Permission manquante: ${target.perm}`, "error");
    return;
  }

  try {
    await api(target.endpoint, { method: target.method || "POST", body: target.body });
    notify(`Action ${action} executee.`);
    await loadUserHistory(userId);
    await loadDashboard();
  } catch (error) {
    notify(error.message, "error");
  }
}

function renderLogsTable(container, rows, headers) {
  if (!rows.length) {
    container.innerHTML = "<p>Aucune donnee.</p>";
    return;
  }
  const head = headers.map((h) => `<th>${escapeHtml(h.label)}</th>`).join("");
  const body = rows
    .map((row) => {
      return `<tr>${headers.map((h) => `<td>${escapeHtml(row[h.key] ?? "")}</td>`).join("")}</tr>`;
    })
    .join("");
  container.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function loadLogs() {
  if (hasPermission("VIEW_LOGS")) {
    try {
      const data = await api("/api/logs/actions");
      const rows = data.logs.map((item) => ({
        pseudo: item.actorPseudo,
        role: item.actorRole,
        action: item.actionType,
        cible: item.targetId || "-",
        date: new Date(item.createdAt).toLocaleString("fr-FR")
      }));
      renderLogsTable(el.actionLogs, rows, [
        { key: "pseudo", label: "Pseudo" },
        { key: "role", label: "Role" },
        { key: "action", label: "Action" },
        { key: "cible", label: "Cible" },
        { key: "date", label: "Date" }
      ]);
    } catch (error) {
      el.actionLogs.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
  } else {
    el.actionLogs.innerHTML = "<p>Permission VIEW_LOGS requise.</p>";
  }

  if (hasPermission("VIEW_CONNECTIONS")) {
    try {
      const data = await api("/api/logs/connections");
      const rows = data.logs.map((item) => ({
        pseudo: item.pseudo,
        role: item.role,
        ip: item.ipAddress,
        date: new Date(item.connectedAt).toLocaleString("fr-FR")
      }));
      renderLogsTable(el.connectionLogs, rows, [
        { key: "pseudo", label: "Pseudo" },
        { key: "role", label: "Role" },
        { key: "ip", label: "IP" },
        { key: "date", label: "Date" }
      ]);
    } catch (error) {
      el.connectionLogs.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    }
  } else {
    el.connectionLogs.innerHTML = "<p>Permission VIEW_CONNECTIONS requise.</p>";
  }
}

async function downloadCsv(endpoint, filename) {
  try {
    const blob = await api(endpoint, { expectBlob: true });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    notify(error.message, "error");
  }
}

function renderTickets(tickets) {
  if (!tickets.length) {
    el.ticketList.innerHTML = "<p>Aucun ticket.</p>";
    return;
  }

  const canManage = hasPermission("MANAGE_TICKETS");
  const rows = tickets
    .map((ticket) => {
      const statusControl = canManage
        ? `
          <select data-ticket-status="${escapeHtml(ticket.ticketId)}">
            <option value="open" ${ticket.status === "open" ? "selected" : ""}>open</option>
            <option value="in_progress" ${ticket.status === "in_progress" ? "selected" : ""}>in_progress</option>
            <option value="closed" ${ticket.status === "closed" ? "selected" : ""}>closed</option>
          </select>
        `
        : escapeHtml(ticket.status);
      return `
        <tr>
          <td>${escapeHtml(ticket.ticketId)}</td>
          <td>${escapeHtml(ticket.subject)}</td>
          <td>${statusControl}</td>
          <td>${escapeHtml(ticket.createdBy.pseudo)}</td>
          <td>${new Date(ticket.updatedAt).toLocaleString("fr-FR")}</td>
        </tr>
      `;
    })
    .join("");

  el.ticketList.innerHTML = `
    <table>
      <thead><tr><th>ID</th><th>Sujet</th><th>Statut</th><th>Cree par</th><th>Maj</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function loadTickets() {
  try {
    if (!hasPermission("VIEW_TICKETS")) {
      el.ticketList.innerHTML = "<p>Permission VIEW_TICKETS requise.</p>";
      return;
    }
    const data = await api("/api/tickets");
    renderTickets(data.tickets);
  } catch (error) {
    notify(error.message, "error");
  }
}

async function loadKeys() {
  try {
    const data = await api("/api/keys");
    const rows = data.keys
      .map(
        (key) => `
          <tr>
            <td>${escapeHtml(key.pseudo)}</td>
            <td>${escapeHtml(key.role)}</td>
            <td>${escapeHtml((key.permissions || []).join(", "))}</td>
            <td><span class="pill ${key.isActive ? "active" : "off"}">${key.isActive ? "Active" : "Desactivee"}</span></td>
            <td>
              <button data-toggle-key="${escapeHtml(key.id)}" data-active="${key.isActive ? "1" : "0"}">
                ${key.isActive ? "Desactiver" : "Activer"}
              </button>
            </td>
          </tr>
        `
      )
      .join("");

    el.keysTable.innerHTML = `
      <table>
        <thead><tr><th>Pseudo</th><th>Role</th><th>Permissions</th><th>Etat</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (error) {
    notify(error.message, "error");
  }
}

async function loadProfile() {
  try {
    const profile = await api("/api/users/me/profile");
    el.profileBox.innerHTML = `
      <p><strong>Pseudo:</strong> ${escapeHtml(profile.pseudo)}</p>
      <p><strong>Role:</strong> ${escapeHtml(profile.role)}</p>
      <p><strong>Niveau:</strong> ${profile.stats.level} - ${escapeHtml(profile.stats.levelLabel)}</p>
      <p><strong>Actions enregistrees:</strong> ${profile.stats.actions}</p>
      <p><strong>Permissions:</strong> ${escapeHtml(profile.permissions.join(", "))}</p>
    `;
  } catch (error) {
    notify(error.message, "error");
  }
}

function initSocket() {
  state.socket = io({
    auth: {
      token: state.token
    }
  });

  state.socket.on("connect", () => {
    el.socketStatus.textContent = "Live";
  });

  state.socket.on("disconnect", () => {
    el.socketStatus.textContent = "Offline";
  });

  state.socket.on("activity:new", (item) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${escapeHtml(item.actorPseudo || "System")}</strong> - ${escapeHtml(item.actionType)}<br /><small>${new Date(item.createdAt).toLocaleString("fr-FR")}</small>`;
    el.activityList.prepend(li);
    while (el.activityList.children.length > 40) {
      el.activityList.removeChild(el.activityList.lastChild);
    }
  });

  state.socket.on("staff:online", (payload) => {
    const stat = document.getElementById("statOnline");
    if (stat) stat.textContent = payload.online;
  });

  state.socket.on("founder:staff-login", (payload) => {
    notify(`Connexion staff: ${payload.pseudo} (${payload.ipAddress})`);
  });

  state.socket.on("founder:ban-request", (payload) => {
    notify(`Demande ban: ${payload.username} par ${payload.requestedBy}`, "warn");
  });

  state.socket.on("founder:ban-notification", (payload) => {
    notify(`Ban execute: ${payload.username} (${payload.by})`, "warn");
  });
}

async function initAuthenticated() {
  try {
    const me = await api("/api/auth/me");
    state.user = me.user;
    setAuthenticatedView();
    showPage("dashboard");
    initSocket();
  } catch (_) {
    resetSession();
  }
}

function bindEvents() {
  el.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    el.loginError.textContent = "";
    const sessionKey = document.getElementById("sessionKeyInput").value.trim();
    if (!sessionKey) {
      el.loginError.textContent = "Cle requise.";
      return;
    }

    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: { sessionKey }
      });
      state.token = result.token;
      state.user = result.user;
      localStorage.setItem("vm_token", state.token);
      setAuthenticatedView();
      showPage("dashboard");
      initSocket();
    } catch (error) {
      el.loginError.textContent = error.message;
    }
  });

  document.getElementById("logoutButton").addEventListener("click", async () => {
    try {
      if (state.token) {
        await api("/api/auth/logout", { method: "POST" });
      }
    } catch (_) {
      // no-op
    }
    resetSession();
  });

  el.sidebarNav.addEventListener("click", (event) => {
    const button = event.target.closest(".nav-item");
    if (!button) return;
    if (button.classList.contains("hidden")) return;
    showPage(button.dataset.page);
  });

  document.getElementById("refreshActivity").addEventListener("click", loadDashboard);

  document.getElementById("memberSearchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!hasPermission("VIEW_MEMBERS")) {
      notify("Permission VIEW_MEMBERS requise.", "error");
      return;
    }
    const q = document.getElementById("memberSearchInput").value.trim();
    try {
      const data = await api(`/api/discord/members?q=${encodeURIComponent(q)}`);
      renderMemberResults(data.members);
    } catch (error) {
      notify(error.message, "error");
    }
  });

  el.memberResults.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-load-user]");
    if (!button) return;
    const userId = button.dataset.loadUser;
    document.getElementById("targetUserId").value = userId;
    await loadUserHistory(userId);
  });

  document.getElementById("modActionForm").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    runModerationAction(button.dataset.action);
  });

  document.getElementById("exportActionsCsv").addEventListener("click", () => {
    downloadCsv("/api/logs/actions/export.csv", "action_logs.csv");
  });

  document.getElementById("exportConnectionsCsv").addEventListener("click", () => {
    downloadCsv("/api/logs/connections/export.csv", "connection_logs.csv");
  });

  document.getElementById("ticketForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const subject = document.getElementById("ticketSubject").value.trim();
    const description = document.getElementById("ticketDescription").value.trim();

    try {
      await api("/api/tickets", {
        method: "POST",
        body: { subject, description }
      });
      document.getElementById("ticketSubject").value = "";
      document.getElementById("ticketDescription").value = "";
      notify("Ticket cree.");
      loadTickets();
    } catch (error) {
      notify(error.message, "error");
    }
  });

  document.getElementById("refreshTickets").addEventListener("click", loadTickets);

  el.ticketList.addEventListener("change", async (event) => {
    const select = event.target.closest("select[data-ticket-status]");
    if (!select) return;
    const ticketId = select.dataset.ticketStatus;
    const status = select.value;
    try {
      await api(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
        method: "PATCH",
        body: { status }
      });
      notify(`Statut ticket ${ticketId} mis a jour.`);
    } catch (error) {
      notify(error.message, "error");
      loadTickets();
    }
  });

  document.getElementById("keyCreateForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const pseudo = document.getElementById("keyPseudo").value.trim();
    const role = document.getElementById("keyRole").value;
    const customKey = document.getElementById("keyCustom").value.trim();
    try {
      const result = await api("/api/keys", {
        method: "POST",
        body: { pseudo, role, customKey: customKey || undefined }
      });
      document.getElementById("newKeyOutput").textContent = `Nouvelle cle (${result.key.pseudo}): ${result.sessionKey}`;
      document.getElementById("keyPseudo").value = "";
      document.getElementById("keyCustom").value = "";
      loadKeys();
    } catch (error) {
      notify(error.message, "error");
    }
  });

  document.getElementById("refreshKeys").addEventListener("click", loadKeys);

  el.keysTable.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-toggle-key]");
    if (!button) return;
    const keyId = button.dataset.toggleKey;
    const currentlyActive = button.dataset.active === "1";
    try {
      await api(`/api/keys/${encodeURIComponent(keyId)}/active`, {
        method: "PATCH",
        body: { isActive: !currentlyActive }
      });
      loadKeys();
    } catch (error) {
      notify(error.message, "error");
    }
  });

  document.getElementById("refreshProfile").addEventListener("click", loadProfile);
}

bindEvents();
if (state.token) {
  initAuthenticated();
}
