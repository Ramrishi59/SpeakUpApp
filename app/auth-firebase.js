import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
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

let authState = {
  isLoggedIn: false,
  email: null,
  uid: null
};

let licenseState = {
  entitled: false,
  entitlements: [],
  licenseExpiresAt: null,
  approved: false,
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
      entitled: false,
      entitlements: [],
      licenseExpiresAt: null,
      approved: false,
      role: null
    };
    return null;
  }

  currentProfile = snap.data();

  const approved = currentProfile.approved === true;
  const expiresAt = currentProfile.licenseExpiresAt || null;

  let entitled = approved;
  if (expiresAt) {
    const exp = new Date(expiresAt).getTime();
    entitled = approved && Number.isFinite(exp) && exp > Date.now();
  }

  licenseState = {
    entitled,
    entitlements: Array.isArray(currentProfile.entitlements) ? currentProfile.entitlements : [],
    licenseExpiresAt: expiresAt,
    approved,
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
        entitled: false,
        entitlements: [],
        licenseExpiresAt: null,
        approved: false,
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
      entitled: false,
      entitlements: [],
      licenseExpiresAt: null,
      approved: false,
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

async function logout() {
  await signOut(auth);
}

function getAuthState() {
  return { ...authState };
}

function getLicense() {
  return { ...licenseState };
}

function isEntitled() {
  return !!licenseState.entitled;
}

// Optional admin helper methods for now.
// Keep them here only if you still need your old script.js not to break.
async function mockGrantFullUnlock() {
  if (!auth.currentUser) return;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await updateDoc(doc(db, "users", auth.currentUser.uid), {
    approved: true,
    entitlements: ["FULL_UNLOCK_V1"],
    licenseExpiresAt: expiresAt
  });
  await loadUserProfile(auth.currentUser.uid);
}

async function mockRevokeUnlock() {
  if (!auth.currentUser) return;
  await updateDoc(doc(db, "users", auth.currentUser.uid), {
    approved: false,
    entitlements: [],
    licenseExpiresAt: null
  });
  await loadUserProfile(auth.currentUser.uid);
}

window.SUAuth = {
  ready,
  loginWithEmail,
  signupWithEmail,
  logout,
  getAuth: getAuthState,
  getLicense,
  isEntitled,
  mockGrantFullUnlock,
  mockRevokeUnlock
};
