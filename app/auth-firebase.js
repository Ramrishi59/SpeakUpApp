import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  getIdTokenResult,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  arrayUnion,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB_xzbqAPsfMzbPDF9NldXnT-OqWXqd17U",
    authDomain: "speakup-19106.firebaseapp.com",
    projectId: "speakup-19106",
    storageBucket: "speakup-19106.firebasestorage.app",
    messagingSenderId: "899411455318",
    appId: "1:899411455318:web:8c202ae8fb363e5b53baf7"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let deviceBlocked = false;
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
} catch {
  // Browser does not support IndexedDB persistence — fall back to in-memory
  db = getFirestore(app);
}
const googleProvider = new GoogleAuthProvider();
const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;
const PRESENCE_HEARTBEAT_MS = 60 * 1000;

let authState = {
  isLoggedIn: false,
  email: null,
  uid: null,
  isAdmin: false
};

let licenseState = {
  fullUnlock: false,
  unlockedUnits: [],
  licenseExpiresAt: null,
  trialExpiresAt: null,
  trialActive: false,
  role: null
};

let currentProfile = null;
let resolveReady;
let readyResolved = false;
let presenceTimerId = null;

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function notifyAuthChanged() {
  window.dispatchEvent(new CustomEvent("su-auth-changed", {
    detail: {
      auth: getAuthState(),
      license: getLicense(),
      profile: getProfile()
    }
  }));
}

async function loadUserProfileWithRetry(uid, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await loadUserProfile(uid);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(350 * attempt);
      }
    }
  }

  throw lastError;
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : null;
}

function getTrialExpiryIso() {
  return new Date(Date.now() + TRIAL_DURATION_MS).toISOString();
}

function getAuthTrialExpiresAt(user = auth.currentUser) {
  const creationTime = user?.metadata?.creationTime;
  const createdAtMs = toMillis(creationTime);
  if (!Number.isFinite(createdAtMs)) return null;
  return new Date(createdAtMs + TRIAL_DURATION_MS).toISOString();
}

function getPresencePageLabel() {
  const path = window.location.pathname.split("/").pop() || "dashboard.html";
  if (path === "dashboard.html") return "Dashboard";
  if (path === "admin.html") return "Admin";
  return path.replace(/\.html$/i, "") || "App";
}

async function savePresence() {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    await updateDoc(doc(db, "users", user.uid), {
      lastSeenAt: serverTimestamp(),
      activePath: window.location.pathname + window.location.search,
      activePage: getPresencePageLabel()
    });
    return true;
  } catch (error) {
    console.warn("Could not update presence.", error);
    return false;
  }
}

function stopPresenceHeartbeat() {
  if (!presenceTimerId) return;
  window.clearInterval(presenceTimerId);
  presenceTimerId = null;
}

function startPresenceHeartbeat() {
  stopPresenceHeartbeat();
  savePresence();
  presenceTimerId = window.setInterval(savePresence, PRESENCE_HEARTBEAT_MS);
}

async function readAdminClaim(user, forceRefresh = false) {
  if (!user) return false;
  try {
    const tokenResult = await getIdTokenResult(user, forceRefresh);
    return tokenResult.claims?.admin === true;
  } catch (error) {
    console.warn("Could not read admin claim.", error);
    return false;
  }
}

