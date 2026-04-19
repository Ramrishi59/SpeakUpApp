import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  arrayUnion,
  getFirestore,
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
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const TRIAL_DURATION_MS = 5 * 60 * 1000;

let authState = {
  isLoggedIn: false,
  email: null,
  uid: null
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
    await setDoc(ref, buildMinimalUserProfile(profileInput));
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
      uid: user.uid
    };
    try {
      await loadUserProfile(user.uid);
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
    authState = {
      isLoggedIn: false,
      email: null,
      uid: null
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
});

async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  authState = {
    isLoggedIn: true,
    email: user.email || null,
    uid: user.uid
  };

  try {
    await loadUserProfile(user.uid);
  } catch (error) {
    console.warn("Login succeeded, but the user profile could not be loaded.", error);
  }
  return authState;
}

async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;

  authState = {
    isLoggedIn: true,
    email: user.email || null,
    uid: user.uid
  };

  let profileSynced = true;

  try {
    const existingProfile = await loadUserProfile(user.uid);

    if (!existingProfile) {
      const fallbackUsername = user.displayName || (user.email ? user.email.split("@")[0] : "Google User");

      await createUserProfile(user.uid, {
        username: fallbackUsername,
        email: user.email || ""
      });
      await loadUserProfile(user.uid);
    }
  } catch (error) {
    profileSynced = false;
    console.warn("Google login succeeded, but the user profile could not be loaded or saved.", error);
  }

  return { ...authState, profileSynced };
}

async function signupWithEmail(username, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  authState = {
    isLoggedIn: true,
    email: user.email || null,
    uid: user.uid
  };

  let profileSynced = true;

  try {
    await createUserProfile(user.uid, {
      username,
      email: user.email || email
    });
    await loadUserProfile(user.uid);
  } catch (error) {
    profileSynced = false;
    console.warn("Account was created, but the profile could not be saved to Firestore.", error);
  }

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
  return loadUserProfile(auth.currentUser.uid);
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

// Optional admin helper methods for now.
// Keep them here only if you still need your old script.js not to break.
async function mockGrantFullUnlock() {
  if (!auth.currentUser) return;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await updateDoc(doc(db, "users", auth.currentUser.uid), {
    fullUnlock: true,
    licenseExpiresAt: expiresAt
  });
  await loadUserProfile(auth.currentUser.uid);
}

async function mockRevokeUnlock() {
  if (!auth.currentUser) return;
  await updateDoc(doc(db, "users", auth.currentUser.uid), {
    fullUnlock: false,
    unlockedUnits: [],
    licenseExpiresAt: null,
    trialExpiresAt: null
  });
  await loadUserProfile(auth.currentUser.uid);
}

window.SUAuth = {
  ready,
  loginWithEmail,
  loginWithGoogle,
  signupWithEmail,
  saveProgress,
  markUnitCompleted,
  saveProfileAvatar,
  refreshProfile,
  getIdToken,
  logout,
  getAuth: getAuthState,
  getLicense,
  getProfile,
  getDebugState,
  isEntitled,
  mockGrantFullUnlock,
  mockRevokeUnlock
};
