let dashboardLessons = [];
let rerenderDashboard = null;
let dashboardLoadError = "";

const ROUTE_OVERRIDES = {
  'unit1-practice': () => 'an-quiz/an-quiz.html',
  'and-practice': () => 'and-practice/and.html',
};

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
  if (!window.SUAuth || typeof window.SUAuth.getLicense !== 'function') {
    return {
      fullUnlock: false,
      unlockedUnits: [],
      licenseExpiresAt: null,
      role: null
    };
  }
  return window.SUAuth.getLicense();
}

function getProfileState() {
  if (!window.SUAuth || typeof window.SUAuth.getProfile !== 'function') {
    return null;
  }
  return window.SUAuth.getProfile();
}

function getDashboardContentCount() {
  return dashboardLessons.filter((card) => card?.id && card.id !== 'intro').length;
}

function getLessonTitleById(lessonId) {
  if (!lessonId) return null;
  const lesson = dashboardLessons.find((card) => String(card?.id) === String(lessonId));
  return lesson?.title || null;
}

function getLessonCardById(lessonId) {
  if (!lessonId) return null;
  return dashboardLessons.find((card) => String(card?.id) === String(lessonId)) || null;
}

function getLessonProgressState(lessonId) {
  const profile = getProfileState();
  const normalizedLessonId = String(lessonId);
  const completedUnits = Array.isArray(profile?.completedUnits) ? profile.completedUnits.map(String) : [];
  const isCompleted = completedUnits.includes(normalizedLessonId);
  const isInProgress = !isCompleted && String(profile?.lastOpenedUnit || '') === normalizedLessonId;

  return { isCompleted, isInProgress };
}

function resolveRoute(card) {
  if (card.route) return card.route;
  return card.id.endsWith('-practice')
    ? `${card.id}/${card.id}.html`
    : `Trial.html?unitId=${card.id}`;
}

function getRouteForCard(card) {
  if (!card?.id) return null;
  if (ROUTE_OVERRIDES[card.id]) {
    return ROUTE_OVERRIDES[card.id]();
  }
  return resolveRoute(card);
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function hasLessonAccess(lessonId) {
  if (isFreeLesson(lessonId)) return true;

  const access = getAccessState();
  if (access.fullUnlock) return true;

  return Array.isArray(access.unlockedUnits) && access.unlockedUnits.includes(String(lessonId));
}

function getAppRoot() {
  return document.getElementById('appRoot');
}

function setActiveBottomNav(target) {
  document.querySelectorAll('.bottom-nav .nav-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.navTarget === target);
  });
}

function updateAccountNavLabel() {
  const auth = getLoginState();
  const accountNavButton = document.querySelector('.bottom-nav .nav-button[data-nav-target="login"]');
  if (!accountNavButton) return;

  const label = auth.isLoggedIn ? 'Profile' : 'Log in';
  const labelNode = accountNavButton.querySelector('span');
  const iconNode = accountNavButton.querySelector('img');

  if (labelNode) labelNode.textContent = label;
  if (iconNode) iconNode.alt = label;
}

function showDashboardScreen() {
  const dashboard = document.getElementById('dashboard-screen');
  const account = document.getElementById('account-screen');
  if (dashboard) dashboard.style.display = '';
  if (account) account.style.display = 'none';
  updateAccountNavLabel();
  setActiveBottomNav('lessons');
  rerenderDashboard?.();
}

function openAccountScreen() {
  updateAccountNavLabel();
  setActiveBottomNav('login');
  renderAccountStatus();
}

