#!/usr/bin/env node
// STAGE 1 — DRY RUN: lists test/sample accounts. Deletes nothing.
//
// Bootstraps credentials from the Firebase CLI's stored OAuth tokens so no
// service-account key file download is required.

const os = require("os");
const path = require("path");
const fs = require("fs");
const https = require("https");

// ── credential bootstrap ────────────────────────────────────────────────────

function readFirebaseCLITokens() {
  const configPath = path.join(
    os.homedir(),
    ".config/configstore/firebase-tools.json"
  );
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")).tokens || null;
  } catch {
    return null;
  }
}

// Firebase CLI public OAuth2 client (same values the CLI embeds).
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

function writeADCFile(tokens) {
  // google-auth-library accepts an "authorized_user" ADC file — the same
  // format that `gcloud auth application-default login` produces.
  const adcContent = {
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
    refresh_token: tokens.refresh_token,
    type: "authorized_user",
  };
  const tmpPath = path.join(os.tmpdir(), "speakup-adc-tmp.json");
  fs.writeFileSync(tmpPath, JSON.stringify(adcContent), { mode: 0o600 });
  return tmpPath;
}

// ── load deps ───────────────────────────────────────────────────────────────

function loadFirebaseAdmin() {
  try {
    return require("firebase-admin");
  } catch {
    return require("../functions/node_modules/firebase-admin");
  }
}

// ── matching logic ───────────────────────────────────────────────────────────

const TEST_PATTERNS = [
  /codex/i,
  /render/i,
  /claude/i,
  /@example\.com$/i,
];

function isTestEmail(email) {
  if (!email) return false;
  if (/^test/i.test(email)) return true;
  return TEST_PATTERNS.some((re) => re.test(email));
}

function isPaid(data) {
  if (data.fullUnlock === true) return true;
  if (data.licenseExpiresAt) {
    try {
      return new Date(data.licenseExpiresAt) > new Date();
    } catch {
      return false;
    }
  }
  return false;
}

function fmt(val) {
  if (!val) return "—";
  if (val?.toDate) return val.toDate().toISOString(); // Firestore Timestamp
  return String(val);
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  // Set up ADC from Firebase CLI tokens if no credentials are already set.
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const tokens = readFirebaseCLITokens();
    if (tokens?.refresh_token) {
      const adcPath = writeADCFile(tokens);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
      console.log(`[auth] Using Firebase CLI OAuth tokens via ${adcPath}`);
    } else {
      console.warn(
        "[auth] No Firebase CLI tokens found. " +
        "Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file."
      );
    }
  }

  const admin = loadFirebaseAdmin();
  admin.initializeApp({ projectId: "speakup-19106" });
  const db = admin.firestore();

  console.log("=".repeat(70));
  console.log("STAGE 1 — DRY RUN: scanning for test/sample accounts");
  console.log("=".repeat(70));

  // Pull all Firestore user docs
  const snap = await db.collection("users").get();
  const firestoreDocs = new Map();
  snap.forEach((doc) => firestoreDocs.set(doc.id, doc.data()));
  console.log(`[info] Loaded ${firestoreDocs.size} Firestore user documents`);

  // Walk all Auth users and match
  const matched = [];
  let pageToken;

  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const authUser of result.users) {
      const email = authUser.email || null;
      const noEmail = !email;
      if (!isTestEmail(email) && !noEmail) continue;

      const data = firestoreDocs.get(authUser.uid) || {};
      const paid = isPaid(data);

      matched.push({
        uid: authUser.uid,
        email: email || "(no email)",
        username: data.username || "—",
        createdAt:
          fmt(data.createdAt) !== "—"
            ? fmt(data.createdAt)
            : authUser.metadata.creationTime || "—",
        fullUnlock: data.fullUnlock === true,
        licenseExpiresAt: fmt(data.licenseExpiresAt),
        paid,
        noEmail,
      });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  // Split into safe-to-delete vs flagged (paid / fullUnlock)
  const safe = matched.filter((u) => !u.paid);
  const flagged = matched.filter((u) => u.paid);

  // Print flagged accounts first (never delete these)
  if (flagged.length > 0) {
    console.log("\n" + "!".repeat(70));
    console.log(
      `WARNING: ${flagged.length} matched account(s) with ACTIVE PAID LICENSE or fullUnlock`
    );
    console.log("!".repeat(70));
    console.log("These will NOT be included in Stage 2 deletion.\n");
    for (const u of flagged) {
      console.log(`  UID:              ${u.uid}`);
      console.log(`  Email:            ${u.email}`);
      console.log(`  Username:         ${u.username}`);
      console.log(`  Created:          ${u.createdAt}`);
      console.log(`  fullUnlock:       ${u.fullUnlock}`);
      console.log(`  licenseExpiresAt: ${u.licenseExpiresAt}`);
      console.log();
    }
  }

  // Print safe accounts
  console.log("-".repeat(70));
  console.log(`TEST ACCOUNTS (safe to delete): ${safe.length}`);
  console.log("-".repeat(70) + "\n");

  for (const u of safe) {
    console.log(`  UID:              ${u.uid}`);
    console.log(`  Email:            ${u.email}`);
    console.log(`  Username:         ${u.username}`);
    console.log(`  Created:          ${u.createdAt}`);
    console.log(`  fullUnlock:       ${u.fullUnlock}`);
    console.log(`  licenseExpiresAt: ${u.licenseExpiresAt}`);
    console.log();
  }

  // Summary
  console.log("=".repeat(70));
  console.log(`TOTAL matched:   ${matched.length}`);
  console.log(`  → Safe to delete:  ${safe.length}`);
  console.log(`  → FLAGGED (paid):  ${flagged.length}  ← review manually`);
  console.log("=".repeat(70));
  console.log("\nSTAGE 1 complete. Nothing was deleted.");
  console.log("Review the list above, then confirm to proceed with Stage 2.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
