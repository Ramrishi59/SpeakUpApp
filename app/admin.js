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

// ── State ──────────────────────────────────────────────────────────────────
let selectedUid = null;
let selectedUser = null;
let selectedProgress = null;
let loadedUsers = [];
let activeUserFilter = "all";

// ── Chart registry ─────────────────────────────────────────────────────────
const charts = {};

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

function initChartDefaults() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.font.family = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = "#718096";
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(36, 48, 71, 0.92)";
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.displayColors = false;
}

initChartDefaults();

// ── DOM refs ───────────────────────────────────────────────────────────────
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
  analyticsTab: document.getElementById("analyticsTab"),
  rawTab: document.getElementById("rawTab"),
  paymentsTab: document.getElementById("paymentsTab"),
  refreshPaymentsButton: document.getElementById("refreshPaymentsButton"),
  paymentStatus: document.getElementById("paymentStatus"),
  paymentsBody: document.getElementById("paymentsBody")
};

// ── Helpers ────────────────────────────────────────────────────────────────
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

function getExpiryBadge(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "";
  const daysLeft = Math.round((d.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0)   return `<span class="expiry-badge danger">Expired ${Math.abs(daysLeft)}d ago</span>`;
  if (daysLeft <= 7)  return `<span class="expiry-badge danger">Expires in ${daysLeft}d</span>`;
  if (daysLeft <= 30) return `<span class="expiry-badge warn">Expires in ${daysLeft}d</span>`;
  return `<span class="expiry-badge ok">Expires in ${daysLeft}d</span>`;
}

// Count-up animation for KPI numbers
function animateCount(el, target) {
  if (!el) return;
  const duration = 700;
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * target).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Auth helpers ───────────────────────────────────────────────────────────
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
  try { payload = await response.json(); } catch { payload = null; }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload || {};
}

// ── Stats Bar ──────────────────────────────────────────────────────────────
function updateStatsBar(users) {
  const now = Date.now();
  const DAY  = 86400000;
  const WEEK = 7 * DAY;

  const total  = users.length;
  const online = users.filter(u => u.isOnline).length;
  const today  = users.filter(u => {
    const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
    return t && (now - t) < DAY;
  }).length;
  const week   = users.filter(u => {
    const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
    return t && (now - t) < WEEK;
  }).length;

  animateCount(document.getElementById("statTotal"),  total);
  animateCount(document.getElementById("statOnline"), online);
  animateCount(document.getElementById("statToday"),  today);
  animateCount(document.getElementById("statWeek"),   week);
}