function buildNewUserProfile({ username, email }) {
  return {
    username,
    email: email || "",
    role: "user",
    fullUnlock: false,
    unlockedUnits: [],
    licenseExpiresAt: null,
    trialStartedAt: new Date().toISOString(),
    trialExpiresAt: getTrialExpiryIso(),
    avatarName: "Manku",
    avatarSrc: "Images/dashboard thumbnails/Manku.webp",

    lastOpenedUnit: null,
    lastScreenIndex: 0,
    openedUnits: [],
    completedUnits: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function buildMinimalUserProfile({ username, email }) {
  return {
    username,
    email: email || "",
    avatarName: "Manku",
    avatarSrc: "Images/dashboard thumbnails/Manku.webp",
    lastOpenedUnit: null,
    lastScreenIndex: 0,
    openedUnits: [],
    completedUnits: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

async function createUserProfile(uid, profileInput) {
  const ref = doc(db, "users", uid);

  try {
    await setDoc(ref, buildNewUserProfile(profileInput));
  } catch (error) {
    console.warn("Full profile write failed; retrying with a minimal profile.", error);
    await setDoc(ref, buildMinimalUserProfile(profileInput), { merge: true });
  }
}

function renderDeviceBlockedMessage() {
  try {
    document.body.innerHTML = `
      <main style="min-height:100svh;display:grid;place-items:center;padding:24px;font-family:Fredoka,system-ui,sans-serif;background:#fff7ed;color:#312015;text-align:center;">
        <section style="width:min(440px,100%);background:#fff;border:2px solid #f4c18f;border-radius:18px;padding:28px;box-shadow:0 16px 40px rgba(92,52,18,.16);">
          <h1 style="margin:0 0 10px;font-size:clamp(26px,7vw,38px);">Already in use on another device</h1>
          <p style="margin:0 0 22px;font-size:17px;line-height:1.5;">This SpeakUp account is locked to one device. If you have changed or lost your phone, message us on WhatsApp and we will reset it for you.</p>
          <a href="https://wa.me/916282405919?text=Hi%2C%20I%20need%20to%20reset%20my%20SpeakUp%20device%20lock." style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:999px;background:#25D366;color:#fff;text-decoration:none;font-weight:700;">Message us on WhatsApp</a>
        </section>
      </main>
    `;
  } catch (error) {
    console.warn("Device lock: could not render block message.", error);
  }
}

async function enforceDeviceLock() {
  // Only paid, non-admin accounts are device-locked. Trial/free users and
  // admins (Ramu/Nandini) are never bound. Skip if profile failed to load.
  if (!currentProfile) return;
  if (isPaidUnlock() !== true) return;
  if (authState.isAdmin === true) return;

  const STORAGE_KEY = "su_device_id";
  let localId = null;
  try {
    localId = localStorage.getItem(STORAGE_KEY);
    if (!localId) {
      localId = (crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2));
      localStorage.setItem(STORAGE_KEY, localId);
    }
  } catch (error) {
    // localStorage unavailable (private mode edge case) — do not lock out.
    console.warn("Device lock: localStorage unavailable, skipping.", error);
    return;
  }

  const storedId = currentProfile.deviceId || null;

  if (!storedId) {
    // First paid device — bind it.
    try {
      await updateDoc(doc(db, "users", authState.uid), { deviceId: localId });
      currentProfile.deviceId = localId;
    } catch (error) {
      console.warn("Device lock: could not bind device.", error);
    }
    return;
  }

  if (storedId === localId) {
    // Correct device — allow.
    return;
  }

  // Mismatch — this paid account is bound to a different device. Block.
  deviceBlocked = true;
  renderDeviceBlockedMessage();
  try {
    await signOut(auth);
  } catch (error) {
    console.warn("Device lock: sign-out after block failed.", error);
  }
}

async function loadUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const authTrialExpiresAt = getAuthTrialExpiresAt();
    const trialActive = Number.isFinite(toMillis(authTrialExpiresAt)) && toMillis(authTrialExpiresAt) > Date.now();
    currentProfile = null;
    licenseState = {
      fullUnlock: trialActive,
      unlockedUnits: [],
      licenseExpiresAt: authTrialExpiresAt,
      trialExpiresAt: authTrialExpiresAt,
      trialActive,
      role: null
    };
    return null;
  }

  currentProfile = snap.data();
  const expiresAt = currentProfile.licenseExpiresAt || null;
  const expiresAtMs = toMillis(expiresAt);
  const hasValidExpiry = expiresAtMs == null || (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now());
  const authTrialExpiresAt = getAuthTrialExpiresAt();
  const trialExpiresAt = currentProfile.trialExpiresAt || authTrialExpiresAt || null;
  const trialExpiresAtMs = toMillis(trialExpiresAt);
  const trialActive = Number.isFinite(trialExpiresAtMs) && trialExpiresAtMs > Date.now();
  const paidUnlock = currentProfile.fullUnlock === true && expiresAtMs == null;
  const timedUnlock = currentProfile.fullUnlock === true && hasValidExpiry;

  licenseState = {
    fullUnlock: paidUnlock || timedUnlock || trialActive,
    unlockedUnits: [],
    licenseExpiresAt: expiresAt || trialExpiresAt,
    trialExpiresAt,
    trialActive,
    role: currentProfile.role || null
  };

  return currentProfile;
}

const ready = new Promise((resolve) => {
  resolveReady = resolve;
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authState = {
      isLoggedIn: true,
      email: user.email || null,
      uid: user.uid,
      // Use cached token claim here — no force-refresh. The token is already
      // current; forceRefresh is only needed at explicit login/signup where it
      // is already applied. Force-refreshing on every page load adds a network
      // round-trip that blocks dashboard rendering.
      isAdmin: await readAdminClaim(user)
    };
    try {
      await loadUserProfileWithRetry(user.uid);
      await enforceDeviceLock();
      startPresenceHeartbeat();
    } catch (error) {
      console.warn("Could not load user profile from Firestore.", error);
      currentProfile = null;
      licenseState = {
        fullUnlock: false,
        unlockedUnits: [],
        licenseExpiresAt: null,
        trialExpiresAt: null,
        trialActive: false,
        role: null
      };
    }
  } else {
    stopPresenceHeartbeat();
    // Note: do NOT reset deviceBlocked here — a block triggers signOut(),
    // which re-enters this handler with no user; we must keep the flag so the
    // dashboard can show the block message.
    authState = {
      isLoggedIn: false,
      email: null,
      uid: null,
      isAdmin: false
    };

    currentProfile = null;
    licenseState = {
      fullUnlock: false,
      unlockedUnits: [],
      licenseExpiresAt: null,
      trialExpiresAt: null,
      trialActive: false,
      role: null
    };
  }

  if (!readyResolved) {
    readyResolved = true;
    resolveReady();
  }

  notifyAuthChanged();
});

