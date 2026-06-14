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
let selectedUid       = null;
let selectedUser      = null;
let selectedProgress  = null;
let selectedListUser  = null;   // the matching row from loadedUsers (has lastSeenAt etc.)
let loadedUsers       = [];
let activeUserFilter  = "all";
let alertFilterUids   = null;   // null = no filter, Set<uid> = show only these
let selectedDuration  = null;   // "30" | "90" | "365" | "permanent"

// ── Chart registry ─────────────────────────────────────────────────────────
const charts = {};

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function initChartDefaults() {
  if (typeof Chart === "undefined") return;
  Chart.defaults.font.family = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  Chart.defaults.font.size   = 12;
  Chart.defaults.color       = "#718096";
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(36,48,71,0.92)";
  Chart.defaults.plugins.tooltip.padding         = 10;
  Chart.defaults.plugins.tooltip.cornerRadius    = 8;
  Chart.defaults.plugins.tooltip.displayColors   = false;
}

initChartDefaults();

// ── DOM refs ───────────────────────────────────────────────────────────────
const els = {
  adminIdentity:        document.getElementById("adminIdentity"),
  signOutButton:        document.getElementById("signOutButton"),
  loginPanel:           document.getElementById("loginPanel"),
  adminPanel:           document.getElementById("adminPanel"),
  loginEmail:           document.getElementById("loginEmail"),
  loginPassword:        document.getElementById("loginPassword"),
  emailLoginButton:     document.getElementById("emailLoginButton"),
  googleLoginButton:    document.getElementById("googleLoginButton"),
  loginStatus:          document.getElementById("loginStatus"),
  userSearch:           document.getElementById("userSearch"),
  searchUsersButton:    document.getElementById("searchUsersButton"),
  refreshUsersButton:   document.getElementById("refreshUsersButton"),
  userSearchStatus:     document.getElementById("userSearchStatus"),
  userList:             document.getElementById("userList"),
  userCard:             document.getElementById("userCard"),
  accessReasonSelect:   document.getElementById("accessReasonSelect"),
  customExpiry:         document.getElementById("customExpiry"),
  accessStatus:         document.getElementById("accessStatus"),
  progressTab:          document.getElementById("progressTab"),
  analyticsTab:         document.getElementById("analyticsTab"),
  rawTab:               document.getElementById("rawTab"),
  paymentsTab:          document.getElementById("paymentsTab"),
  refreshPaymentsButton:document.getElementById("refreshPaymentsButton"),
  paymentStatus:        document.getElementById("paymentStatus"),
  paymentsBody:         document.getElementById("paymentsBody")
};

// ── Generic helpers ────────────────────────────────────────────────────────
function setStatus(node, text, state = "") {
  if (!node) return;
  node.textContent  = text;
  node.dataset.state = state;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Not set";
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function formatRelativeTime(value) {
  if (!value) return "Never seen";
  const millis = new Date(value).getTime();
  if (!Number.isFinite(millis)) return String(value);
  const s = Math.max(0, Math.round((Date.now() - millis) / 1000));
  if (s < 10)  return "just now";
  if (s < 60)  return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function formatAmount(amount, currency) {
  const v = (Number(amount) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "INR" }).format(v);
  } catch {
    return `${currency || "INR"} ${v.toFixed(2)}`;
  }
}

function animateCount(el, target) {
  if (!el) return;
  const duration = 700;
  const start    = performance.now();
  function tick(now) {
    const p     = Math.min(1, (now - start) / duration);
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
  const token    = await getFreshToken();
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* empty */ }
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload || {};
}

// ── Access status helper ───────────────────────────────────────────────────
function getAccessStatus(profile) {
  const now      = Date.now();
  const licExp   = profile?.licenseExpiresAt ? new Date(profile.licenseExpiresAt).getTime() : null;
  const triExp   = profile?.trialExpiresAt   ? new Date(profile.trialExpiresAt).getTime()   : null;
  const unlocked = profile?.fullUnlock === true;

  if (unlocked && (!licExp || licExp > now)) {
    const days = licExp ? Math.round((licExp - now) / 86400000) : null;
    return {
      cls:    "full",
      label:  "Full Access",
      icon:   "✓",
      expiry: days ? `Subscription active — expires in ${days} day${days !== 1 ? "s" : ""}` : "Permanent access — never expires"
    };
  }
  if (unlocked && licExp && licExp < now) {
    return {
      cls:    "expired",
      label:  "Access Expired",
      icon:   "✗",
      expiry: `Expired ${Math.round((now - licExp) / 86400000)} days ago — needs renewal`
    };
  }
  if (triExp && triExp > now) {
    const days = Math.round((triExp - now) / 86400000);
    return {
      cls:    "trial",
      label:  "Free Trial",
      icon:   "◷",
      expiry: `Trial ends in ${days} day${days !== 1 ? "s" : ""}`
    };
  }
  if (triExp && triExp < now) {
    return {
      cls:    "expired",
      label:  "Trial Ended",
      icon:   "✗",
      expiry: `Trial ended ${Math.round((now - triExp) / 86400000)} days ago`
    };
  }
  return { cls: "none", label: "No Access", icon: "—", expiry: "Not subscribed" };
}