// ── Overview Charts ────────────────────────────────────────────────────────
function renderOverviewCharts(users) {
  if (typeof Chart === "undefined") return;

  const now   = Date.now();
  const DAY   = 86400000;
  const WEEK  = 7 * DAY;
  const MONTH = 30 * DAY;

  // User Status Doughnut
  const onlineCount  = users.filter(u => u.isOnline).length;
  const todayCount   = users.filter(u => {
    const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
    return !u.isOnline && t && (now - t) < DAY;
  }).length;
  const weekCount    = users.filter(u => {
    const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
    return !u.isOnline && t && (now - t) >= DAY && (now - t) < WEEK;
  }).length;
  const inactiveCount = Math.max(0, users.length - onlineCount - todayCount - weekCount);

  destroyChart("status");
  const statusCanvas = document.getElementById("statusChart");
  if (statusCanvas) {
    charts.status = new Chart(statusCanvas, {
      type: "doughnut",
      data: {
        labels: ["Online Now", "Active Today", "Active This Week", "Inactive"],
        datasets: [{
          data: [onlineCount, todayCount, weekCount, inactiveCount],
          backgroundColor: ["#059669", "#0ea5e9", "#8b5cf6", "#e2e8f0"],
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            display: true,
            position: "right",
            labels: { padding: 12, boxWidth: 10, font: { size: 12 } }
          },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} users` }
          }
        }
      }
    });
  }

  // Last Activity Bar Chart — bucket users by time since last seen
  const buckets = [0, 0, 0, 0, 0, 0];
  users.forEach(u => {
    const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
    if (!t) { buckets[5]++; return; }
    const diff = now - t;
    if (diff < 3600000)  { buckets[0]++; return; } // < 1h
    if (diff < DAY)      { buckets[1]++; return; } // 1h–24h
    if (diff < WEEK)     { buckets[2]++; return; } // 1d–7d
    if (diff < MONTH)    { buckets[3]++; return; } // 7d–30d
    buckets[4]++;                                   // 30d+
  });

  destroyChart("activity");
  const activityCanvas = document.getElementById("activityChart");
  if (activityCanvas) {
    charts.activity = new Chart(activityCanvas, {
      type: "bar",
      data: {
        labels: ["< 1h", "1–24h", "1–7d", "7–30d", "30d+", "Never"],
        datasets: [{
          data: buckets,
          backgroundColor: [
            "rgba(5,   150, 105, .75)",
            "rgba(14,  165, 233, .75)",
            "rgba(139,  92, 246, .75)",
            "rgba(217, 119,   6, .75)",
            "rgba(225,  29,  72, .75)",
            "rgba(148, 163, 184, .75)"
          ],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,.05)" },
            ticks: { stepSize: 1, color: "#718096", font: { size: 11 } }
          },
          x: {
            grid: { display: false },
            ticks: { color: "#718096", font: { size: 11 } }
          }
        }
      }
    });
  }
}

// ── Per-user Analytics Tab ─────────────────────────────────────────────────
function renderAnalyticsTab(progress) {
  const analyticsEmpty  = document.getElementById("analyticsEmpty");
  const analyticsCharts = document.getElementById("analyticsCharts");

  if (!progress) {
    analyticsEmpty?.classList.remove("hidden");
    analyticsCharts?.classList.add("hidden");
    return;
  }

  const lessonProgress  = progress.lessonProgress  || {};
  const completedUnits  = Array.isArray(progress.completedUnits)   ? progress.completedUnits   : [];
  const inProgressUnits = Array.isArray(progress.inProgressUnits)  ? progress.inProgressUnits  : [];
  const openedUnits     = Array.isArray(progress.openedUnits)      ? progress.openedUnits      : [];

  const hasData = Object.keys(lessonProgress).length > 0 || completedUnits.length > 0 || openedUnits.length > 0;

  if (!hasData) {
    analyticsEmpty?.classList.remove("hidden");
    analyticsCharts?.classList.add("hidden");
    return;
  }

  analyticsEmpty?.classList.add("hidden");
  analyticsCharts?.classList.remove("hidden");

  // Lesson Progress — horizontal bar chart
  const entries = Object.entries(lessonProgress);
  const lessonWrap   = document.getElementById("lessonChartWrap");
  const lessonCanvas = document.getElementById("lessonBarChart");

  destroyChart("lessonBar");

  if (lessonCanvas && entries.length > 0) {
    const chartHeight = Math.max(200, entries.length * 38 + 60);
    if (lessonWrap) lessonWrap.style.height = chartHeight + "px";

    const percents = entries.map(([, item]) => getLessonProgressPercent(item));
    const labels   = entries.map(([id])     => getReadableUnitName(id));
    const colors   = percents.map(p =>
      p >= 100 ? "rgba(5, 150, 105, .8)"
      : p > 0  ? "rgba(14, 165, 233, .8)"
               : "rgba(139, 92, 246, .5)"
    );

    charts.lessonBar = new Chart(lessonCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data: percents,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x}%` } }
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            grid: { color: "rgba(0,0,0,.05)" },
            ticks: { callback: v => v + "%", color: "#718096", font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: "#718096", font: { size: 11 } }
          }
        }
      }
    });
  } else if (lessonWrap) {
    lessonWrap.style.height = "80px";
    if (lessonCanvas) {
      const ctx = lessonCanvas.getContext("2d");
      ctx.clearRect(0, 0, lessonCanvas.width, lessonCanvas.height);
    }
  }

  // Unit Completion — doughnut
  const completed = completedUnits.length;
  const inProg    = inProgressUnits.length;
  const opened    = Math.max(0, openedUnits.length - completed - inProg);
  const total     = completed + inProg + opened;

  const donutCanvas = document.getElementById("unitDonutChart");
  const donutLegend = document.getElementById("unitDonutLegend");

  destroyChart("unitDonut");

  if (donutCanvas && total > 0) {
    charts.unitDonut = new Chart(donutCanvas, {
      type: "doughnut",
      data: {
        labels: ["Completed", "In Progress", "Opened"],
        datasets: [{
          data: [completed, inProg, opened],
          backgroundColor: ["#059669", "#0ea5e9", "#8b5cf6"],
          borderWidth: 2,
          borderColor: "#ffffff",
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} units` } }
        }
      }
    });
  }

  if (donutLegend) {
    const items = [
      { color: "#059669", label: "Completed",   count: completed },
      { color: "#0ea5e9", label: "In Progress",  count: inProg    },
      { color: "#8b5cf6", label: "Opened",       count: opened    }
    ];
    donutLegend.innerHTML = items.map(item => `
      <div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:${item.color}"></span>
        <span>${escapeHtml(item.label)}</span>
        <span class="muted" style="margin-left:auto;font-weight:700">${item.count}</span>
      </div>
    `).join("");
  }
}

// ── Revenue Chart ──────────────────────────────────────────────────────────
function renderRevenueChart(payments) {
  if (typeof Chart === "undefined") return;

  const box    = document.getElementById("revenueChartBox");
  const canvas = document.getElementById("revenueChart");
  if (!box || !canvas) return;

  const byDate = {};
  payments.forEach(p => {
    if (!p.verifiedAt) return;
    const d = new Date(p.verifiedAt);
    if (isNaN(d.getTime())) return;
    const key    = d.toISOString().slice(0, 10);
    const amount = (Number(p.amount) || 0) / 100;
    byDate[key]  = (byDate[key] || 0) + amount;
  });

  const sorted = Object.keys(byDate).sort();
  if (!sorted.length) { box.style.display = "none"; return; }

  box.style.display = "";

  const labels = sorted.map(k => {
    const d = new Date(k + "T00:00:00");
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  });
  const data = sorted.map(k => byDate[k]);

  destroyChart("revenue");
  charts.revenue = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: "rgba(249, 115, 22, .72)",
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.parsed.y.toFixed(2)}` } }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,.05)" },
          ticks: { callback: v => "₹" + v, color: "#718096", font: { size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: "#718096", font: { size: 11 } }
        }
      }
    }
  });
}