async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  authState = {
    isLoggedIn: true,
    email: user.email || null,
    uid: user.uid,
    isAdmin: await readAdminClaim(user, true)
  };

  try {
    await loadUserProfileWithRetry(user.uid);
  } catch (error) {
    console.warn("Login succeeded, but the user profile could not be loaded.", error);
  }
  notifyAuthChanged();
  return authState;
}

async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;

  authState = {
    isLoggedIn: true,
    email: user.email || null,
    uid: user.uid,
    isAdmin: await readAdminClaim(user, true)
  };

  let profileSynced = true;

  try {
    const existingProfile = await loadUserProfileWithRetry(user.uid);

    if (!existingProfile) {
      const fallbackUsername = user.displayName || (user.email ? user.email.split("@")[0] : "Google User");

      await createUserProfile(user.uid, {
        username: fallbackUsername,
        email: user.email || ""
      });
      await loadUserProfileWithRetry(user.uid);
    }
  } catch (error) {
    profileSynced = false;
    console.warn("Google login succeeded, but the user profile could not be loaded or saved.", error);
  }

  notifyAuthChanged();
  return { ...authState, profileSynced };
}

async function signupWithEmail(username, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  try {
    await sendEmailVerification(user);
  } catch (error) {
    console.warn("Could not send verification email.", error);
  }

  authState = {
    isLoggedIn: true,
    email: user.email || null,
    uid: user.uid,
    isAdmin: await readAdminClaim(user, true)
  };

  let profileSynced = true;

  try {
    await createUserProfile(user.uid, {
      username,
      email: user.email || email
    });
    await loadUserProfileWithRetry(user.uid);
  } catch (error) {
    profileSynced = false;
    console.warn("Account was created, but the profile could not be saved to Firestore.", error);
  }

  notifyAuthChanged();
  return { ...authState, profileSynced };
}

