const crypto = require("crypto");

const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const Razorpay = require("razorpay");

admin.initializeApp();

const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const db = admin.firestore();
const PURCHASE_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

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

exports.createOrder = onRequest({ secrets: [razorpayKeySecret] }, async (req, res) => {
  res.set(CORS_HEADERS);
  if (handleOptions(req, res) || !requirePost(req, res)) return;

  try {
    const decodedToken = await authenticateRequest(req);
    const email = getPaymentEmail(decodedToken);
    const amount = normalizeAmount(req.body?.amount);
    const currency = normalizeCurrency(req.body?.currency);
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
