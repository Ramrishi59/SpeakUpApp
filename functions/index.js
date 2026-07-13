const crypto = require("crypto");

const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { auth } = require("firebase-functions/v1");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const Razorpay = require("razorpay");

admin.initializeApp();

const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const db = admin.firestore();
const TRIAL_DURATION_MS  = 24 * 60 * 60 * 1000;
const PURCHASE_DURATION_MS = 90 * 24 * 60 * 60 * 1000;
const PREMIUM_PRICE_PAISE  = 49900;   // ₹499.00 — change here to reprice
const PREMIUM_CURRENCY     = "INR";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  res.set(CORS_HEADERS).status(204).send("");
  return true;
}

function requirePost(req, res) {
  if (req.method === "POST") return true;
  res.set(CORS_HEADERS).status(405).json({ error: "Method not allowed" });
  return false;
}

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }

  return { keyId, keySecret };
}

function getRazorpayClient() {
  const { keyId, keySecret } = getRazorpayCredentials();
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

async function authenticateRequest(req) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/i);

  if (!match) {
    const error = new Error("Missing Firebase auth token.");
    error.status = 401;
    throw error;
  }

  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch (cause) {
    const error = new Error("Invalid Firebase auth token.");
    error.status = 401;
    error.cause = cause;
    throw error;
  }
}

function getPaymentEmail(decodedToken, payment) {
  return payment?.email || decodedToken.email || null;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 100) {
    const error = new Error("Amount must be an integer of at least 100 paise.");
    error.status = 400;
    throw error;
  }
  return amount;
}

function normalizeCurrency(value) {
  const currency = String(value || "INR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    const error = new Error("Currency must be a 3-letter code.");
    error.status = 400;
    throw error;
  }
  return currency;
}

function normalizeReceipt(value, uid) {
  const fallback = `speakup_${uid}_${Date.now()}`;
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
}

function sendError(res, error, fallbackStatus = 500) {
  const status = error.status || error.statusCode || fallbackStatus;
  const razorpayError = error.error || null;
  const message = razorpayError?.description || error.message || "Request failed";

  if (status >= 500) {
    logger.error(error);
  }
  res.set(CORS_HEADERS).status(status).json({
    error: message,
    code: razorpayError?.code || undefined
  });
}

function toPlainData(data) {
  if (!data || typeof data !== "object") return data || null;
  return Object.fromEntries(Object.entries(data).map(([key, value]) => {
    if (value && typeof value.toDate === "function") {
      return [key, value.toDate().toISOString()];
    }
    if (Array.isArray(value)) {
      return [key, value.map((item) => toPlainData(item))];
    }
    if (value && typeof value === "object") {
      return [key, toPlainData(value)];
    }
    return [key, value];
  }));
}

function requireAdminPost(req, res) {
  if (handleOptions(req, res) || !requirePost(req, res)) return false;
  return true;
}

async function authenticateAdminRequest(req) {
  const decodedToken = await authenticateRequest(req);
  if (decodedToken.admin !== true) {
    const error = new Error("Admin access is required.");
    error.status = 403;
    throw error;
  }
  return decodedToken;
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase().slice(0, 120);
}

function matchesUserSearch(uid, profile, query) {
  if (!query) return true;
  return [
    uid,
    profile?.email,
    profile?.username
  ].some((value) => String(value || "").toLowerCase().includes(query));
}

function valueToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : null;
}

function getUserSummary(doc) {
  const profile = toPlainData(doc.data());
  const completedUnits = Array.isArray(profile?.completedUnits) ? profile.completedUnits : [];
  const openedUnits = Array.isArray(profile?.openedUnits) ? profile.openedUnits : [];
  const lastSeenAtMs = valueToMillis(profile?.lastSeenAt);
  const isOnline = Number.isFinite(lastSeenAtMs) && Date.now() - lastSeenAtMs <= 2 * 60 * 1000;

  return {
    uid: doc.id,
    username: profile?.username || "",
    email: profile?.email || "",
    fullUnlock: profile?.fullUnlock === true,
    licenseExpiresAt: profile?.licenseExpiresAt || null,
    trialExpiresAt: profile?.trialExpiresAt || null,
    lastOpenedUnit: profile?.lastOpenedUnit || null,
    lastSeenAt: profile?.lastSeenAt || null,
    activePath: profile?.activePath || null,
    activePage: profile?.activePage || null,
    isOnline,
    completedCount: completedUnits.length,
    openedCount: openedUnits.length,
    updatedAt: profile?.updatedAt || null,
    createdAt: profile?.createdAt || null
  };
}

async function getUserSummaryByUid(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? getUserSummary(snap) : null;
}

