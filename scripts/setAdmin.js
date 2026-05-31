#!/usr/bin/env node

function loadFirebaseAdmin() {
  try {
    return require("firebase-admin");
  } catch {
    return require("../functions/node_modules/firebase-admin");
  }
}

const admin = loadFirebaseAdmin();
const email = process.argv[2];

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/setAdmin.js admin@example.com");
  process.exit(1);
}

admin.initializeApp({
  projectId: "speakup-19106"
});

async function main() {
  const user = await admin.auth().getUserByEmail(email);
  const existingClaims = user.customClaims || {};
  await admin.auth().setCustomUserClaims(user.uid, {
    ...existingClaims,
    admin: true
  });

  console.log(`Admin claim assigned to ${email} (${user.uid}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
