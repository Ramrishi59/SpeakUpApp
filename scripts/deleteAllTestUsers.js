#!/usr/bin/env node
// STAGE 2 — Delete every account NOT in KEEP_EMAILS from Auth + Firestore.
// Also deletes orphan Firestore docs (no Auth user).

const os = require("os");
const path = require("path");
const fs = require("fs");

const KEEP_EMAILS = new Set([
  "rameshtcr@gmail.com",
  "ganesh@gmail.com",
  "test@gmail.com",
]);

function setupADC() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return;
  const configPath = path.join(os.homedir(), ".config/configstore/firebase-tools.json");
  let tokens;
  try { tokens = JSON.parse(fs.readFileSync(configPath, "utf8")).tokens; } catch { return; }
  if (!tokens?.refresh_token) return;
  const adc = {
    client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
    refresh_token: tokens.refresh_token,
    type: "authorized_user",
  };
  const tmpPath = path.join(os.tmpdir(), "speakup-adc-tmp.json");
  fs.writeFileSync(tmpPath, JSON.stringify(adc), { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

async function main() {
  setupADC();
  const admin = require("../functions/node_modules/firebase-admin");
  admin.initializeApp({ projectId: "speakup-19106" });
  const db = admin.firestore();

  console.log("=".repeat(70));
  console.log("STAGE 2 — DELETING accounts");
  console.log("Keep-list:", [...KEEP_EMAILS].join(", "));
  console.log("=".repeat(70) + "\n");

  // Load all Firestore docs
  const snap = await db.collection("users").get();
  const firestoreDocs = new Map();
  snap.forEach((doc) => firestoreDocs.set(doc.id, doc.data()));

  // Walk all Auth users, build delete list
  const toDelete = [];
  const kept = [];
  let pageToken;

  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const authUser of result.users) {
      const email = (authUser.email || "").toLowerCase();
      if (KEEP_EMAILS.has(email)) {
        kept.push(authUser.email);
        continue;
      }
      toDelete.push({ uid: authUser.uid, email: authUser.email || "(no email)" });
    }
    pageToken = result.pageToken;
  } while (pageToken);

  // Find orphan Firestore docs (no Auth user)
  const authUidSet = new Set([
    ...toDelete.map(u => u.uid),
    ...kept.map(() => null).filter(Boolean), // placeholder — we resolve kept UIDs below
  ]);
  // Re-derive: all UIDs seen in Auth
  const allAuthUids = new Set(toDelete.map(u => u.uid));
  // Add kept UIDs by looking them up
  for (const email of KEEP_EMAILS) {
    try {
      const u = await admin.auth().getUserByEmail(email);
      allAuthUids.add(u.uid);
    } catch { /* not found — skip */ }
  }

  const orphanUids = [];
  firestoreDocs.forEach((_, uid) => {
    if (!allAuthUids.has(uid)) orphanUids.push(uid);
  });

  console.log(`Auth accounts to delete:        ${toDelete.length}`);
  console.log(`Orphan Firestore docs to delete: ${orphanUids.length}`);
  console.log(`Accounts kept:                   ${kept.length}\n`);

  // ── Delete Auth accounts ──────────────────────────────────────────────────
  let authDeleted = 0;
  let authFailed = 0;

  for (let i = 0; i < toDelete.length; i += 1000) {
    const batch = toDelete.slice(i, i + 1000);
    const result = await admin.auth().deleteUsers(batch.map(u => u.uid));
    authDeleted += result.successCount;
    authFailed += result.failureCount;
    result.errors.forEach(e =>
      console.error(`  Auth error [${batch[e.index].email}]: ${e.error.message}`)
    );
  }

  // ── Delete Firestore docs for Auth-deleted accounts + orphans ────────────
  const fsUidsToDelete = [
    ...toDelete.map(u => u.uid),
    ...orphanUids,
  ].filter(uid => firestoreDocs.has(uid));

  let fsDeleted = 0;
  let fsFailed = 0;

  for (let i = 0; i < fsUidsToDelete.length; i += 500) {
    const chunk = fsUidsToDelete.slice(i, i + 500);
    const batch = db.batch();
    chunk.forEach(uid => batch.delete(db.collection("users").doc(uid)));
    try {
      await batch.commit();
      fsDeleted += chunk.length;
    } catch (e) {
      fsFailed += chunk.length;
      console.error(`  Firestore batch error: ${e.message}`);
    }
  }

  // ── Per-account log ───────────────────────────────────────────────────────
  console.log("Deleted:");
  toDelete.forEach(u => console.log(`  [auth+fs] ${u.email}  (${u.uid})`));
  orphanUids.forEach(uid => {
    const d = firestoreDocs.get(uid) || {};
    console.log(`  [fs only] orphan doc  uid=${uid}  username=${d.username || "—"}  email=${d.email || "—"}`);
  });

  console.log("\n" + "=".repeat(70));
  console.log(`Auth deleted:       ${authDeleted}  (failed: ${authFailed})`);
  console.log(`Firestore deleted:  ${fsDeleted}  (failed: ${fsFailed})`);
  console.log("=".repeat(70));
  console.log("\nStage 2 complete.");
}

main().catch((err) => { console.error(err); process.exit(1); });