function addUniqueUserSummary(results, user) {
  if (!user || results.some((item) => item.uid === user.uid)) return;
  results.push(user);
}

function getProgressSummary(profile) {
  const completedUnits = Array.isArray(profile?.completedUnits) ? profile.completedUnits.map(String) : [];
  const openedUnits = Array.isArray(profile?.openedUnits) ? profile.openedUnits.map(String) : [];
  const completedSet = new Set(completedUnits);
  const inProgressUnits = openedUnits.filter((unitId) => !completedSet.has(unitId));

  return {
    completedUnits,
    openedUnits,
    inProgressUnits,
    lessonProgress: profile?.lessonProgress || {},
    lastOpenedUnit: profile?.lastOpenedUnit || null,
    lastScreenIndex: profile?.lastScreenIndex ?? null
  };
}

function normalizeTargetUid(value) {
  const uid = String(value || "").trim();
  if (!uid) {
    const error = new Error("targetUid is required.");
    error.status = 400;
    throw error;
  }
  return uid;
}

function normalizeReason(value) {
  const reason = String(value || "").trim();
  if (reason.length < 3) {
    const error = new Error("A reason is required before saving admin changes.");
    error.status = 400;
    throw error;
  }
  return reason.slice(0, 500);
}

function normalizeAccessAction(value) {
  const action = String(value || "").trim();
  const allowed = new Set(["grant", "revoke", "extend30", "extend90", "extend365", "setExpiry"]);
  if (!allowed.has(action)) {
    const error = new Error("Unsupported admin access action.");
    error.status = 400;
    throw error;
  }
  return action;
}

function getAccessAfter(action, before, expiresAtInput) {
  if (action === "revoke") {
    return {
      fullUnlock: false,
      licenseExpiresAt: null,
      trialExpiresAt: new Date(Date.now() - 1000).toISOString()
    };
  }

  if (action === "setExpiry") {
    const expiryMs = new Date(expiresAtInput || "").getTime();
    if (!Number.isFinite(expiryMs)) {
      const error = new Error("A valid expiresAt date is required.");
      error.status = 400;
      throw error;
    }
    return {
      fullUnlock: true,
      licenseExpiresAt: new Date(expiryMs).toISOString(),
      trialExpiresAt: null
    };
  }

  const daysByAction = {
    grant: 90,
    extend30: 30,
    extend90: 90,
    extend365: 365
  };
  const baseMs = Math.max(Date.now(), new Date(before?.licenseExpiresAt || 0).getTime() || 0);
  const expiresAt = new Date(baseMs + daysByAction[action] * 24 * 60 * 60 * 1000).toISOString();

  return {
    fullUnlock: true,
    licenseExpiresAt: expiresAt,
    trialExpiresAt: null
  };
}

