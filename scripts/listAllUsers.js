#!/usr/bin/env node
// STAGE 1 — DRY RUN: list every account, split into KEEP vs DELETE.
// Deletes nothing.

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

function isPaid(data) {
  if (data.fullUnlock === true) return true;
  if (data.licenseExpiresAt) {
    try { return new Date(data.licenseExpiresAt) > new Date(); } catch { return false; }
  }
  return false;
}

function fmt(val) {
  if (!val) return "—";
  if (val?.toDate) return val.toDate().toISOString();
  return String(val);
}

async function main() {
  setupADC();
  const admin = require("../functions/node_modules/firebase-admin");
  admin.initializeApp({ projectId: "speakup-19106" });
  const db = admin.firestore();

  // Load all Firestore docs
  const snap = await db.collection("users").get();
  const firestoreDocs = new Map();
  snap.forEach((doc) => firestoreDocs.set(doc.id, doc.data()));

  // Walk all Auth users
  const keepList = [];
  const deleteList = [];
  let pageToken;

  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    for (const authUser of result.users) {
      const email = (authUser.email || "").toLowerCase();
      const data = firestoreDocs.get(authUser.uid) || {};
      const paid = isPaid(data);
      const entry = {
        uid: authUser.uid,
        email: authUser.email || "(no email)",
        username: data.username || "—",
        createdAt: fmt(data.createdAt) !== "—" ? fmt(data.createdAt) : authUser.metadata.creationTime || "—",
        fullUnlock: data.fullUnlock === true,
        licenseExpiresAt: fmt(data.licenseExpiresAt),
        paid,
      };

      if (KEEP_EMAILS.has(email)) {
        keepList.push(entry);
      } else {
        deleteList.push(entry);
      }
    }
    pageToken = result.pageToken;
  } while (pageToken);

  // Also note any Firestore docs with no matching Auth user
  const authUids = new Set([...keepList, ...deleteList].map(u => u.uid));
  const orphanDocs = [];
  firestoreDocs.forEach((data, uid) => {
    if (!authUids.has(uid)) {
      orphanDocs.push({ uid, data });
    }
  });

  console.log("=".repeat(70));
  console.log("STAGE 1 — DRY RUN: full account audit");
  console.log("=".repeat(70));

  // ── WILL KEEP ──────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(70));
  console.log("WILL KEEP (" + keepList.length + " of 3 expected)");
  console.log("─".repeat(70));

  const keepEmailsFound = new Set();
  for (const u of keepList) {
    keepEmailsFound.add(u.email.toLowerCase());
    const licenseNote = u.fullUnlock
      ? `fullUnlock=true, licenseExpiresAt=${u.licenseExpiresAt}`
      : "no paid license";
    console.log(`  Email:    ${u.email}`);
    console.log(`  Username: ${u.username}`);
    console.log(`  License:  ${licenseNote}`);
    console.log(`  UID:      ${u.uid}`);
    console.log();
  }

  // Warn about any keep-list account not found in Auth
  for (const e of KEEP_EMAILS) {
    if (!keepEmailsFound.has(e)) {
      console.log(`  *** NOT FOUND IN AUTH: ${e} ***`);
    }
  }

  // ── WILL DELETE ────────────────────────────────────────────────────────────
  console.log("─".repeat(70));
  console.log("WILL DELETE (" + deleteList.length + " accounts)");
  console.log("─".repeat(70) + "\n");

  // Sort: flagged (paid) first so they're easy to spot
  deleteList.sort((a, b) => (b.paid ? 1 : 0) - (a.paid ? 1 : 0));

  for (const u of deleteList) {
    if (u.paid) {
      console.log("  *** FLAGGED — HAS PAID LICENSE / fullUnlock ***");
    }
    console.log(`  Email:            ${u.email}`);
    console.log(`  Username:         ${u.username}`);
    console.log(`  UID:              ${u.uid}`);
    console.log(`  Created:          ${u.createdAt}`);
    console.log(`  fullUnlock:       ${u.fullUnlock}`);
    console.log(`  licenseExpiresAt: ${u.licenseExpiresAt}`);
    if (u.paid) {
      console.log("  *** END FLAGGED ***");
    }
    console.log();
  }

  // ── Orphan Firestore docs (no Auth user) ───────────────────────────────────
  if (orphanDocs.length > 0) {
    console.log("─".repeat(70));
    console.log(`ORPHAN FIRESTORE DOCS (no Auth account) — ${orphanDocs.length}`);
    console.log("─".repeat(70));
    console.log("These have no Auth user. Stage 2 will also delete these Firestore docs.\n");
    for (const { uid, data } of orphanDocs) {
      console.log(`  UID:      ${uid}`);
      console.log(`  Username: ${data.username || "—"}`);
      console.log(`  Email:    ${data.email || "—"}`);
      console.log(`  Created:  ${fmt(data.createdAt)}`);
      console.log();
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const flaggedCount = deleteList.filter(u => u.paid).length;
  console.log("=".repeat(70));
  console.log(`WILL KEEP:    ${keepList.length}`);
  console.log(`WILL DELETE:  ${deleteList.length} Auth accounts + ${orphanDocs.length} orphan Firestore docs`);
  if (flaggedCount > 0) {
    console.log(`  *** ${flaggedCount} in delete list have paid license/fullUnlock — review before confirming ***`);
  }
  console.log("=".repeat(70));
  console.log("\nSTAGE 1 complete. Nothing deleted.");
  console.log('Reply "yes, delete these" to proceed to Stage 2.');
}

main().catch((err) => { console.error(err); process.exit(1); });
