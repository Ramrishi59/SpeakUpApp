let dashboardLessons = [];
let rerenderDashboard = null;
let dashboardLoadError = "";

function isFreeLesson(lessonId) {
  // TODO: put your real free list here
  const FREE = new Set(["unit1", "unit2", "trial"]); 
  return FREE.has(String(lessonId));
}

function getLoginState() {
  if (!window.SUAuth || typeof window.SUAuth.getAuth !== 'function') {
    return { isLoggedIn: false, email: null, uid: null };
  }
  return window.SUAuth.getAuth(); // { isLoggedIn, email, uid }
}

function getAccessState() {
  if (!window.SUAuth || typeof window.SUAuth.isEntitled !== 'function') {
    return false;
  }
  return window.SUAuth.isEntitled(); // true/false (checks expiry too)
}

function getAppRoot() {
  return document.getElementById('appRoot');
}

function showDashboardScreen() {
  const dashboard = document.getElementById('dashboard-screen');
  const account = document.getElementById('account-screen');
  if (dashboard) dashboard.style.display = '';
  if (account) account.style.display = 'none';
  rerenderDashboard?.();
}

function openAccountScreen() {
  renderAccountStatus();
}

function renderAccountStatus() {
  const appRoot = getAppRoot();
  if (!appRoot) return;

  let accountScreen = document.getElementById('account-screen');
  if (!accountScreen) {
    accountScreen = document.createElement('div');
    accountScreen.id = 'account-screen';
    appRoot.appendChild(accountScreen);
  }

  const dashboard = document.getElementById('dashboard-screen');
  if (dashboard) dashboard.style.display = 'none';
  accountScreen.style.display = 'block';

  const auth = getLoginState();
  const unlocked = getAccessState();

  if (!auth.isLoggedIn) {
    accountScreen.innerHTML = `
      <section class="account-screen" aria-labelledby="status-title">
        <div class="account-card">
          <div class="account-brand">
            <img src="Images/dashboard thumbnails/Manku.webp" alt="SpeakUp" />
            <span>SpeakUp</span>
          </div>
          <h2 class="account-title" id="status-title">Account Status</h2>
          <p class="account-subtitle">Sign in to see your access status.</p>
  
          <div class="login-form">
            <label for="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>
  
          <div class="login-form">
            <label for="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="Enter password"
              autocomplete="current-password"
              required
            />
          </div>
  
          <p id="login-message" class="footer-note"></p>
  
          <div class="button-row">
            <button type="button" class="primary-button" id="login-button">Log In</button>
            <button type="button" class="secondary-button" id="back-dashboard">Back to Dashboard</button>
          </div>
        </div>
      </section>
    `;
  
    const loginButton = document.getElementById('login-button');
  
    loginButton?.addEventListener('click', async () => {
      const email = document.getElementById('login-email')?.value?.trim() || '';
      const password = document.getElementById('login-password')?.value || '';
      const message = document.getElementById('login-message');
  
      if (!email || !password) {
        if (message) message.textContent = 'Please enter email and password.';
        return;
      }
  
      try {
        await window.SUAuth.loginWithEmail(email, password);
  
        const updatedAuth = getLoginState();
        const unlockedNow = getAccessState();
  
        if (updatedAuth.isLoggedIn && unlockedNow) {
          renderAccountStatus();
          showDashboardScreen();
        } else if (updatedAuth.isLoggedIn && !unlockedNow) {
          renderAccountStatus();
          if (message) message.textContent = 'Access not enabled yet.';
        }
      } catch (error) {
        console.error(error);
        if (message) message.textContent = 'Login failed. Check email and password.';
      }
    });
  } else {
    const license = window.SUAuth.getLicense();
    const expText = (license && license.licenseExpiresAt)
      ? new Date(license.licenseExpiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : null;
    
    accountScreen.innerHTML = `
      <section class="login-card" aria-labelledby="status-title">
        <div class="card-header">
          <h2 id="status-title">Account</h2>
        </div>
    
        <p class="status-line"><strong>Signed in:</strong> ${auth.email || 'Unknown user'}</p>
    
        <div class="status-badge ${unlocked ? 'status-unlocked' : 'status-locked'}">
          ${unlocked ? 'Unlocked ✅' : 'Locked 🔒'}
        </div>
    
        ${
          unlocked
          ? `
            <div class="premium-box">
              <h3 class="premium-title">Speak Up Premium</h3>
              <p class="premium-sub">Offline access is active.</p>
              ${expText ? `<p class="premium-sub"><strong>Offline until:</strong> ${expText}</p>` : ''}
            </div>
          `
          : `
            <div class="premium-box">
              <h3 class="premium-title">Speak Up Premium</h3>
              <p class="premium-sub">Unlock all lessons and activities.</p>
    
              <ul class="premium-list">
                <li>✔ All units + activities</li>
                <li>✔ Speaking practice</li>
                <li>✔ Works offline after unlock (30 days)</li>
              </ul>
    
              <div class="price-row">
                <span class="price-label">Price</span>
                <span class="price-value">₹499 (one-time)</span>
              </div>
    
              <div class="login-form">
                <button type="button" id="buy-button" class="primary-btn">Buy Now</button>
              </div>
              <p class="footer-note">Tip: You can restore access anytime by signing in with the same phone number.</p>
            </div>
          `
        }
    
        <div class="login-form">
          <button type="button" id="back-dashboard" class="ghost-btn">Back to Dashboard</button>
          <button type="button" id="signout-btn" class="ghost-btn">Sign out</button>
        </div>
    
        <p class="footer-note">Offline access: Available (30-day licence)</p>
      </section>
    `;

    if (!unlocked) {
      document.getElementById('buy-button')?.addEventListener('click', () => {
        alert('Access will be enabled by the Speak Up team.');
      });
    }
  }

  document.getElementById('back-dashboard')?.addEventListener('click', showDashboardScreen);

  document.getElementById('signout-btn')?.addEventListener('click', async () => {
    await window.SUAuth.logout();
    renderAccountStatus();
    showDashboardScreen();
  });


}

function appendQueryParam(url, key, value) {
  if (!value) return url;
  const [base, hash] = url.split('#');
  const sep = base.includes('?') ? '&' : '?';
  const next = `${base}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  return hash ? `${next}#${hash}` : next;
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('A: DOM loaded');

  try {
    if (window.SUAuth?.ready) {
      await window.SUAuth.ready;
      console.log('B: SUAuth ready finished');
    } else {
      console.warn('B-WARN: SUAuth missing, continuing with locked dashboard fallback');
    }
  } catch (err) {
    console.error('B-ERROR: SUAuth.ready failed:', err);
  }

  showDashboardScreen();
  console.log('C: showDashboardScreen done');

  const lessonsList = document.querySelector('.lessons-list');
  console.log('D: lessonsList =', lessonsList);

  const searchInput = document.querySelector('.search-input');
  const searchLabel = document.querySelector('.search-label');
  const searchBar = document.querySelector('.search-bar');
  const searchIcon = document.querySelector('.search-icon');
  const refreshButton = document.querySelector('.refresh-button');
  const mainContent = document.querySelector('.main-content');

  await loadDashboardLessons();
  console.log('E: dashboardLessons after load =', dashboardLessons);

  refreshButton?.addEventListener('click', async () => {
    try {
      if (navigator.serviceWorker?.getRegistration) {
        const reg = await navigator.serviceWorker.getRegistration();
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        reg?.update?.();
      }
    } catch {}
    window.location.reload();
  });


  const navButtons = document.querySelectorAll('.bottom-nav .nav-button');

  // -------- Routing (centralised) --------
  // Special routes (only when a card needs a custom file)
  // Special routes (only when a card needs a custom file)
  const ROUTE_OVERRIDES = {
    'unit1-practice': () => 'an-quiz/an-quiz.html',
    'and-practice': () => 'and-practice/and.html',
  };


  function resolveRoute(card) {
    // Honour explicit route from manifest if present
    if (card.route) return card.route;
    // Default rule:
    //  - Practice pages: <id>/<id>.html (only if you adopt that convention)
    //  - Units: Trial.html?unitId=<id>
    return card.id.endsWith('-practice')
      ? `${card.id}/${card.id}.html`
      : `Trial.html?unitId=${card.id}`;
  }

  function getRouteForCard(card) {
    // 1. check manual overrides
    if (ROUTE_OVERRIDES[card.id]) {
      return ROUTE_OVERRIDES[card.id]();
    }
  
    // 2. otherwise use default resolver
    return resolveRoute(card);
  }
  
  // -------------------------------
// Load dashboard lessons from manifest.json
// -------------------------------
async function loadDashboardLessons() {
  try {
    const manifestUrl = new URL('./units/manifest.json?v=9', window.location.href);
    const res = await fetch(manifestUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load manifest.json');
    const { cards } = await res.json();

    // Optional quick validator
    const ids = new Set();
    for (const c of cards) {
      if (!c.id || !c.title) console.warn('Missing id/title:', c);
      if (ids.has(c.id)) console.warn('Duplicate id:', c.id);
      ids.add(c.id);
    }

    dashboardLessons = cards;
    dashboardLoadError = "";
  } catch (e) {
    console.error('Could not load manifest.json:', e);
    dashboardLessons = [];
    dashboardLoadError = `${e?.message || e}`;
  }
}
  function getScrollKey() {
    return 'scroll:dashboard';
  }

  function saveScrollPosition() {
    if (!mainContent) return;
    sessionStorage.setItem(getScrollKey(), String(mainContent.scrollTop || 0));
  }

  function restoreScrollPosition() {
    if (!mainContent) return;
    const value = sessionStorage.getItem(getScrollKey());
    if (value == null) return;
    const next = Number(value);
    if (!Number.isNaN(next)) {
      requestAnimationFrame(() => {
        mainContent.scrollTop = next;
      });
    }
  }

  function navigateToLesson(id) {
    // find the full card so resolveRoute can honour overrides and future per-card routes
    const card = dashboardLessons.find(c => c.id === id);
    if (!card) {
      console.warn('No card found for id:', id);
      return;
    }
    if (!getAccessState() && !isFreeLesson(id)) {
      openAccountScreen();
      return;
    }
    saveScrollPosition();
    // Use overrides when present, else default resolver
    const baseRoute = getRouteForCard(card);
    const route = appendQueryParam(baseRoute, 'from', 'dashboard');
    window.location.href = route;
  }


  // -------- Render cards --------
  function renderLessonCards(lessonsToRender) {
    if (!lessonsList) return;
    lessonsList.innerHTML = '';

    if (dashboardLoadError) {
      lessonsList.innerHTML = `
        <div class="lesson-card" style="cursor: default;">
          <div class="lesson-info">
            <h3>Could not load dashboard items</h3>
            <p>${dashboardLoadError}</p>
            <p>Expected file: app/units/manifest.json</p>
            <p>Current page: ${window.location.href}</p>
          </div>
        </div>
      `;
      return;
    }

    if (!lessonsToRender.length) {
      lessonsList.innerHTML = `
        <div class="lesson-card" style="cursor: default;">
          <div class="lesson-info">
            <h3>No dashboard items found</h3>
          </div>
        </div>
      `;
      return;
    }

    lessonsToRender.forEach(lesson => {
      const card = document.createElement('div');
      card.classList.add('lesson-card');
      card.dataset.lessonId = lesson.id;
      card.tabIndex = 0; // keyboard focusable

      const isFree = isFreeLesson(lesson.id);
      const entitled = getAccessState();
      const badge = entitled ? '' : (isFree ? '<span class="lesson-badge free">Free</span>' : '<span class="lesson-badge locked">🔒 Locked</span>');
      card.innerHTML = `
          <img src="${lesson.thumbnail}" alt="${lesson.title}" class="lesson-thumbnail" loading="lazy">
          <div class="lesson-info">
            <h3>${lesson.title}</h3>
          </div>
          ${badge}
          <span class="forward-arrow">›</span>
        `;

      const handleClick = () => {
        navigateToLesson(lesson.id);
      };

      // click
      card.addEventListener('click', handleClick);
      // keyboard Enter/Space
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      });

      lessonsList.appendChild(card);
    });
  }

  // initial render
  renderCurrentView();

  // -------- Search --------
  function collapseSearchBar() {
    if (!searchBar) return;
    if (!searchInput || searchInput.value.trim() === '') {
      searchBar.classList.add('collapsed');
    }
  }

  function expandSearchBar() {
    if (!searchBar) return;
    searchBar.classList.remove('collapsed');
    searchInput?.focus();
  }

  // Start collapsed by default for the icon-only look
  collapseSearchBar();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = dashboardLessons.filter(lesson =>
        lesson.title.toLowerCase().includes(q) ||
        String(lesson.description || '').toLowerCase().includes(q)
      );
      renderLessonCards(filtered);
    });

    searchInput.addEventListener('blur', () => collapseSearchBar());
    searchInput.addEventListener('focus', () => expandSearchBar());
  }

  // Clicking the icon or bar expands the search
  searchIcon?.addEventListener('click', (e) => {
    e.preventDefault();
    expandSearchBar();
  });

  searchBar?.addEventListener('click', () => expandSearchBar());

  function renderCurrentView() {
    renderLessonCards(dashboardLessons);
    if (searchLabel) {
      searchLabel.textContent = 'Lessons';
    }
    restoreScrollPosition();
  }

  rerenderDashboard = renderCurrentView;

  // -------- Bottom nav --------
  if (navButtons) {
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const target = btn.dataset.navTarget;
        if (target === 'lessons') {
          // Always return to the dashboard
          window.location.href = 'dashboard.html';
        } else if (target === 'login') {
          openAccountScreen();
        } else {
          alert(`The "${target.charAt(0).toUpperCase() + target.slice(1)}" section is not yet implemented.`);
        }
      });
    });
  }

  console.log("Dashboard ready.");
});