function renderAccountStatus() {
  const appRoot = getAppRoot();
  if (!appRoot) return;
  updateAccountNavLabel();

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
  const access = getAccessState();
  const unlocked = access.fullUnlock;

  if (!auth.isLoggedIn) {
    accountScreen.innerHTML = `
      <section class="account-screen" aria-labelledby="status-title">
        <div class="account-card">
          <div class="account-brand">
            <img src="Images/dashboard thumbnails/Manku.webp" alt="SpeakUp" />
            <span>SpeakUp</span>
          </div>
          <h2 class="account-title" id="status-title">Account Status</h2>
          <p class="account-subtitle">Log in or create an account to manage access.</p>

          <div class="auth-mode-switch" aria-label="Account options">
            <button type="button" class="auth-mode-button" id="show-signup" data-auth-mode="signup" aria-selected="false">Sign Up</button>
          </div>

          <div class="auth-panel" id="login-panel">
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

            <div class="button-row">
              <button type="button" class="primary-button" id="login-button">Log In</button>
            </div>
          </div>

          <div class="auth-panel" id="signup-panel" hidden>
            <div class="login-form">
              <label for="signup-username">Username</label>
              <input
                id="signup-username"
                name="signup-username"
                type="text"
                placeholder="Choose a username"
                autocomplete="username"
                required
              />
            </div>

            <div class="login-form">
              <label for="signup-email">Email</label>
              <input
                id="signup-email"
                name="signup-email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
              />
            </div>

            <div class="login-form">
              <label for="signup-password">Password</label>
              <input
                id="signup-password"
                name="signup-password"
                type="password"
                placeholder="Create password"
                autocomplete="new-password"
                required
              />
            </div>

            <div class="login-form">
              <label for="signup-confirm-password">Confirm Password</label>
              <input
                id="signup-confirm-password"
                name="signup-confirm-password"
                type="password"
                placeholder="Confirm password"
                autocomplete="new-password"
                required
              />
            </div>

            <div class="button-row">
              <button type="button" class="primary-button" id="signup-button">Create Account</button>
            </div>

            <div class="button-row">
              <button type="button" class="secondary-button" id="back-to-login">Back to Log In</button>
            </div>
          </div>

          <p id="login-message" class="footer-note"></p>

          <div class="button-row">
            <button type="button" class="secondary-button" id="back-dashboard">Back to Dashboard</button>
          </div>
        </div>
      </section>
    `;

    const message = document.getElementById('login-message');
    const loginButton = document.getElementById('login-button');
    const signupButton = document.getElementById('signup-button');
    const loginPanel = document.getElementById('login-panel');
    const signupPanel = document.getElementById('signup-panel');
    const signupToggle = document.getElementById('show-signup');
    const backToLogin = document.getElementById('back-to-login');

    function setAuthMode(mode) {
      const isLogin = mode === 'login';
      loginPanel.hidden = !isLogin;
      signupPanel.hidden = isLogin;
      signupToggle?.classList.toggle('is-active', !isLogin);
      signupToggle?.setAttribute('aria-selected', String(!isLogin));
      signupToggle.hidden = !isLogin;
      if (message) message.textContent = '';
    }

    signupToggle?.addEventListener('click', () => setAuthMode('signup'));
    backToLogin?.addEventListener('click', () => setAuthMode('login'));

    loginButton?.addEventListener('click', async () => {
      if (!window.SUAuth?.loginWithEmail) {
        if (message) message.textContent = 'Authentication is unavailable right now. Refresh and try again.';
        return;
      }
      
      const email = document.getElementById('login-email')?.value?.trim() || '';
      const password = document.getElementById('login-password')?.value || '';

      if (!email || !password) {
        if (message) message.textContent = 'Please enter email and password.';
        return;
      }

      try {
        await window.SUAuth.loginWithEmail(email, password);

        const updatedAuth = getLoginState();
        const accessNow = getAccessState();
        const hasSomeAccess = accessNow.fullUnlock || (Array.isArray(accessNow.unlockedUnits) && accessNow.unlockedUnits.length > 0);

        if (updatedAuth.isLoggedIn && hasSomeAccess) {
          renderAccountStatus();
          showDashboardScreen();
        } else if (updatedAuth.isLoggedIn && !hasSomeAccess) {
          renderAccountStatus();
          if (message) message.textContent = 'Logged in. Only free lessons are available right now.';
        }
      } catch (error) {
        console.error(error);
        if (message) message.textContent = 'Login failed. Check email and password.';
      }
    });

    signupButton?.addEventListener('click', async () => {
      if (!window.SUAuth?.signupWithEmail) {
        if (message) message.textContent = 'Authentication is unavailable right now. Refresh and try again.';
        return;
      }

      const username = document.getElementById('signup-username')?.value?.trim() || '';
      const email = document.getElementById('signup-email')?.value?.trim() || '';
      const password = document.getElementById('signup-password')?.value || '';
      const confirmPassword = document.getElementById('signup-confirm-password')?.value || '';

      if (!username || !email || !password || !confirmPassword) {
        if (message) message.textContent = 'Please complete all sign up fields.';
        return;
      }

      if (password.length < 6) {
        if (message) message.textContent = 'Password must be at least 6 characters.';
        return;
      }

      if (password !== confirmPassword) {
        if (message) message.textContent = 'Passwords do not match.';
        return;
      }

      try {
        const result = await window.SUAuth.signupWithEmail(username, email, password);
        renderAccountStatus();
        if (message) {
          message.textContent = result?.profileSynced === false
            ? 'Account created, but profile setup is incomplete. Check Firestore rules.'
            : 'Account created. You can now request access.';
        }
      } catch (error) {
        console.error(error);
        if (message) message.textContent = 'Sign up failed. Try a different email.';
      }
    });
  } else {
    const license = window.SUAuth.getLicense();
    const profile = getProfileState();
    const expText = (license && license.licenseExpiresAt)
      ? new Date(license.licenseExpiresAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : null;
    const unlockedUnitsText = Array.isArray(license?.unlockedUnits) && license.unlockedUnits.length
      ? license.unlockedUnits.join(', ')
      : 'None yet';
    const displayName = profile?.username || auth.email || 'Unknown user';
    const profileInitial = String(displayName).trim().charAt(0).toUpperCase() || 'U';
    const unlockedCount = unlocked
      ? getDashboardContentCount()
      : (Array.isArray(license?.unlockedUnits) ? license.unlockedUnits.length : 0);
    const unlockedCountLabel = unlocked ? 'Available content' : 'Unlocked units';
    const greeting = getTimeGreeting();
    const lastOpenedUnitId = profile?.lastOpenedUnit || null;
    const lastOpenedUnitLabel = getLessonTitleById(lastOpenedUnitId) || lastOpenedUnitId || 'No lesson opened yet';
    const completedUnitsCount = Array.isArray(profile?.completedUnits) ? profile.completedUnits.length : 0;
    
    accountScreen.innerHTML = `
      <section class="login-card" aria-labelledby="status-title">
        <div class="account-hero ${unlocked ? 'is-premium' : 'is-limited'}">
          <div class="account-hero-top">
            <div class="profile-mark" aria-hidden="true">${profileInitial}</div>
            <div class="card-header">
              <p class="eyebrow">SpeakUp Account</p>
              <h2 id="status-title">${greeting}, ${displayName}</h2>
              <p class="hero-subtitle">${unlocked ? 'Your premium access is active and ready to use.' : 'Your learning profile is active with free and granted lessons.'}</p>
            </div>
          </div>

          <div class="hero-chips">
            <span class="hero-chip">${license?.role || 'user'}</span>
            <span class="hero-chip">${unlocked ? 'Full access' : 'Limited access'}</span>
          </div>
        </div>

        <div class="status-badge ${unlocked ? 'status-unlocked' : 'status-locked'}">
          ${unlocked ? 'Full Access ✅' : 'Limited Access 🔒'}
        </div>

        <div class="account-stats">
          <div class="account-stat">
            <span class="account-stat-label">Signed in as</span>
            <strong class="account-stat-value">${displayName}</strong>
          </div>
          <div class="account-stat">
            <span class="account-stat-label">Email</span>
            <strong class="account-stat-value">${auth.email || 'Not available'}</strong>
          </div>
          <div class="account-stat">
            <span class="account-stat-label">${unlockedCountLabel}</span>
            <strong class="account-stat-value">${unlockedCount}</strong>
          </div>
        </div>

        <div class="premium-box progress-box">
          <h3 class="premium-title">Progress Tracker</h3>
          <p class="premium-sub">Your latest lesson and completed units are saved automatically while you learn.</p>

          <div class="progress-grid">
            <div class="progress-item">
              <span class="progress-label">Last opened unit</span>
              <strong class="progress-value">${lastOpenedUnitLabel}</strong>
            </div>
            <div class="progress-item">
              <span class="progress-label">Completed units</span>
              <strong class="progress-value">${completedUnitsCount}</strong>
            </div>
          </div>

          ${
            lastOpenedUnitId
              ? `
                <div class="cta-row">
                  <button type="button" id="continue-learning-button" class="primary-btn">Continue Learning</button>
                </div>
              `
              : ''
          }
        </div>

        ${
          unlocked
          ? `
            <div class="premium-box">
              <h3 class="premium-title">Speak Up Premium</h3>
              <p class="premium-sub">Every lesson is open on this device. Keep learning even when the internet is unstable.</p>
              ${expText ? `<div class="price-row"><span class="price-label">Offline until</span><span class="price-value">${expText}</span></div>` : ''}
            </div>
          `
          : `
            <div class="premium-box">
              <h3 class="premium-title">Current Access</h3>
              <p class="premium-sub">Free lessons are always available. Extra units come from your Firestore profile.</p>
    
              <ul class="premium-list">
                <li>✔ Free lessons</li>
                <li>✔ Individually unlocked units</li>
                <li>✔ Expiry-ready access model</li>
              </ul>
    
              <div class="price-row">
                <span class="price-label">Unlocked units</span>
                <span class="price-value">${unlockedUnitsText}</span>
              </div>

              <div class="cta-row">
                <button type="button" id="buy-button" class="primary-btn">Buy Now</button>
              </div>
              <p class="footer-note">Tip: Sign in again anytime to refresh your granted units from Firestore.</p>
            </div>
          `
        }

        <div class="account-actions">
          <button type="button" id="back-dashboard" class="ghost-btn">Back to Dashboard</button>
          <button type="button" id="signout-btn" class="ghost-btn">Sign out</button>
        </div>
    
        <p class="footer-note account-note">Access expiry support is enabled.</p>
      </section>
    `;

    if (!unlocked) {
      document.getElementById('buy-button')?.addEventListener('click', () => {
        alert('Access will be enabled by the Speak Up team.');
      });
    }

    document.getElementById('continue-learning-button')?.addEventListener('click', () => {
      const savedCard = getLessonCardById(lastOpenedUnitId) || { id: String(lastOpenedUnitId) };
      const baseRoute = getRouteForCard(savedCard);
      if (!baseRoute) return;
      window.location.href = appendQueryParam(baseRoute, 'from', 'dashboard');
    });
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

  refreshButton?.addEventListener('click', () => {
    saveScrollPosition();
    window.location.reload();
  });

  mainContent?.addEventListener('scroll', saveScrollPosition, { passive: true });
  window.addEventListener('pagehide', saveScrollPosition);
  window.addEventListener('beforeunload', saveScrollPosition);


  const navButtons = document.querySelectorAll('.bottom-nav .nav-button');
  
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

  function getLastLessonKey() {
    return 'scroll:dashboard:last-lesson';
  }

  function saveScrollPosition() {
    if (!mainContent) return;
    sessionStorage.setItem(getScrollKey(), String(mainContent.scrollTop || 0));
  }

  function saveLastOpenedLesson(id) {
    if (!id) return;
    sessionStorage.setItem(getLastLessonKey(), String(id));
  }

  function restoreLastOpenedLessonIntoView() {
    if (!mainContent || !lessonsList) return false;
    const lessonId = sessionStorage.getItem(getLastLessonKey());
    if (!lessonId) return false;

    const targetCard = Array.from(lessonsList.querySelectorAll('[data-lesson-id]'))
      .find((card) => String(card.dataset.lessonId) === String(lessonId));
    if (!targetCard) return false;

    const containerRect = mainContent.getBoundingClientRect();
    const targetRect = targetCard.getBoundingClientRect();
    const nextScrollTop = mainContent.scrollTop + (targetRect.top - containerRect.top) - 24;
    mainContent.scrollTop = Math.max(0, nextScrollTop);
    return true;
  }

  function restoreScrollPosition() {
    if (!mainContent) return;
    const value = sessionStorage.getItem(getScrollKey());
    const next = value == null ? Number.NaN : Number(value);

    const applyRestore = () => {
      if (!Number.isNaN(next)) {
        mainContent.scrollTop = next;
        return;
      }
      restoreLastOpenedLessonIntoView();
    };

    requestAnimationFrame(applyRestore);
    requestAnimationFrame(() => requestAnimationFrame(applyRestore));
  }

  async function navigateToLesson(id) {
    // find the full card so resolveRoute can honour overrides and future per-card routes
    const card = dashboardLessons.find(c => c.id === id);
    if (!card) {
      console.warn('No card found for id:', id);
      return;
    }
    if (!hasLessonAccess(id)) {
      openAccountScreen();
      return;
    }
    try {
      await window.SUAuth?.saveProgress?.(id, 0);
    } catch (error) {
      console.warn('Could not save initial lesson progress.', error);
    }
    saveLastOpenedLesson(id);
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

      const access = getAccessState();
      const isFree = isFreeLesson(lesson.id);
      const hasAccess = hasLessonAccess(lesson.id);
      const progress = getLessonProgressState(lesson.id);
      let badge = '';

      if (progress.isCompleted) {
        badge = '<span class="lesson-badge completed">Completed</span>';
      } else if (progress.isInProgress) {
        badge = '<span class="lesson-badge in-progress">In Progress</span>';
      } else if (!access.fullUnlock) {
        badge = hasAccess
          ? (isFree ? '<span class="lesson-badge free">Free</span>' : '')
          : '<span class="lesson-badge locked">Locked</span>';
      }

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
