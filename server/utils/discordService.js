const {
  Client,
  GatewayIntentBits,
  OAuth2Scopes,
  PermissionFlagsBits
} = require("discord.js");

let discordClient = null;

async function initDiscordClient() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return null;
  }

  discordClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
  });

  await discordClient.login(token);
  return discordClient;
}

function buildDiscordOAuthUrl() {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) {
    return null;
  }

  const base = "https://discord.com/oauth2/authorize";
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: [OAuth2Scopes.Identify, OAuth2Scopes.Guilds].join(" ")
  });

  return `${base}?${params.toString()}`;
}

function assertDiscordReady() {
  if (!discordClient || !discordClient.isReady()) {
    throw new Error("Discord bot non configuré ou non connecté.");
  }

  if (!process.env.DISCORD_GUILD_ID) {
    throw new Error("DISCORD_GUILD_ID manquant.");
  }
}

async function getGuild() {
  assertDiscordReady();
  const guild = await discordClient.guilds.fetch(process.env.DISCORD_GUILD_ID);
  return guild;
}

function compactMember(member) {
  return {
    id: member.id,
    pseudo: member.user?.username || member.displayName,
    displayName: member.displayName,
    roles: member.roles?.cache
      ? member.roles.cache
          .filter((role) => role.name !== "@everyone")
          .map((role) => ({ id: role.id, name: role.name }))
      : []
  };
}

async function searchGuildMembers(query = "") {
  const guild = await getGuild();
  const members = await guild.members.fetch({ limit: 1000 });
  const lowered = query.toLowerCase();

  return members
    .filter((member) => {
      if (!query) {
        return true;
      }
      return (
        member.user.username.toLowerCase().includes(lowered) ||
        member.displayName.toLowerCase().includes(lowered) ||
        member.id === query
      );
    })
    .map(compactMember)
    .slice(0, 100);
}

async function getGuildMemberProfile(memberId) {
  const guild = await getGuild();
  const member = await guild.members.fetch(memberId);
  return compactMember(member);
}

async function timeoutMember(memberId, durationMinutes, reason) {
  const guild = await getGuild();
  const member = await guild.members.fetch(memberId);
  await member.timeout(durationMinutes * 60 * 1000, reason);
  return compactMember(member);
}

async function kickMember(memberId, reason) {
  const guild = await getGuild();
  const member = await guild.members.fetch(memberId);
  await member.kick(reason);
}

async function banMember(memberId, reason, deleteMessageSeconds = 0) {
  const guild = await getGuild();
  await guild.members.ban(memberId, { reason, deleteMessageSeconds });
}

async function unbanMember(memberId, reason) {
  const guild = await getGuild();
  await guild.members.unban(memberId, reason);
}

function getBotInviteLink() {
  if (!process.env.DISCORD_CLIENT_ID) {
    return null;
  }

  const base = "https://discord.com/oauth2/authorize";
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    permissions: String(
      PermissionFlagsBits.BanMembers |
        PermissionFlagsBits.KickMembers |
        PermissionFlagsBits.ModerateMembers |
        PermissionFlagsBits.ViewAuditLog
    ),
    scope: "bot applications.commands"
  });

  return `${base}?${params.toString()}`;
}

module.exports = {
  initDiscordClient,
  buildDiscordOAuthUrl,
  getBotInviteLink,
  searchGuildMembers,
  getGuildMemberProfile,
  timeoutMember,
  kickMember,
  banMember,
  unbanMember
};