// ── User Card ──────────────────────────────────────────────────────────────
function getReadableUnitName(unitId) {
  return String(unitId || "").trim()
    .replace(/^order-activity/i, "Sentence Activity ")
    .replace(/^order-/i,         "Sentence Activity ")
    .replace(/^activity/i,       "Quiz Activity ")
    .replace(/^unit/i,           "Unit ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase()) || "Unknown lesson";
}

function getLessonProgressPercent(item) {
  const ep = Number(item?.percent);
  if (Number.isFinite(ep)) return Math.max(0, Math.min(100, Math.round(ep)));
  const idx   = Number(item?.lastScreenIndex);
  const total = Number(item?.totalScreens);
  if (!Number.isFinite(idx) || !Number.isFinite(total) || total <= 1) return 0;
  return Math.max(0, Math.min(99, Math.round((idx / (total - 1)) * 100)));
}

function renderUserCard(profile) {
  if (!els.userCard) return;

  if (!profile || !selectedUid) {
    els.userCard.innerHTML = `<p class="empty-state">Select a user from the list to view their profile.</p>`;
    return;
  }

  const status        = getAccessStatus(profile);
  const completedUnits  = Array.isArray(profile.completedUnits)  ? profile.completedUnits  : [];
  const openedUnits     = Array.isArray(profile.openedUnits)     ? profile.openedUnits     : [];
  const inProgressUnits = Array.isArray(profile.inProgressUnits) ? profile.inProgressUnits : [];
  const lessonCount     = Object.keys(profile.lessonProgress || {}).length;

  const touched = completedUnits.length + inProgressUnits.length
    + Math.max(0, openedUnits.length - completedUnits.length - inProgressUnits.length);
  const pct     = touched > 0 ? Math.round((completedUnits.length / touched) * 100) : 0;

  const lastSeen    = selectedListUser?.lastSeenAt   || profile.lastSeenAt;
  const activePage  = selectedListUser?.activePage   || profile.activePage;
  const lastUnit    = profile.lastOpenedUnit ? getReadableUnitName(profile.lastOpenedUnit) : null;

  const progressLine = [
    completedUnits.length  ? `${completedUnits.length} unit${completedUnits.length !== 1 ? "s" : ""} completed` : null,
    inProgressUnits.length ? `${inProgressUnits.length} in progress` : null,
    lessonCount            ? `${lessonCount} lesson${lessonCount !== 1 ? "s" : ""} started` : null
  ].filter(Boolean).join(" · ") || "No progress yet";

  els.userCard.innerHTML = `
    <div class="user-card">
      <div class="upc-header">
        <div>
          <div class="upc-name">${escapeHtml(profile.username || "Unnamed User")}</div>
          <div class="upc-email">${escapeHtml(profile.email || "No email")}</div>
        </div>
        <div class="upc-status-block">
          <span class="upc-status-badge ${status.cls}">${escapeHtml(status.icon)} ${escapeHtml(status.label)}</span>
          <div class="upc-expiry-text">${escapeHtml(status.expiry)}</div>
        </div>
      </div>
      <div class="upc-body">
        ${touched > 0 ? `
          <div>
            <div class="upc-progress-label">Course progress — ${pct}%</div>
            <div class="upc-progress-track">
              <span class="upc-progress-fill" style="--w:${pct}%"></span>
            </div>
            <div class="upc-progress-text">${escapeHtml(progressLine)}</div>
          </div>
        ` : `<div class="upc-progress-text" style="color:var(--muted)">No course activity recorded yet</div>`}
        <div class="upc-meta-row">
          <span class="upc-meta-item">Last active: <strong>${escapeHtml(formatRelativeTime(lastSeen))}</strong></span>
          ${activePage ? `<span class="upc-meta-item">Page: <strong>${escapeHtml(activePage)}</strong></span>` : ""}
          ${lastUnit   ? `<span class="upc-meta-item">Last unit: <strong>${escapeHtml(lastUnit)}</strong></span>` : ""}
        </div>
        <details>
          <summary>Technical details</summary>
          <div class="upc-technical">
            <span>UID: ${escapeHtml(selectedUid)}</span>
            <span>fullUnlock: ${String(profile.fullUnlock ?? false)}</span>
            ${profile.licenseExpiresAt ? `<span>License expires: ${escapeHtml(formatDate(profile.licenseExpiresAt))}</span>` : ""}
            ${profile.trialExpiresAt   ? `<span>Trial expires: ${escapeHtml(formatDate(profile.trialExpiresAt))}</span>`   : ""}
          </div>
        </details>
      </div>
    </div>
  `;
}

// ── Alert Banner ───────────────────────────────────────────────────────────
function computeAlerts(users) {
  const now  = Date.now();
  const DAY  = 86400000;
  const WEEK = 7 * DAY;

  const alerts = [];

  // Trials expiring in the next 7 days (if field available in list data)
  const trialExpiring = users.filter(u => {
    if (!u.trialExpiresAt) return false;
    const exp = new Date(u.trialExpiresAt).getTime();
    return !isNaN(exp) && exp > now && exp < now + WEEK;
  });
  if (trialExpiring.length) {
    alerts.push({
      type:    "warn",
      icon:    "⏳",
      title:   `${trialExpiring.length} free trial${trialExpiring.length > 1 ? "s" : ""} expire this week`,
      preview: trialExpiring.slice(0, 3).map(u => u.username || u.email || "Unknown").join(", ")
        + (trialExpiring.length > 3 ? ` +${trialExpiring.length - 3} more` : ""),
      users: trialExpiring
    });
  }

  // Subscriptions expiring in the next 7 days
  const licExpiring = users.filter(u => {
    if (!u.licenseExpiresAt) return false;
    const exp = new Date(u.licenseExpiresAt).getTime();
    return !isNaN(exp) && exp > now && exp < now + WEEK;
  });
  if (licExpiring.length) {
    alerts.push({
      type:    "warn",
      icon:    "📋",
      title:   `${licExpiring.length} subscription${licExpiring.length > 1 ? "s" : ""} expire this week`,
      preview: licExpiring.slice(0, 3).map(u => u.username || u.email || "Unknown").join(", ")
        + (licExpiring.length > 3 ? ` +${licExpiring.length - 3} more` : ""),
      users: licExpiring
    });
  }

  // Access expired in the last 7 days — they may need a nudge to renew
  const recentlyExpired = users.filter(u => {
    const exp = u.licenseExpiresAt
      ? new Date(u.licenseExpiresAt).getTime()
      : u.trialExpiresAt ? new Date(u.trialExpiresAt).getTime() : 0;
    return exp && exp < now && exp > now - WEEK;
  });
  if (recentlyExpired.length) {
    alerts.push({
      type:    "danger",
      icon:    "🔴",
      title:   `${recentlyExpired.length} user${recentlyExpired.length > 1 ? "s" : ""} lost access in the last 7 days`,
      preview: recentlyExpired.slice(0, 3).map(u => u.username || u.email || "Unknown").join(", ")
        + (recentlyExpired.length > 3 ? ` +${recentlyExpired.length - 3} more` : ""),
      users: recentlyExpired
    });
  }

  // Users who have never opened the app
  const neverOpened = users.filter(u => !u.lastSeenAt && !u.isOnline);
  if (neverOpened.length) {
    alerts.push({
      type:    "info",
      icon:    "👤",
      title:   `${neverOpened.length} user${neverOpened.length > 1 ? "s" : ""} haven't opened the app yet`,
      preview: neverOpened.slice(0, 3).map(u => u.username || u.email || "Unknown").join(", ")
        + (neverOpened.length > 3 ? ` +${neverOpened.length - 3} more` : ""),
      users: neverOpened
    });
  }

  return alerts;
}

function renderAlerts(users) {
  const banner = document.getElementById("alertBanner");
  if (!banner) return;

  const alerts = computeAlerts(users);

  if (!alerts.length) {
    banner.classList.add("hidden");
    banner.innerHTML = "";
    return;
  }

  banner.classList.remove("hidden");
  banner.innerHTML = alerts.map((alert, index) => `
    <div class="alert-card ${alert.type}" data-alert-index="${index}" role="button" tabindex="0">
      <span class="alert-icon">${alert.icon}</span>
      <div class="alert-body">
        <div class="alert-title">${escapeHtml(alert.title)}</div>
        <div class="alert-names">${escapeHtml(alert.preview)}</div>
      </div>
      <span class="alert-cta">View these users →</span>
    </div>
  `).join("");

  // Attach click handlers — filter user list to alert users
  banner.querySelectorAll(".alert-card").forEach(card => {
    const handler = () => {
      const idx = Number(card.dataset.alertIndex);
      const alert = alerts[idx];
      if (!alert) return;
      alertFilterUids = new Set(alert.users.map(u => u.uid));
      renderUserList(loadedUsers);
      // Update the filter bar
      const bar   = document.getElementById("alertFilterBar");
      const label = document.getElementById("alertFilterLabel");
      if (bar)   bar.classList.remove("hidden");
      if (label) label.textContent = `Showing: ${alert.title}`;
      // Scroll to list
      document.getElementById("userList")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    card.addEventListener("click", handler);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") handler(); });
  });
}

// ── Stats Bar ──────────────────────────────────────────────────────────────
function updateStatsBar(users) {
  const now  = Date.now();
  const DAY  = 86400000;
  const WEEK = 7 * DAY;

  const total  = users.length;
  const online = users.filter(u => u.isOnline).length;
  const today  = users.filter(u => { const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0; return t && (now - t) < DAY; }).length;
  const week   = users.filter(u => { const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0; return t && (now - t) < WEEK; }).length;

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

  const onlineCount   = users.filter(u => u.isOnline).length;
  const todayCount    = users.filter(u => { const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0; return !u.isOnline && t && (now - t) < DAY; }).length;
  const weekCount     = users.filter(u => { const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0; return !u.isOnline && t && (now - t) >= DAY && (now - t) < WEEK; }).length;
  const inactiveCount = Math.max(0, users.length - onlineCount - todayCount - weekCount);

  destroyChart("status");
  const statusCanvas = document.getElementById("statusChart");
  if (statusCanvas) {
    charts.status = new Chart(statusCanvas, {
      type: "doughnut",
      data: {
        labels: ["Online Now", "Active Today", "Active This Week", "Inactive"],
        datasets: [{ data: [onlineCount, todayCount, weekCount, inactiveCount], backgroundColor: ["#059669","#0ea5e9","#8b5cf6","#e2e8f0"], borderWidth: 2, borderColor: "#ffffff", hoverOffset: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: { display: true, position: "right", labels: { padding: 12, boxWidth: 10, font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} users` } }
        }
      }
    });
  }

  const buckets = [0, 0, 0, 0, 0, 0];
  users.forEach(u => {
    const t = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
    if (!t) { buckets[5]++; return; }
    const d = now - t;
    if (d < 3600000) buckets[0]++;
    else if (d < DAY)   buckets[1]++;
    else if (d < WEEK)  buckets[2]++;
    else if (d < MONTH) buckets[3]++;
    else                buckets[4]++;
  });

  destroyChart("activity");
  const activityCanvas = document.getElementById("activityChart");
  if (activityCanvas) {
    charts.activity = new Chart(activityCanvas, {
      type: "bar",
      data: {
        labels: ["< 1h", "1–24h", "1–7d", "7–30d", "30d+", "Never"],
        datasets: [{ data: buckets, backgroundColor: ["rgba(5,150,105,.75)","rgba(14,165,233,.75)","rgba(139,92,246,.75)","rgba(217,119,6,.75)","rgba(225,29,72,.75)","rgba(148,163,184,.75)"], borderRadius: 6, borderSkipped: false }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" }, ticks: { stepSize: 1, color: "#718096", font: { size: 11 } } },
          x: { grid: { display: false }, ticks: { color: "#718096", font: { size: 11 } } }
        }
      }
    });
  }
}

// ── Analytics Tab ──────────────────────────────────────────────────────────
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
  const hasData         = Object.keys(lessonProgress).length > 0 || completedUnits.length > 0 || openedUnits.length > 0;

  if (!hasData) {
    analyticsEmpty?.classList.remove("hidden");
    analyticsCharts?.classList.add("hidden");
    return;
  }

  analyticsEmpty?.classList.add("hidden");
  analyticsCharts?.classList.remove("hidden");

  const entries    = Object.entries(lessonProgress);
  const lessonWrap = document.getElementById("lessonChartWrap");

  destroyChart("lessonBar");

  if (entries.length > 0) {
    if (lessonWrap) lessonWrap.style.height = Math.max(200, entries.length * 38 + 60) + "px";
    const percents = entries.map(([, item]) => getLessonProgressPercent(item));
    const colors   = percents.map(p => p >= 100 ? "rgba(5,150,105,.8)" : p > 0 ? "rgba(14,165,233,.8)" : "rgba(139,92,246,.5)");
    const lessonCanvas = document.getElementById("lessonBarChart");
    if (lessonCanvas) {
      charts.lessonBar = new Chart(lessonCanvas, {
        type: "bar",
        data: { labels: entries.map(([id]) => getReadableUnitName(id)), datasets: [{ data: percents, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x}%` } } },
          scales: {
            x: { min: 0, max: 100, grid: { color: "rgba(0,0,0,.05)" }, ticks: { callback: v => v + "%", color: "#718096", font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { color: "#718096", font: { size: 11 } } }
          }
        }
      });
    }
  } else if (lessonWrap) {
    lessonWrap.style.height = "60px";
  }

  const completed = completedUnits.length;
  const inProg    = inProgressUnits.length;
  const opened    = Math.max(0, openedUnits.length - completed - inProg);
  const donutCanvas = document.getElementById("unitDonutChart");
  const donutLegend = document.getElementById("unitDonutLegend");

  destroyChart("unitDonut");

  if (donutCanvas && (completed + inProg + opened) > 0) {
    charts.unitDonut = new Chart(donutCanvas, {
      type: "doughnut",
      data: { labels: ["Completed","In Progress","Opened"], datasets: [{ data: [completed, inProg, opened], backgroundColor: ["#059669","#0ea5e9","#8b5cf6"], borderWidth: 2, borderColor: "#ffffff", hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} units` } } } }
    });
  }

  if (donutLegend) {
    donutLegend.innerHTML = [
      { color: "#059669", label: "Completed",  count: completed },
      { color: "#0ea5e9", label: "In Progress", count: inProg },
      { color: "#8b5cf6", label: "Opened",      count: opened }
    ].map(i => `
      <div class="donut-legend-item">
        <span class="donut-legend-dot" style="background:${i.color}"></span>
        <span>${escapeHtml(i.label)}</span>
        <span class="muted" style="margin-left:auto;font-weight:700">${i.count}</span>
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
    const key   = d.toISOString().slice(0, 10);
    byDate[key] = (byDate[key] || 0) + (Number(p.amount) || 0) / 100;
  });

  const sorted = Object.keys(byDate).sort();
  if (!sorted.length) { box.style.display = "none"; return; }

  box.style.display = "";
  destroyChart("revenue");
  charts.revenue = new Chart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map(k => new Date(k + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })),
      datasets: [{ data: sorted.map(k => byDate[k]), backgroundColor: "rgba(249,115,22,.72)", borderRadius: 6, borderSkipped: false }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ₹${ctx.parsed.y.toFixed(2)}` } } },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" }, ticks: { callback: v => "₹" + v, color: "#718096", font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { color: "#718096", font: { size: 11 } } }
      }
    }
  });
}

// ── Payment Totals ─────────────────────────────────────────────────────────
function renderPaymentTotals(payments) {
  const el = document.getElementById("paymentTotals");
  if (!el) return;

  const captured = payments.filter(p => p.status === "captured" || p.verifiedAt);
  const total    = captured.reduce((s, p) => s + (Number(p.amount) || 0) / 100, 0);

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth  = captured.filter(p => p.verifiedAt && new Date(p.verifiedAt) >= monthStart);
  const monthTotal = thisMonth.reduce((s, p) => s + (Number(p.amount) || 0) / 100, 0);
  const pending    = payments.length - captured.length;

  const fmt = n => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

  el.innerHTML = `
    <div class="payment-totals">
      <div class="payment-total-card highlight">
        <div class="payment-total-label">Total Received</div>
        <div class="payment-total-value">${fmt(total)}</div>
        <div class="payment-total-sub">${captured.length} verified payment${captured.length !== 1 ? "s" : ""}</div>
      </div>
      <div class="payment-total-card">
        <div class="payment-total-label">This Month</div>
        <div class="payment-total-value">${fmt(monthTotal)}</div>
        <div class="payment-total-sub">${thisMonth.length} payment${thisMonth.length !== 1 ? "s" : ""}</div>
      </div>
      <div class="payment-total-card ${pending > 0 ? "warn" : ""}">
        <div class="payment-total-label">Unverified</div>
        <div class="payment-total-value">${pending}</div>
        <div class="payment-total-sub">${pending > 0 ? "may need attention" : "all payments verified"}</div>
      </div>
    </div>
  `;
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
    ["status","activity","lessonBar","unitDonut","revenue"].forEach(destroyChart);
  }
}

function renderUserList(users) {
  if (!els.userList) return;

  // Apply alert filter first, then the online/all filter
  let visible = alertFilterUids
    ? users.filter(u => alertFilterUids.has(u.uid))
    : users;

  if (activeUserFilter === "online") {
    visible = visible.filter(u => u.isOnline === true);
  }

  if (!visible.length) {
    els.userList.innerHTML = `<p class="muted" style="padding:8px 4px">No matching users found.</p>`;
    return;
  }

  els.userList.innerHTML = visible.map(user => `
    <button type="button" class="user-button ${user.uid === selectedUid ? "active" : ""}" data-uid="${escapeHtml(user.uid)}">
      <span class="user-topline">
        <strong>${escapeHtml(user.username || "Unnamed user")}</strong>
        <span class="online-dot ${user.isOnline ? "is-online" : ""}">${user.isOnline ? "Online" : "Away"}</span>
      </span>
      <span class="muted user-meta-line">${escapeHtml(user.email || "No email")}</span>
      <span class="muted user-meta-line">${escapeHtml(user.activePage || "Last seen")} · ${escapeHtml(formatRelativeTime(user.lastSeenAt))}</span>
    </button>
  `).join("");

  els.userList.querySelectorAll(".user-button").forEach(btn => {
    btn.addEventListener("click", () => loadUser(btn.dataset.uid));
  });
}

// ── Progress tab renderers (unchanged) ────────────────────────────────────
function renderUnitList(title, values, stateClass) {
  if (!values.length) {
    return `
      <section class="progress-section">
        <h3>${escapeHtml(title)} <span class="progress-count">0</span></h3>
        <p class="empty-state">No ${escapeHtml(title.toLowerCase())} recorded for this user yet.</p>
      </section>
    `;
  }
  return `
    <section class="progress-section">
      <h3>${escapeHtml(title)} <span class="progress-count">${values.length}</span></h3>
      <div class="unit-chip-list">
        ${values.map(id => `<span class="unit-chip ${stateClass}" title="${escapeHtml(id)}">${escapeHtml(getReadableUnitName(id))}</span>`).join("")}
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
        <p class="empty-state">No lesson progress recorded for this user yet.</p>
      </section>
    `;
  }
  return `
    <section class="progress-section">
      <h3>Lesson Progress <span class="progress-count">${entries.length}</span></h3>
      <div class="lesson-progress-list">
        ${entries.map(([unitId, item]) => {
          const pct        = getLessonProgressPercent(item);
          const lastIdx    = Number.isFinite(Number(item?.lastScreenIndex)) ? Number(item.lastScreenIndex) : null;
          const totalScr   = Number.isFinite(Number(item?.totalScreens))   ? Number(item.totalScreens)   : null;
          const screenText = totalScr ? `Screen ${lastIdx === null ? 1 : lastIdx + 1} of ${totalScr}` : "Started";
          return `
            <article class="lesson-progress-card">
              <div class="lesson-progress-card-top">
                <div>
                  <div class="lesson-progress-name">${escapeHtml(getReadableUnitName(unitId))}</div>
                  <div class="lesson-progress-meta">${escapeHtml(screenText)}</div>
                </div>
                <span class="pill">${pct}%</span>
              </div>
              <div class="mini-progress-track">
                <span class="mini-progress-fill" style="--w:${pct}%"></span>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderProgress(progress) {
  const completedUnits  = Array.isArray(progress?.completedUnits)  ? progress.completedUnits  : [];
  const openedUnits     = Array.isArray(progress?.openedUnits)     ? progress.openedUnits     : [];
  const inProgressUnits = Array.isArray(progress?.inProgressUnits) ? progress.inProgressUnits : [];
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
  setStatus(els.userSearchStatus, "Loading users…");
  try {
    const payload  = await adminPost("/api/admin/list-users", { query: els.userSearch?.value || "", limit: 500 });
    loadedUsers    = payload.users || [];
    renderUserList(loadedUsers);
    const onlineCount = loadedUsers.filter(u => u.isOnline === true).length;
    setStatus(els.userSearchStatus, `${loadedUsers.length} user${loadedUsers.length !== 1 ? "s" : ""} loaded · ${onlineCount} online now`, "success");
    updateStatsBar(loadedUsers);
    renderOverviewCharts(loadedUsers);
    renderAlerts(loadedUsers);
  } catch (error) {
    console.error(error);
    setStatus(els.userSearchStatus, error.message, "error");
  }
}

async function loadUser(uid) {
  selectedUid      = uid;
  selectedListUser = loadedUsers.find(u => u.uid === uid) || null;
  setStatus(els.accessStatus, "");

  try {
    const payload    = await adminPost("/api/admin/get-user", { targetUid: uid });
    selectedUser     = payload.profile  || {};
    selectedProgress = payload.progress || {};
    renderUserCard(selectedUser);
    renderProgress(selectedProgress);
    renderRawProfile(selectedUser);
    if (!els.analyticsTab?.classList.contains("hidden")) {
      renderAnalyticsTab(selectedProgress);
    }
    searchUsers();
  } catch (error) {
    console.error(error);
    setStatus(els.accessStatus, error.message, "error");
  }
}

async function updateAccess(action, reasonOverride = null) {
  if (!selectedUid) { setStatus(els.accessStatus, "Select a user first.", "error"); return; }

  const reason = reasonOverride || els.accessReasonSelect?.value?.trim() || "";
  if (!reason) { setStatus(els.accessStatus, "Choose a reason before saving.", "error"); return; }

  const body = { targetUid: selectedUid, action, reason };

  if (action === "setExpiry") {
    if (!els.customExpiry?.value) { setStatus(els.accessStatus, "Choose a custom expiry date.", "error"); return; }
    body.expiresAt = new Date(`${els.customExpiry.value}T23:59:59`).toISOString();
  }

  setStatus(els.accessStatus, "Saving…");
  try {
    const payload = await adminPost("/api/admin/update-access", body);
    selectedUser  = payload.profile || selectedUser;
    renderUserCard(selectedUser);
    renderRawProfile(selectedUser);
    await loadUser(selectedUid);
    // Reset access controls
    if (els.accessReasonSelect) els.accessReasonSelect.value = "";
    selectedDuration = null;
    document.querySelectorAll(".duration-btn").forEach(b => b.classList.remove("selected"));
    const giveBtn = document.getElementById("giveAccessBtn");
    if (giveBtn) giveBtn.textContent = "Give Access";
    setStatus(els.accessStatus, "Access updated successfully.", "success");
  } catch (error) {
    console.error(error);
    setStatus(els.accessStatus, error.message, "error");
  }
}

async function loadPayments() {
  setStatus(els.paymentStatus, "Loading payments…");
  try {
    const payload  = await adminPost("/api/admin/list-payments", { limit: 50 });
    const payments = payload.payments || [];

    renderPaymentTotals(payments);

    els.paymentsBody.innerHTML = payments.map(p => {
      const statusClass = p.status === "captured" ? "captured" : p.status === "created" ? "pending" : p.status === "failed" ? "failed" : "unknown";
      const statusLabel = p.status === "captured" ? "Paid" : p.status === "created" ? "Pending" : p.status === "failed" ? "Failed" : (p.status || "Unknown");
      const date = p.verifiedAt ? new Date(p.verifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
      return `
        <tr>
          <td>
            <strong>${escapeHtml(p.email || "No email")}</strong>
            <br><small style="color:var(--muted)">${escapeHtml(p.uid || "")}</small>
          </td>
          <td style="font-weight:700;font-size:15px">${escapeHtml(formatAmount(p.amount, p.currency))}</td>
          <td><span class="status-badge ${statusClass}">${escapeHtml(statusLabel)}</span></td>
          <td>${escapeHtml(date)}</td>
          <td>
            <small style="color:var(--muted)">${escapeHtml(p.razorpayOrderId || p.id || "—")}</small>
            ${p.razorpayPaymentId ? `<br><small style="color:var(--muted)">${escapeHtml(p.razorpayPaymentId)}</small>` : ""}
          </td>
        </tr>
      `;
    }).join("");

    setStatus(els.paymentStatus, `${payments.length} payment${payments.length !== 1 ? "s" : ""} loaded.`, "success");
    renderRevenueChart(payments);
  } catch (error) {
    console.error(error);
    setStatus(els.paymentStatus, error.message, "error");
  }
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
  els.progressTab?.classList.toggle("hidden",  tabName !== "progress");
  els.analyticsTab?.classList.toggle("hidden", tabName !== "analytics");
  els.rawTab?.classList.toggle("hidden",       tabName !== "raw");
  els.paymentsTab?.classList.toggle("hidden",  tabName !== "payments");
  if (tabName === "payments")  loadPayments();
  if (tabName === "analytics") renderAnalyticsTab(selectedProgress);
}

// ── Event listeners ────────────────────────────────────────────────────────
els.emailLoginButton?.addEventListener("click", async () => {
  setStatus(els.loginStatus, "Signing in…");
  try {
    await signInWithEmailAndPassword(auth, els.loginEmail.value.trim(), els.loginPassword.value);
    setStatus(els.loginStatus, "");
  } catch (error) {
    setStatus(els.loginStatus, error.message, "error");
  }
});

els.googleLoginButton?.addEventListener("click", async () => {
  setStatus(els.loginStatus, "Opening Google sign in…");
  try {
    await signInWithPopup(auth, googleProvider);
    setStatus(els.loginStatus, "");
  } catch (error) {
    setStatus(els.loginStatus, error.message, "error");
  }
});

els.signOutButton?.addEventListener("click", () => signOut(auth));

// User search — instant client-side filter on loaded users, server search on Enter/button
els.userSearch?.addEventListener("input", () => {
  const q = els.userSearch.value.toLowerCase().trim();
  if (!q) { renderUserList(loadedUsers); return; }
  const filtered = loadedUsers.filter(u =>
    (u.username || "").toLowerCase().includes(q) ||
    (u.email    || "").toLowerCase().includes(q) ||
    (u.uid      || "").toLowerCase().includes(q)
  );
  renderUserList(filtered);
});

els.userSearch?.addEventListener("keydown", e => { if (e.key === "Enter") searchUsers(); });
els.searchUsersButton?.addEventListener("click",  searchUsers);
els.refreshUsersButton?.addEventListener("click", searchUsers);
els.refreshPaymentsButton?.addEventListener("click", loadPayments);

// Clear alert filter
document.getElementById("clearAlertFilter")?.addEventListener("click", () => {
  alertFilterUids = null;
  document.getElementById("alertFilterBar")?.classList.add("hidden");
  renderUserList(loadedUsers);
});

// Overview toggle
document.getElementById("toggleOverviewBtn")?.addEventListener("click", () => {
  const area    = document.getElementById("overviewChartsArea");
  const btn     = document.getElementById("toggleOverviewBtn");
  if (!area || !btn) return;
  const hidden  = area.classList.toggle("hidden");
  btn.textContent = hidden ? "Show charts" : "Hide charts";
});

// User filters
document.querySelectorAll("[data-user-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    activeUserFilter = btn.dataset.userFilter || "all";
    document.querySelectorAll("[data-user-filter]").forEach(b => b.classList.toggle("active", b === btn));
    renderUserList(loadedUsers);
  });
});

// Duration picker
document.querySelectorAll(".duration-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedDuration = btn.dataset.duration;
    document.querySelectorAll(".duration-btn").forEach(b => b.classList.toggle("selected", b === btn));
    const labels   = { "30": "1 Month", "90": "3 Months", "365": "1 Year", "permanent": "Permanent" };
    const giveBtn  = document.getElementById("giveAccessBtn");
    if (giveBtn) giveBtn.textContent = `Give ${labels[selectedDuration] || ""} Access`;
  });
});

// Give access button
document.getElementById("giveAccessBtn")?.addEventListener("click", () => {
  if (!selectedUid)      { setStatus(els.accessStatus, "Select a user first.", "error"); return; }
  if (!selectedDuration) { setStatus(els.accessStatus, "Choose a duration above.", "error"); return; }
  const reason = els.accessReasonSelect?.value;
  if (!reason) { setStatus(els.accessStatus, "Choose a reason for giving access.", "error"); return; }
  const actionMap = { "30": "extend30", "90": "extend90", "365": "extend365", "permanent": "grant" };
  updateAccess(actionMap[selectedDuration] || "grant", reason);
});

// Remove access — show confirm panel
document.getElementById("removeAccessBtn")?.addEventListener("click", () => {
  if (!selectedUid) { setStatus(els.accessStatus, "Select a user first.", "error"); return; }
  const nameEl = document.getElementById("revokeUserName");
  if (nameEl) nameEl.textContent = selectedUser?.username || selectedUser?.email || "this user";
  document.getElementById("revokeConfirm")?.classList.remove("hidden");
  document.getElementById("accessMainControls")?.classList.add("hidden");
});

document.getElementById("confirmRevokeBtn")?.addEventListener("click", () => {
  document.getElementById("revokeConfirm")?.classList.add("hidden");
  document.getElementById("accessMainControls")?.classList.remove("hidden");
  updateAccess("revoke", "Access removed by admin");
});

document.getElementById("cancelRevokeBtn")?.addEventListener("click", () => {
  document.getElementById("revokeConfirm")?.classList.add("hidden");
  document.getElementById("accessMainControls")?.classList.remove("hidden");
});

// Advanced: custom expiry
document.querySelector("[data-action='setExpiry']")?.addEventListener("click", () => {
  updateAccess("setExpiry");
});

// Tab switching
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ── Auth state ─────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  setSignedInView(user);
  selectedUid      = null;
  selectedUser     = null;
  selectedProgress = null;
  selectedListUser = null;
  alertFilterUids  = null;
  if (!user) return;

  try {
    await getFreshToken();
    await searchUsers();
  } catch (error) {
    console.error(error);
    setStatus(els.userSearchStatus, error.message, "error");
  }
});
