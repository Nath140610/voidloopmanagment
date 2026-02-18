const dotenv = require("dotenv");
const mongoose = require("mongoose");

const SessionKey = require("../../models/SessionKey");
const { hashSessionKey, generateSessionKey } = require("../utils/sessionKeys");
const { resolvePermissions } = require("../constants/permissions");

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const founderExists = await SessionKey.exists({ role: "Fondateur" });
  if (founderExists) {
    console.log("Une clé fondateur existe déjà.");
    await mongoose.disconnect();
    return;
  }

  const pseudo = process.env.FOUNDER_BOOTSTRAP_PSEUDO || "VoidFounder";
  const rawKey = process.env.FOUNDER_BOOTSTRAP_KEY || generateSessionKey(28);
  const keyHash = await hashSessionKey(rawKey);

  await SessionKey.create({
    pseudo,
    role: "Fondateur",
    permissions: resolvePermissions("Fondateur", []),
    keyHash,
    createdBy: "seed-script"
  });

  console.log("Clé fondateur créée:");
  console.log(`Pseudo: ${pseudo}`);
  console.log(`Clé: ${rawKey}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // no-op
  }
  process.exit(1);
});