exports.createOrder = onRequest({ secrets: [razorpayKeySecret] }, async (req, res) => {
  res.set(CORS_HEADERS);
  if (handleOptions(req, res) || !requirePost(req, res)) return;

  try {
    const decodedToken = await authenticateRequest(req);
    const email = getPaymentEmail(decodedToken);
    const amount   = PREMIUM_PRICE_PAISE;   // fixed server-side; client value ignored
    const currency = PREMIUM_CURRENCY;      // fixed server-side; client value ignored
    const receipt = normalizeReceipt(req.body?.receipt, decodedToken.uid);
    const plan = String(req.body?.plan || "premium").slice(0, 64);

    const order = await getRazorpayClient().orders.create({
      amount,
      currency,
      receipt,
      notes: {
        uid: decodedToken.uid,
        plan
      }
    });

    await db.collection("payments").doc(order.id).set({
      uid: decodedToken.uid,
      email,
      plan,
      amount,
      currency,
      razorpayOrderId: order.id,
      razorpayPaymentId: null,
      status: "created",
      receipt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedAt: null
    });

    res.json({
      order_id: order.id,
      id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    sendError(res, error);
  }
});

exports.verifyPayment = onRequest({ secrets: [razorpayKeySecret] }, async (req, res) => {
  res.set(CORS_HEADERS);
  if (handleOptions(req, res) || !requirePost(req, res)) return;

  try {
    const decodedToken = await authenticateRequest(req);
    const razorpayOrderId = req.body?.razorpay_order_id || req.body?.orderId;
    const razorpayPaymentId = req.body?.razorpay_payment_id;
    const razorpaySignature = req.body?.razorpay_signature;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      const error = new Error("Missing Razorpay payment verification fields.");
      error.status = 400;
      throw error;
    }

    const paymentRef = db.collection("payments").doc(String(razorpayOrderId));
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      const error = new Error("Payment order record was not found.");
      error.status = 400;
      throw error;
    }

    const payment = paymentSnap.data();
    if (payment.uid !== decodedToken.uid) {
      const error = new Error("Payment order does not belong to this user.");
      error.status = 403;
      throw error;
    }

    const { keySecret } = getRazorpayCredentials();
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      await paymentRef.update({
        email: getPaymentEmail(decodedToken, payment),
        razorpayPaymentId,
        status: "signature_mismatch",
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const error = new Error("Invalid Razorpay payment signature.");
      error.status = 400;
      throw error;
    }

    const batch = db.batch();
    const userRef = db.collection("users").doc(decodedToken.uid);
    const verifiedAt = admin.firestore.FieldValue.serverTimestamp();

    batch.set(userRef, {
      fullUnlock: true,
      licenseExpiresAt: new Date(Date.now() + PURCHASE_DURATION_MS).toISOString(),
      trialExpiresAt: null,
      updatedAt: verifiedAt
    }, { merge: true });

    batch.update(paymentRef, {
      email: getPaymentEmail(decodedToken, payment),
      razorpayPaymentId,
      status: "verified",
      verifiedAt
    });

    await batch.commit();

    res.json({
      success: true,
      status: "verified"
    });
  } catch (error) {
    sendError(res, error);
  }
});

exports.adminListUsers = onRequest(async (req, res) => {
  res.set(CORS_HEADERS);
  if (!requireAdminPost(req, res)) return;

  try {
    await authenticateAdminRequest(req);
    const query = normalizeSearch(req.body?.query);
    const limit = Math.max(1, Math.min(500, Number(req.body?.limit) || 200));
    const users = [];

    if (query) {
      addUniqueUserSummary(users, await getUserSummaryByUid(query));

      if (query.includes("@")) {
        try {
          const authUser = await admin.auth().getUserByEmail(query);
          addUniqueUserSummary(users, await getUserSummaryByUid(authUser.uid));
        } catch (error) {
          if (error.code !== "auth/user-not-found") throw error;
        }
      }
    }

    const snap = await db.collection("users").limit(query ? 500 : limit).get();
    snap.docs
      .filter((doc) => matchesUserSearch(doc.id, doc.data(), query))
      .map(getUserSummary)
      .forEach((user) => addUniqueUserSummary(users, user));

    res.json({ users });
  } catch (error) {
    sendError(res, error);
  }
});

exports.adminGetUser = onRequest(async (req, res) => {
  res.set(CORS_HEADERS);
  if (!requireAdminPost(req, res)) return;

  try {
    await authenticateAdminRequest(req);
    const targetUid = normalizeTargetUid(req.body?.targetUid);
    const snap = await db.collection("users").doc(targetUid).get();

    if (!snap.exists) {
      const error = new Error("User profile was not found.");
      error.status = 404;
      throw error;
    }

    const profile = toPlainData(snap.data());
    res.json({
      uid: targetUid,
      profile,
      progress: getProgressSummary(profile)
    });
  } catch (error) {
    sendError(res, error);
  }
});

exports.adminGetUserProgress = onRequest(async (req, res) => {
  res.set(CORS_HEADERS);
  if (!requireAdminPost(req, res)) return;

  try {
    await authenticateAdminRequest(req);
    const targetUid = normalizeTargetUid(req.body?.targetUid);
    const snap = await db.collection("users").doc(targetUid).get();

    if (!snap.exists) {
      const error = new Error("User profile was not found.");
      error.status = 404;
      throw error;
    }

    res.json({
      uid: targetUid,
      progress: getProgressSummary(toPlainData(snap.data()))
    });
  } catch (error) {
    sendError(res, error);
  }
});

exports.adminUpdateAccess = onRequest(async (req, res) => {
  res.set(CORS_HEADERS);
  if (!requireAdminPost(req, res)) return;

  try {
    const adminToken = await authenticateAdminRequest(req);
    const targetUid = normalizeTargetUid(req.body?.targetUid);
    const action = normalizeAccessAction(req.body?.action);
    const reason = normalizeReason(req.body?.reason);
    const userRef = db.collection("users").doc(targetUid);
    const beforeSnap = await userRef.get();

    if (!beforeSnap.exists) {
      const error = new Error("User profile was not found.");
      error.status = 404;
      throw error;
    }

    const beforeProfile = toPlainData(beforeSnap.data());
    const afterAccess = getAccessAfter(action, beforeProfile, req.body?.expiresAt);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const afterUpdate = {
      ...afterAccess,
      updatedAt: now
    };

    const auditRef = db.collection("adminAuditLogs").doc();
    const batch = db.batch();

    batch.set(userRef, afterUpdate, { merge: true });
    batch.set(auditRef, {
      adminUid: adminToken.uid,
      adminEmail: adminToken.email || null,
      targetUid,
      action,
      reason,
      before: {
        fullUnlock: beforeProfile.fullUnlock === true,
        licenseExpiresAt: beforeProfile.licenseExpiresAt || null,
        trialExpiresAt: beforeProfile.trialExpiresAt || null
      },
      after: afterAccess,
      createdAt: now
    });

    await batch.commit();

    const afterSnap = await userRef.get();
    res.json({
      success: true,
      uid: targetUid,
      profile: toPlainData(afterSnap.data())
    });
  } catch (error) {
    sendError(res, error);
  }
});

exports.adminResetDevice = onRequest(async (req, res) => {
  res.set(CORS_HEADERS);
  if (!requireAdminPost(req, res)) return;

  try {
    const adminToken = await authenticateAdminRequest(req);
    const targetUid = normalizeTargetUid(req.body?.targetUid);
    const reason = normalizeReason(req.body?.reason);
    const userRef = db.collection("users").doc(targetUid);
    const beforeSnap = await userRef.get();

    if (!beforeSnap.exists) {
      const error = new Error("User profile was not found.");
      error.status = 404;
      throw error;
    }

    const beforeProfile = toPlainData(beforeSnap.data());
    const now = admin.firestore.FieldValue.serverTimestamp();
    const auditRef = db.collection("adminAuditLogs").doc();
    const batch = db.batch();

    batch.set(userRef, {
      deviceId: null,
      updatedAt: now
    }, { merge: true });

    batch.set(auditRef, {
      adminUid: adminToken.uid,
      adminEmail: adminToken.email || null,
      targetUid,
      action: "resetDevice",
      reason,
      before: { deviceId: beforeProfile.deviceId || null },
      after: { deviceId: null },
      createdAt: now
    });

    await batch.commit();

    const afterSnap = await userRef.get();
    res.json({
      success: true,
      uid: targetUid,
      profile: toPlainData(afterSnap.data())
    });
  } catch (error) {
    sendError(res, error);
  }
});

exports.adminVerifyEmail = onRequest(async (req, res) => {
  res.set(CORS_HEADERS);
  if (!requireAdminPost(req, res)) return;

  try {
    const adminToken = await authenticateAdminRequest(req);
    const targetUid = normalizeTargetUid(req.body?.targetUid);
    const reason = normalizeReason(req.body?.reason);

    let beforeVerified = null;
    try {
      const beforeUser = await admin.auth().getUser(targetUid);
      beforeVerified = beforeUser.emailVerified === true;
    } catch (error) {
      const notFound = new Error("Auth user was not found.");
      notFound.status = 404;
      throw notFound;
    }

    await admin.auth().updateUser(targetUid, { emailVerified: true });

    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("adminAuditLogs").doc().set({
      adminUid: adminToken.uid,
      adminEmail: adminToken.email || null,
      targetUid,
      action: "verifyEmail",
      reason,
      before: { emailVerified: beforeVerified },
      after: { emailVerified: true },
      createdAt: now
    });

    res.json({ success: true, uid: targetUid, emailVerified: true });
  } catch (error) {
    sendError(res, error);
  }
});

exports.adminListPayments = onRequest(async (req, res) => {
  res.set(CORS_HEADERS);
  if (!requireAdminPost(req, res)) return;

  try {
    await authenticateAdminRequest(req);
    const limit = Math.max(1, Math.min(100, Number(req.body?.limit) || 50));
    const snap = await db.collection("payments")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const payments = snap.docs.map((doc) => ({
      id: doc.id,
      ...toPlainData(doc.data())
    }));

    res.json({ payments });
  } catch (error) {
    sendError(res, error);
  }
});

// Runs server-side after every new Firebase Auth user is created.
// Writes the 24-hour trial fields that the Firestore client-create rule blocks.
// Uses the Admin SDK (bypasses security rules). Never sets fullUnlock or licenseExpiresAt.
exports.initializeUserProfile = auth.user().onCreate(async (user) => {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();

  // Don't shorten or reset a trial that's already been recorded.
  if (snap.exists && snap.data().trialExpiresAt) {
    logger.info(`initializeUserProfile: trial already set for ${user.uid}, skipping`);
    return;
  }

  // Use the Auth event's own creationTime — not the client clock.
  const createdAtMs = new Date(user.metadata.creationTime).getTime();
  const trialStartedAt = new Date(createdAtMs).toISOString();
  const trialExpiresAt = new Date(createdAtMs + TRIAL_DURATION_MS).toISOString();

  await ref.set({
    trialStartedAt,
    trialExpiresAt,
    role: "user"
  }, { merge: true });

  logger.info(`initializeUserProfile: trial set for ${user.uid}, expires ${trialExpiresAt}`);
});
