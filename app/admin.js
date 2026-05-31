import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

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
const googleProvider = new GoogleAuthProvider();

let selectedUid = null;
let selectedUser = null;
let selectedProgress = null;
let loadedUsers = [];
let activeUserFilter = "all";

const els = {
  adminIdentity: document.getElementById("adminIdentity"),
  signOutButton: document.getElementById("signOutButton"),
  loginPanel: document.getElementById("loginPanel"),
  adminPanel: document.getElementById("adminPanel"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  emailLoginButton: document.getElementById("emailLoginButton"),
  googleLoginButton: document.getElementById("googleLoginButton"),
  loginStatus: document.getElementById("loginStatus"),
  userSearch: document.getElementById("userSearch"),
  searchUsersButton: document.getElementById("searchUsersButton"),
  refreshUsersButton: document.getElementById("refreshUsersButton"),
  userSearchStatus: document.getElementById("userSearchStatus"),
  userList: document.getElementById("userList"),
  accessPill: document.getElementById("accessPill"),
  userDetails: document.getElementById("userDetails"),
  accessReason: document.getElementById("accessReason"),
  customExpiry: document.getElementById("customExpiry"),
  accessStatus: document.getElementById("accessStatus"),
  progressTab: document.getElementById("progressTab"),
  rawTab: document.getElementById("rawTab"),
  paymentsTab: document.getElementById("paymentsTab"),
  refreshPaymentsButton: document.getElementById("refreshPaymentsButton"),
  paymentStatus: document.getElementById("paymentStatus"),
  paymentsBody: document.getElementById("paymentsBody")
};

function setStatus(node, text, state = "") {
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatRelativeTime(value) {
  if (!value) return "Never seen";
  const date = new Date(value);
  const millis = date.getTime();
  if (!Number.isFinite(millis)) return String(value);

  const diffSeconds = Math.max(0, Math.round((Date.now() - millis) / 1000));
  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatAmount(amount, currency) {
  const majorAmount = (Number(amount) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "INR"
    }).format(majorAmount);
  } catch {
    return `${currency || "INR"} ${majorAmount.toFixed(2)}`;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getFreshToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in first.");
  return user.getIdToken(true);
}

async function adminPost(path, body = {}) {
  const token = await getFreshToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }

  return payload || {};
}

function setSignedInView(user) {
  const isSignedIn = !!user;
  els.loginPanel?.classList.toggle("hidden", isSignedIn);
  els.adminPanel?.classList.toggle("hidden", !isSignedIn);
  els.signOutButton?.classList.toggle("hidden", !isSignedIn);
  if (els.adminIdentity) {
    els.adminIdentity.textContent = user ? user.email || user.uid : "Not signed in";
  }
}

function renderUserList(users) {
  if (!els.userList) return;
  const visibleUsers = activeUserFilter === "online"
    ? users.filter((user) => user.isOnline === true)
    : users;

  if (!visibleUsers.length) {
    els.userList.innerHTML = `<p class="muted">No matching users found.</p>`;
    return;
  }

  els.userList.innerHTML = visibleUsers.map((user) => `
    <button type="button" class="user-button ${user.uid === selectedUid ? "active" : ""}" data-uid="${escapeHtml(user.uid)}">
      <span class="user-topline">
        <strong>${escapeHtml(user.username || "Unnamed user")}</strong>
        <span class="online-dot ${user.isOnline ? "is-online" : ""}">${user.isOnline ? "Online" : "Away"}</span>
      </span>
      <span class="muted user-meta-line">${escapeHtml(user.email || "No email")}</span>
      <span class="muted user-meta-line">${escapeHtml(user.activePage || "Last seen")} · ${escapeHtml(formatRelativeTime(user.lastSeenAt))}</span>
      <small>${escapeHtml(user.uid)}</small>
    </button>
  `).join("");

  els.userList.querySelectorAll(".user-button").forEach((button) => {
    button.addEventListener("click", () => loadUser(button.dataset.uid));
  });
}

function renderDetails(profile) {
  const completedUnits = Array.isArray(profile?.completedUnits) ? profile.completedUnits : [];
  const openedUnits = Array.isArray(profile?.openedUnits) ? profile.openedUnits : [];
  const lessonProgress = profile?.lessonProgress || {};
  const isUnlocked = profile?.fullUnlock === true;

  if (els.accessPill) {
    els.accessPill.textContent = isUnlocked ? "Full unlock active" : "Locked";
    els.accessPill.className = `pill ${isUnlocked ? "ok" : "warn"}`;
  }

  els.userDetails.innerHTML = `
    <div class="detail"><span>UID</span><strong>${escapeHtml(selectedUid)}</strong></div>
    <div class="detail"><span>Email</span><strong>${escapeHtml(profile?.email || "Not set")}</strong></div>
    <div class="detail"><span>Username</span><strong>${escapeHtml(profile?.username || "Not set")}</strong></div>
    <div class="detail"><span>fullUnlock</span><strong>${String(isUnlocked)}</strong></div>
    <div class="detail"><span>licenseExpiresAt</span><strong>${escapeHtml(formatDate(profile?.licenseExpiresAt))}</strong></div>
    <div class="detail"><span>trialExpiresAt</span><strong>${escapeHtml(formatDate(profile?.trialExpiresAt))}</strong></div>
    <div class="detail"><span>completedUnits</span><strong>${completedUnits.length}</strong></div>
    <div class="detail"><span>openedUnits</span><strong>${openedUnits.length}</strong></div>
    <div class="detail"><span>lessonProgress</span><strong>${Object.keys(lessonProgress).length} items</strong></div>
    <div class="detail"><span>lastOpenedUnit</span><strong>${escapeHtml(profile?.lastOpenedUnit || "Not set")}</strong></div>
  `;
}

function renderProgress(progress) {
  const completedUnits = Array.isArray(progress?.completedUnits) ? progress.completedUnits : [];
  const openedUnits = Array.isArray(progress?.openedUnits) ? progress.openedUnits : [];
  const inProgressUnits = Array.isArray(progress?.inProgressUnits) ? progress.inProgressUnits : [];
  const lessonProgress = progress?.lessonProgress || {};

  els.progressTab.innerHTML = `
    <div class="details">
      <div class="detail"><span>Completed units</span><strong>${completedUnits.length}</strong></div>
      <div class="detail"><span>Opened units</span><strong>${openedUnits.length}</strong></div>
      <div class="detail"><span>In-progress units</span><strong>${inProgressUnits.length}</strong></div>
      <div class="detail"><span>Last opened</span><strong>${escapeHtml(progress?.lastOpenedUnit || "Not set")}</strong></div>
    </div>
    ${renderUnitList("Completed Units", completedUnits, "completed")}
    ${renderUnitList("In-progress Units", inProgressUnits, "progress")}
    ${renderLessonProgressCards(lessonProgress)}
  `;
}

function renderRawProfile(profile) {
  els.rawTab.textContent = JSON.stringify(profile || {}, null, 2);
}

function getReadableUnitName(unitId) {
  const value = String(unitId || "").trim();
  if (!value) return "Unknown lesson";
  return value
    .replace(/^order-activity/i, "Sentence Activity ")
    .replace(/^order-/i, "Sentence Activity ")
    .replace(/^activity/i, "Quiz Activity ")
    .replace(/^unit/i, "Unit ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLessonProgressPercent(item) {
  const explicitPercent = Number(item?.percent);
  if (Number.isFinite(explicitPercent)) {
    return Math.max(0, Math.min(100, Math.round(explicitPercent)));
  }

  const lastScreenIndex = Number(item?.lastScreenIndex);
  const totalScreens = Number(item?.totalScreens);
  if (!Number.isFinite(lastScreenIndex) || !Number.isFinite(totalScreens) || totalScreens <= 1) {
    return 0;
  }

  return Math.max(0, Math.min(99, Math.round((lastScreenIndex / (totalScreens - 1)) * 100)));
}

function renderUnitList(title, values, stateClass) {
  if (!values.length) {
    return `
      <section class="progress-section">
        <h3>${escapeHtml(title)} <span class="progress-count">0</span></h3>
        <p class="empty-state">No ${escapeHtml(title.toLowerCase())} saved for this user yet.</p>
      </section>
    `;
  }

  return `
    <section class="progress-section">
      <h3>${escapeHtml(title)} <span class="progress-count">${values.length}</span></h3>
      <div class="unit-chip-list">
        ${values.map((unitId) => `
          <span class="unit-chip ${stateClass}" title="${escapeHtml(unitId)}">${escapeHtml(getReadableUnitName(unitId))}</span>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLessonProgressCards(lessonProgress) {
  const entries = Object.entries(lessonProgress || {});
  if (!entries.length) {
    return `
      <section class="progress-section">
        <h3>Lesson Progress <span class="progress-count">0</span></h3>
        <p class="empty-state">No lesson progress saved for this user yet.</p>
      </section>
    `;
  }

  return `
    <section class="progress-section">
      <h3>Lesson Progress <span class="progress-count">${entries.length}</span></h3>
      <div class="lesson-progress-list">
        ${entries.map(([unitId, item]) => {
          const percent = getLessonProgressPercent(item);
          const lastScreenIndex = Number.isFinite(Number(item?.lastScreenIndex))
            ? Number(item.lastScreenIndex)
            : null;
          const totalScreens = Number.isFinite(Number(item?.totalScreens))
            ? Number(item.totalScreens)
            : null;
          const screenText = totalScreens
            ? `Screen ${lastScreenIndex === null ? 1 : lastScreenIndex + 1} of ${totalScreens}`
            : "Started";

          return `
            <article class="lesson-progress-card">
              <div class="lesson-progress-card-top">
                <div>
                  <div class="lesson-progress-name">${escapeHtml(getReadableUnitName(unitId))}</div>
                  <div class="lesson-progress-meta">${escapeHtml(screenText)}</div>
                </div>
                <span class="pill">${percent}%</span>
              </div>
              <div class="mini-progress-track" aria-label="${escapeHtml(getReadableUnitName(unitId))} progress ${percent}%">
                <span class="mini-progress-fill" style="width: ${percent}%"></span>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

async function searchUsers() {
  setStatus(els.userSearchStatus, "Loading users...");
  try {
    const payload = await adminPost("/api/admin/list-users", {
      query: els.userSearch?.value || "",
      limit: 500
    });
    loadedUsers = payload.users || [];
    renderUserList(loadedUsers);
    const onlineCount = loadedUsers.filter((user) => user.isOnline === true).length;
    setStatus(els.userSearchStatus, `${loadedUsers.length} user(s) loaded. ${onlineCount} active now.`, "success");
  } catch (error) {
    console.error(error);
    setStatus(els.userSearchStatus, error.message, "error");
  }
}

async function loadUser(uid) {
  selectedUid = uid;
  setStatus(els.accessStatus, "");

  try {
    const payload = await adminPost("/api/admin/get-user", { targetUid: uid });
    selectedUser = payload.profile || {};
    selectedProgress = payload.progress || {};
    renderDetails(selectedUser);
    renderProgress(selectedProgress);
    renderRawProfile(selectedUser);
    searchUsers();
  } catch (error) {
    console.error(error);
    setStatus(els.accessStatus, error.message, "error");
  }
}

async function updateAccess(action) {
  if (!selectedUid) {
    setStatus(els.accessStatus, "Select a user first.", "error");
    return;
  }

  const reason = els.accessReason?.value?.trim() || "";
  if (reason.length < 3) {
    setStatus(els.accessStatus, "Enter a reason before saving changes.", "error");
    return;
  }

  const body = {
    targetUid: selectedUid,
    action,
    reason
  };

  if (action === "setExpiry") {
    if (!els.customExpiry?.value) {
      setStatus(els.accessStatus, "Choose a custom expiry date.", "error");
      return;
    }
    body.expiresAt = new Date(`${els.customExpiry.value}T23:59:59`).toISOString();
  }

  setStatus(els.accessStatus, "Saving access change...");
  try {
    const payload = await adminPost("/api/admin/update-access", body);
    selectedUser = payload.profile || selectedUser;
    renderDetails(selectedUser);
    renderRawProfile(selectedUser);
    await loadUser(selectedUid);
    els.accessReason.value = "";
    setStatus(els.accessStatus, "Access updated and audit log created.", "success");
  } catch (error) {
    console.error(error);
    setStatus(els.accessStatus, error.message, "error");
  }
}

async function loadPayments() {
  setStatus(els.paymentStatus, "Loading payments...");
  try {
    const payload = await adminPost("/api/admin/list-payments", { limit: 50 });
    const payments = payload.payments || [];
    els.paymentsBody.innerHTML = payments.map((payment) => `
      <tr>
        <td>
          <strong>${escapeHtml(payment.email || "No email")}</strong><br>
          <small>${escapeHtml(payment.uid || "")}</small>
        </td>
        <td>${escapeHtml(formatAmount(payment.amount, payment.currency))}<br><small>${escapeHtml(payment.currency || "")}</small></td>
        <td>${escapeHtml(payment.status || "unknown")}</td>
        <td>
          <small>Order: ${escapeHtml(payment.razorpayOrderId || payment.id || "")}</small><br>
          <small>Payment: ${escapeHtml(payment.razorpayPaymentId || "Not set")}</small>
        </td>
        <td>${escapeHtml(formatDate(payment.verifiedAt))}</td>
      </tr>
    `).join("");
    setStatus(els.paymentStatus, `${payments.length} payment(s) loaded.`, "success");
  } catch (error) {
    console.error(error);
    setStatus(els.paymentStatus, error.message, "error");
  }
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  els.progressTab.classList.toggle("hidden", tabName !== "progress");
  els.rawTab.classList.toggle("hidden", tabName !== "raw");
  els.paymentsTab.classList.toggle("hidden", tabName !== "payments");
  if (tabName === "payments") loadPayments();
}

els.emailLoginButton?.addEventListener("click", async () => {
  setStatus(els.loginStatus, "Signing in...");
  try {
    await signInWithEmailAndPassword(auth, els.loginEmail.value.trim(), els.loginPassword.value);
    setStatus(els.loginStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(els.loginStatus, error.message, "error");
  }
});

els.googleLoginButton?.addEventListener("click", async () => {
  setStatus(els.loginStatus, "Opening Google sign in...");
  try {
    await signInWithPopup(auth, googleProvider);
    setStatus(els.loginStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(els.loginStatus, error.message, "error");
  }
});

els.signOutButton?.addEventListener("click", () => signOut(auth));
els.searchUsersButton?.addEventListener("click", searchUsers);
els.refreshUsersButton?.addEventListener("click", searchUsers);
els.userSearch?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchUsers();
});
els.refreshPaymentsButton?.addEventListener("click", loadPayments);

document.querySelectorAll("[data-user-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeUserFilter = button.dataset.userFilter || "all";
    document.querySelectorAll("[data-user-filter]").forEach((filterButton) => {
      filterButton.classList.toggle("active", filterButton === button);
    });
    renderUserList(loadedUsers);
  });
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => updateAccess(button.dataset.action));
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

onAuthStateChanged(auth, async (user) => {
  setSignedInView(user);
  selectedUid = null;
  selectedUser = null;
  selectedProgress = null;
  if (!user) return;

  try {
    await getFreshToken();
    await searchUsers();
  } catch (error) {
    console.error(error);
    setStatus(els.userSearchStatus, error.message, "error");
  }
});