async function saveProgress(unitId, screenIndex, totalScreens) {
  const user = auth.currentUser;
  if (!user) return false;
  const normalizedUnitId = String(unitId);
  const normalizedScreenIndex = Math.max(0, Number(screenIndex) || 0);
  const normalizedTotalScreens = Math.max(0, Number(totalScreens) || 0);
  const lessonProgressUpdate = {
    [`lessonProgress.${normalizedUnitId}.lastScreenIndex`]: normalizedScreenIndex,
    [`lessonProgress.${normalizedUnitId}.updatedAt`]: serverTimestamp()
  };

  if (normalizedTotalScreens > 0) {
    lessonProgressUpdate[`lessonProgress.${normalizedUnitId}.totalScreens`] = normalizedTotalScreens;
  }

  await updateDoc(doc(db, "users", user.uid), {
    lastOpenedUnit: normalizedUnitId,
    lastScreenIndex: normalizedScreenIndex,
    openedUnits: arrayUnion(normalizedUnitId),
    ...lessonProgressUpdate,
    updatedAt: serverTimestamp()
  });

  if (currentProfile) {
    const existingOpened = Array.isArray(currentProfile.openedUnits) ? currentProfile.openedUnits.map(String) : [];
    const existingLessonProgress = currentProfile.lessonProgress || {};
    const existingUnitProgress = existingLessonProgress[normalizedUnitId] || {};
    currentProfile = {
      ...currentProfile,
      lastOpenedUnit: normalizedUnitId,
      lastScreenIndex: normalizedScreenIndex,
      openedUnits: existingOpened.includes(normalizedUnitId)
        ? existingOpened
        : [...existingOpened, normalizedUnitId],
      lessonProgress: {
        ...existingLessonProgress,
        [normalizedUnitId]: {
          ...existingUnitProgress,
          lastScreenIndex: normalizedScreenIndex,
          totalScreens: normalizedTotalScreens > 0
            ? normalizedTotalScreens
            : existingUnitProgress.totalScreens
        }
      }
    };
  }

  return true;
}

async function markUnitCompleted(unitId) {
  const user = auth.currentUser;
  if (!user || !unitId) return false;

  const normalizedUnitId = String(unitId);

  await updateDoc(doc(db, "users", user.uid), {
    completedUnits: arrayUnion(normalizedUnitId),
    updatedAt: serverTimestamp()
  });

  if (currentProfile) {
    const existingCompleted = Array.isArray(currentProfile.completedUnits) ? currentProfile.completedUnits.map(String) : [];
    currentProfile = {
      ...currentProfile,
      completedUnits: existingCompleted.includes(normalizedUnitId)
        ? existingCompleted
        : [...existingCompleted, normalizedUnitId]
    };
  }

  return true;
}

async function saveProfileAvatar(avatar) {
  const user = auth.currentUser;
  if (!user || !avatar?.src) return false;

  const avatarUpdate = {
    avatarName: String(avatar.name || ""),
    avatarSrc: String(avatar.src),
    updatedAt: serverTimestamp()
  };

  await updateDoc(doc(db, "users", user.uid), avatarUpdate);

  if (currentProfile) {
    currentProfile = {
      ...currentProfile,
      avatarName: avatarUpdate.avatarName,
      avatarSrc: avatarUpdate.avatarSrc
    };
  }

  return true;
}

async function logout() {
  await signOut(auth);
}

async function refreshProfile() {
  if (!auth.currentUser) return null;
  const profile = await loadUserProfileWithRetry(auth.currentUser.uid);
  notifyAuthChanged();
  return profile;
}

async function getIdToken() {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

function getAuthState() {
  return { ...authState };
}

function getLicense() {
  return { ...licenseState };
}

function getProfile() {
  return currentProfile ? { ...currentProfile } : null;
}

function getDebugState() {
  return {
    auth: getAuthState(),
    license: getLicense(),
    profile: getProfile(),
    authTrialExpiresAt: getAuthTrialExpiresAt()
  };
}

function isEntitled() {
  return !!licenseState.fullUnlock;
}

// Raw profile fullUnlock only — true for a stored purchase/admin grant,
// false during the automatic 24-hour trial (unlike getLicense().fullUnlock,
// which is a composite of paid/timed/trial access and is intentionally
// true during an active trial too).
function isPaidUnlock() {
  return currentProfile?.fullUnlock === true;
}

function isEmailVerified() {
  const user = auth.currentUser;
  if (!user) return false;
  return user.emailVerified === true;
}

async function resendVerificationEmail() {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in first.");
  await sendEmailVerification(user);
  return true;
}

function getDeviceBlocked() {
  return deviceBlocked === true;
}

window.SUAuth = {
  ready,
  loginWithEmail,
  loginWithGoogle,
  signupWithEmail,
  saveProgress,
  markUnitCompleted,
  saveProfileAvatar,
  savePresence,
  refreshProfile,
  getIdToken,
  logout,
  getAuth: getAuthState,
  getLicense,
  getProfile,
  getDebugState,
  isEntitled,
  isPaidUnlock,
  getDeviceBlocked,
  isEmailVerified,
  resendVerificationEmail
};
