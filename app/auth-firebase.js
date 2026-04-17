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

let authState = {
  isLoggedIn: false,
  email: null,
  uid: null
};

let licenseState = {
  fullUnlock: false,
  unlockedUnits: [],
  licenseExpiresAt: null,
  role: null
};

let currentProfile = null;
let resolveReady;
let readyResolved = false;

async function loadUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    currentProfile = null;
    licenseState = {
      fullUnlock: false,
      unlockedUnits: [],
      licenseExpiresAt: null,
      role: null
    };
    return null;
  }

  currentProfile = snap.data();
  const expiresAt = currentProfile.licenseExpiresAt || null;
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : null;
  const hasValidExpiry = expiresAtMs == null || (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now());

  licenseState = {
    fullUnlock: currentProfile.fullUnlock === true && hasValidExpiry,
    unlockedUnits: Array.isArray(currentProfile.unlockedUnits) ? currentProfile.unlockedUnits.map(String) : [],
    licenseExpiresAt: expiresAt,
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

      await setDoc(doc(db, "users", user.uid), {
        username: fallbackUsername,
        email: user.email || "",
        role: "user",
        fullUnlock: false,
        unlockedUnits: ["unit1", "unit2"],
        licenseExpiresAt: null,

        lastOpenedUnit: null,
        lastScreenIndex: 0,
        completedUnits: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
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
    await setDoc(doc(db, "users", user.uid), {
      username,
      email: user.email || email,
      role: "user",
      fullUnlock: false,
      unlockedUnits: ["unit1", "unit2"],
      licenseExpiresAt: null,

      lastOpenedUnit: null,
      lastScreenIndex: 0,
      completedUnits: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await loadUserProfile(user.uid);
  } catch (error) {
    profileSynced = false;
    console.warn("Account was created, but the profile could not be saved to Firestore.", error);
  }

  return { ...authState, profileSynced };
}

async function saveProgress(unitId, screenIndex) {
  const user = auth.currentUser;
  if (!user) return false;

  await updateDoc(doc(db, "users", user.uid), {
    lastOpenedUnit: String(unitId),
    lastScreenIndex: Number(screenIndex) || 0,
    updatedAt: serverTimestamp()
  });

  if (currentProfile) {
    currentProfile = {
      ...currentProfile,
      lastOpenedUnit: String(unitId),
      lastScreenIndex: Number(screenIndex) || 0
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

async function logout() {
  await signOut(auth);
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
    licenseExpiresAt: null
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
  logout,
  getAuth: getAuthState,
  getLicense,
  getProfile,
  isEntitled,
  mockGrantFullUnlock,
  mockRevokeUnlock
};