// ── View helpers ───────────────────────────────────────────────────────────
function setSignedInView(user) {
  const isSignedIn = !!user;
  els.loginPanel?.classList.toggle("hidden", isSignedIn);
  els.adminPanel?.classList.toggle("hidden", !isSignedIn);
  els.signOutButton?.classList.toggle("hidden", !isSignedIn);
  if (els.adminIdentity) {
    els.adminIdentity.textContent = user ? user.email || user.uid : "Not signed in";
  }
  if (!isSignedIn) {
    destroyChart("status");
    destroyChart("activity");
    destroyChart("lessonBar");
    destroyChart("unitDonut");
    destroyChart("revenue");
  }
}

function renderUserList(users) {
  if (!els.userList) return;
  const visibleUsers = activeUserFilter === "online"
    ? users.filter(u => u.isOnline === true)
    : users;

  if (!visibleUsers.length) {
    els.userList.innerHTML = `<p class="muted">No matching users found.</p>`;
    return;
  }

  els.userList.innerHTML = visibleUsers.map(user => `
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

  els.userList.querySelectorAll(".user-button").forEach(button => {
    button.addEventListener("click", () => loadUser(button.dataset.uid));
  });
}

function renderDetails(profile) {
  const completedUnits = Array.isArray(profile?.completedUnits) ? profile.completedUnits : [];
  const openedUnits    = Array.isArray(profile?.openedUnits)    ? profile.openedUnits    : [];
  const lessonProgress = profile?.lessonProgress || {};
  const isUnlocked     = profile?.fullUnlock === true;

  if (els.accessPill) {
    els.accessPill.textContent = isUnlocked ? "Full unlock active" : "Locked";
    els.accessPill.className   = `pill ${isUnlocked ? "ok" : "warn"}`;
  }

  els.userDetails.innerHTML = `
    <div class="detail"><span>UID</span><strong>${escapeHtml(selectedUid)}</strong></div>
    <div class="detail"><span>Email</span><strong>${escapeHtml(profile?.email || "Not set")}</strong></div>
    <div class="detail"><span>Username</span><strong>${escapeHtml(profile?.username || "Not set")}</strong></div>
    <div class="detail"><span>fullUnlock</span><strong>${String(isUnlocked)}</strong></div>
    <div class="detail"><span>licenseExpiresAt</span><strong>${escapeHtml(formatDate(profile?.licenseExpiresAt))}${getExpiryBadge(profile?.licenseExpiresAt)}</strong></div>
    <div class="detail"><span>trialExpiresAt</span><strong>${escapeHtml(formatDate(profile?.trialExpiresAt))}${getExpiryBadge(profile?.trialExpiresAt)}</strong></div>
    <div class="detail"><span>completedUnits</span><strong>${completedUnits.length}</strong></div>
    <div class="detail"><span>openedUnits</span><strong>${openedUnits.length}</strong></div>
    <div class="detail"><span>lessonProgress</span><strong>${Object.keys(lessonProgress).length} items</strong></div>
    <div class="detail"><span>lastOpenedUnit</span><strong>${escapeHtml(profile?.lastOpenedUnit || "Not set")}</strong></div>
  `;
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
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getLessonProgressPercent(item) {
  const explicitPercent = Number(item?.percent);
  if (Number.isFinite(explicitPercent)) {
    return Math.max(0, Math.min(100, Math.round(explicitPercent)));
  }

  const lastScreenIndex = Number(item?.lastScreenIndex);
  const totalScreens    = Number(item?.totalScreens);
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
        ${values.map(unitId => `
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
          const lastScreenIndex = Number.isFinite(Number(item?.lastScreenIndex)) ? Number(item.lastScreenIndex) : null;
          const totalScreens    = Number.isFinite(Number(item?.totalScreens))    ? Number(item.totalScreens)    : null;
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
                <span class="mini-progress-fill" style="--w: ${percent}%"></span>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderProgress(progress) {
  const completedUnits  = Array.isArray(progress?.completedUnits)   ? progress.completedUnits   : [];
  const openedUnits     = Array.isArray(progress?.openedUnits)      ? progress.openedUnits      : [];
  const inProgressUnits = Array.isArray(progress?.inProgressUnits)  ? progress.inProgressUnits  : [];
  const lessonProgress  = progress?.lessonProgress || {};

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

// ── Data loading ───────────────────────────────────────────────────────────
async function searchUsers() {
  setStatus(els.userSearchStatus, "Loading users...");
  try {
    const payload = await adminPost("/api/admin/list-users", {
      query: els.userSearch?.value || "",
      limit: 500
    });
    loadedUsers = payload.users || [];
    renderUserList(loadedUsers);
    const onlineCount = loadedUsers.filter(u => u.isOnline === true).length;
    setStatus(els.userSearchStatus, `${loadedUsers.length} user(s) loaded. ${onlineCount} active now.`, "success");
    updateStatsBar(loadedUsers);
    renderOverviewCharts(loadedUsers);
  } catch (error) {
    console.error(error);
    setStatus(els.userSearchStatus, error.message, "error");
  }
}

async function loadUser(uid) {
  selectedUid = uid;
  setStatus(els.accessStatus, "");

  try {
    const payload    = await adminPost("/api/admin/get-user", { targetUid: uid });
    selectedUser     = payload.profile  || {};
    selectedProgress = payload.progress || {};
    renderDetails(selectedUser);
    renderProgress(selectedProgress);
    renderRawProfile(selectedUser);
    // Re-render analytics if that tab is currently active
    if (!els.analyticsTab?.classList.contains("hidden")) {
      renderAnalyticsTab(selectedProgress);
    }
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

  const body = { targetUid: selectedUid, action, reason };

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
    selectedUser  = payload.profile || selectedUser;
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
    const payload  = await adminPost("/api/admin/list-payments", { limit: 50 });
    const payments = payload.payments || [];
    els.paymentsBody.innerHTML = payments.map(payment => `
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
    renderRevenueChart(payments);
  } catch (error) {
    console.error(error);
    setStatus(els.paymentStatus, error.message, "error");
  }
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  els.progressTab?.classList.toggle("hidden",   tabName !== "progress");
  els.analyticsTab?.classList.toggle("hidden",  tabName !== "analytics");
  els.rawTab?.classList.toggle("hidden",        tabName !== "raw");
  els.paymentsTab?.classList.toggle("hidden",   tabName !== "payments");

  if (tabName === "payments")  loadPayments();
  if (tabName === "analytics") renderAnalyticsTab(selectedProgress);
}

// ── Event listeners ────────────────────────────────────────────────────────
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
els.userSearch?.addEventListener("keydown", event => {
  if (event.key === "Enter") searchUsers();
});
els.refreshPaymentsButton?.addEventListener("click", loadPayments);

document.getElementById("toggleOverviewBtn")?.addEventListener("click", () => {
  const area = document.getElementById("overviewChartsArea");
  const btn  = document.getElementById("toggleOverviewBtn");
  if (!area || !btn) return;
  const isHidden = area.classList.toggle("hidden");
  btn.textContent = isHidden ? "Show charts" : "Hide charts";
});

document.querySelectorAll("[data-user-filter]").forEach(button => {
  button.addEventListener("click", () => {
    activeUserFilter = button.dataset.userFilter || "all";
    document.querySelectorAll("[data-user-filter]").forEach(fb => {
      fb.classList.toggle("active", fb === button);
    });
    renderUserList(loadedUsers);
  });
});

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => updateAccess(button.dataset.action));
});

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

// ── Auth state ─────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  setSignedInView(user);
  selectedUid      = null;
  selectedUser     = null;
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
