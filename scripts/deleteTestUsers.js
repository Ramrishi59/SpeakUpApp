#!/usr/bin/env node
// STAGE 2 — ACTUAL DELETION from Firebase Auth + Firestore users collection.
// Accounts in KEEP_EMAILS are never touched regardless of pattern match.

const os = require("os");
const path = require("path");
const fs = require("fs");

// ── Safety keep-list — hard-coded, never deleted ────────────────────────────
const KEEP_EMAILS = new Set([
  "rameshtcr@gmail.com",   // owner personal account
  "ganesh@gmail.com",      // verified ₹499 paying customer
  "test@gmail.com",        // fullUnlock admin grant (flagged in Stage 1)
]);

// ── Credential bootstrap (same as Stage 1) ──────────────────────────────────
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLI_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

function setupADC() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const configPath = path.join(
    os.homedir(),
    ".config/configstore/firebase-tools.json"
  );
  let tokens;
  try {
    tokens = JSON.parse(fs.readFileSync(configPath, "utf8")).tokens;
  } catch { return; }
  if (!tokens?.refresh_token) return;
  const adc = {
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
    refresh_token: tokens.refresh_token,
    type: "authorized_user",
  };
  const tmpPath = path.join(os.tmpdir(), "speakup-adc-tmp.json");
  fs.writeFileSync(tmpPath, JSON.stringify(adc), { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

// ── Matching logic (identical to Stage 1) ───────────────────────────────────
const TEST_PATTERNS = [/codex/i, /render/i, /claude/i, /@example\.com$/i];

function isTestEmail(email) {
  if (!email) return false;
  if (/^test/i.test(email)) return true;
  return TEST_PATTERNS.some((re) => re.test(email));
}

function isPaid(data) {
  if (data.fullUnlock === true) return true;
  if (data.licenseExpiresAt) {
    try { return new Date(data.licenseExpiresAt) > new Date(); } catch { return false; }
  }
  return false;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  setupADC();
  const admin = require("../functions/node_modules/firebase-admin");
  admin.initializeApp({ projectId: "speakup-19106" });
  const db = admin.firestore();

  console.log("=".repeat(70));
  console.log("STAGE 2 — DELETING test/sample accounts");
  console.log("Keep-list (never touched):", [...KEEP_EMAILS].join(", "));
  console.log("=".repeat(70) + "\n");

  // Load Firestore docs
  const snap = await db.collection("users").get();
  const firestoreDocs = new Map();
  snap.forEach((doc) => firestoreDocs.set(doc.id, doc.data()));

  // Build delete list — same logic as Stage 1, plus keep-list guard
  const toDelete = [];
  const skipped = [];
  let pageToken;

  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const authUser of result.users) {
      const email = authUser.email || null;
      const noEmail = !email;
      if (!isTestEmail(email) && !noEmail) continue;

      // Hard keep-list guard
      if (email && KEEP_EMAILS.has(email.toLowerCase())) {
        skipped.push({ uid: authUser.uid, email, reason: "in keep-list" });
        continue;
      }

      const data = firestoreDocs.get(authUser.uid) || {};

      // Never delete paid accounts
      if (isPaid(data)) {
        skipped.push({ uid: authUser.uid, email: email || "(no email)", reason: "paid/fullUnlock" });
        continue;
      }

      toDelete.push({ uid: authUser.uid, email: email || "(no email)" });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  console.log(`Accounts to delete: ${toDelete.length}`);
  console.log(`Accounts skipped (protected): ${skipped.length}\n`);

  if (skipped.length > 0) {
    console.log("SKIPPED (protected):");
    skipped.forEach((u) => console.log(`  ${u.email}  (${u.reason})`));
    console.log();
  }

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  // Delete in batches
  let authDeleted = 0;
  let firestoreDeleted = 0;
  let authFailed = 0;
  let firestoreFailed = 0;

  // Firebase Auth supports deleteUsers() for up to 1000 UIDs at once
  const AUTH_BATCH = 1000;
  for (let i = 0; i < toDelete.length; i += AUTH_BATCH) {
    const batch = toDelete.slice(i, i + AUTH_BATCH);
    const uids = batch.map((u) => u.uid);
    const result = await admin.auth().deleteUsers(uids);
    authDeleted += result.successCount;
    authFailed += result.failureCount;
    if (result.errors.length > 0) {
      result.errors.forEach((e) =>
        console.error(`  Auth delete error [${uids[e.index]}]: ${e.error.message}`)
      );
    }
  }

  // Firestore batch deletes (max 500 ops per commit)
  const FS_BATCH = 500;
  for (let i = 0; i < toDelete.length; i += FS_BATCH) {
    const chunk = toDelete.slice(i, i + FS_BATCH);
    const batch = db.batch();
    for (const u of chunk) {
      if (firestoreDocs.has(u.uid)) {
        batch.delete(db.collection("users").doc(u.uid));
      }
    }
    try {
      await batch.commit();
      firestoreDeleted += chunk.filter((u) => firestoreDocs.has(u.uid)).length;
    } catch (e) {
      firestoreFailed += chunk.length;
      console.error(`  Firestore batch error: ${e.message}`);
    }
  }

  // Print per-account summary
  console.log("Deleted accounts:");
  toDelete.forEach((u) => console.log(`  [gone] ${u.email}  (${u.uid})`));

  console.log("\n" + "=".repeat(70));
  console.log(`Auth deleted:       ${authDeleted}  (failed: ${authFailed})`);
  console.log(`Firestore deleted:  ${firestoreDeleted}  (failed: ${firestoreFailed})`);
  console.log("=".repeat(70));
  console.log("\nStage 2 complete.");
}

main().catch((err) => { console.error(err); process.exit(1); });
