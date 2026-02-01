let dashboardLessons = [];
let categories = new Map(); // category -> { items: [], collectionCard }
let rootCards = [];
let currentCategory = null; // null = main view

function appendQueryParam(url, key, value) {
  if (!value) return url;
  const [base, hash] = url.split('#');
  const sep = base.includes('?') ? '&' : '?';
  const next = `${base}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  return hash ? `${next}#${hash}` : next;
}

function setCategoryInUrl(cat) {
  const url = new URL(window.location.href);
  if (cat) {
    url.searchParams.set('cat', cat);
  } else {
    url.searchParams.delete('cat');
  }
  window.history.replaceState({}, '', url.toString());
}

document.addEventListener('DOMContentLoaded', async () => {
  const lessonsList = document.querySelector('.lessons-list');
  const searchInput = document.querySelector('.search-input');
  const searchLabel = document.querySelector('.search-label');
  const searchBar = document.querySelector('.search-bar');
  const searchIcon = document.querySelector('.search-icon');
  const refreshButton = document.querySelector('.refresh-button');
  const optionsSection = document.querySelector('.options-section');
  const backButton = document.createElement('button');
  backButton.textContent = '‹ Back';
  backButton.className = 'back-button hidden';
  optionsSection?.appendChild(backButton);
  await loadDashboardLessons();
  buildCategories();
  const params = new URLSearchParams(window.location.search);
  const initialCat = params.get('cat');
  const returnCat = sessionStorage.getItem('returnCategory');
  if (initialCat && categories.has(initialCat)) {
    currentCategory = initialCat;
  } else if (returnCat && categories.has(returnCat)) {
    currentCategory = returnCat;
    setCategoryInUrl(returnCat);
  }
  if (returnCat) sessionStorage.removeItem('returnCategory');

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
    const res = await fetch('units/manifest.json?v=7'); // bump version when you update
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
  } catch (e) {
    console.error('Could not load manifest.json:', e);
    // Optional fallback (only during testing)
    // dashboardLessons = [ /* paste your old array here if needed */ ];
  }
}

function deriveCategory(card) {
  if (card.category) return card.category;
  if (card.route && card.route.startsWith('choosequiz/')) return 'choose';
  if (card.id && card.id.startsWith('unit')) return 'units';
  if (card.id && card.id.includes('practice')) return 'practice';
  return 'other';
}

function labelizeCategory(cat) {
  if (cat === 'choose') return 'Choose the right option';
  if (cat === 'units') return "Let's Learn";
  if (cat === 'practice') return 'Practice';
  if (cat === 'order') return 'Make the sentence';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function buildCategories() {
  categories = new Map();

  dashboardLessons.forEach(card => {
    const cat = deriveCategory(card);
    if (!categories.has(cat)) {
      categories.set(cat, { items: [], collectionCard: null });
    }
    categories.get(cat).items.push(card);
  });

  // Sort choose quiz activities ascending by number (e.g., activity1, activity2, ...)
  const chooseCategory = categories.get('choose');
  if (chooseCategory) {
    chooseCategory.items.sort((a, b) => {
      const getNum = (card) => {
        const sources = [
          card?.id,
          card?.route,
          card?.title
        ];
        for (const src of sources) {
          const match = String(src || '').match(/activity(\d+)/i) || String(src || '').match(/quiz[-\s]?(\d+)/i);
          if (match) return Number(match[1]);
        }
        return Number.MAX_SAFE_INTEGER;
      };
      return getNum(a) - getNum(b);
    });
  }

  // Build collection cards with preferred ordering
  const preferredOrder = ['units', 'choose'];
  const otherCats = Array.from(categories.keys()).filter(c => !preferredOrder.includes(c) && c !== 'other');
  const orderedCats = [...preferredOrder, ...otherCats];

  rootCards = [];

  // Add collections first
  orderedCats.forEach(cat => {
    const value = categories.get(cat);
    if (!value || cat === 'other') return;
    const collectionCard = {
      id: `collection-${cat}`,
      title: labelizeCategory(cat),
      description: `Browse ${labelizeCategory(cat)}`,
      thumbnail: value.items[0]?.thumbnail || 'Images/icon.png',
      category: cat,
      isCollection: true
    };
    value.collectionCard = collectionCard;
    rootCards.push(collectionCard);
  });

  // Then append non-collection items (category 'other')
  const otherCategory = categories.get('other');
  if (otherCategory) {
    rootCards.push(...otherCategory.items);
  }
}


  function navigateToLesson(id) {
    // find the full card so resolveRoute can honour overrides and future per-card routes
    const card = dashboardLessons.find(c => c.id === id);
    if (!card) {
      console.warn('No card found for id:', id);
      return;
    }
    const navCategory = currentCategory || deriveCategory(card);
    if (navCategory && navCategory !== 'other') {
      setCategoryInUrl(navCategory);
      sessionStorage.setItem('returnCategory', navCategory);
    } else {
      sessionStorage.removeItem('returnCategory');
    }
    // Use overrides when present, else default resolver
    const baseRoute = getRouteForCard(card);
    const route = appendQueryParam(baseRoute, 'from', navCategory);
    window.location.href = route;
  }


  // -------- Render cards --------
  function renderLessonCards(lessonsToRender) {
    if (!lessonsList) return;
    lessonsList.innerHTML = '';
    lessonsToRender.forEach(lesson => {
      const card = document.createElement('div');
      card.classList.add('lesson-card');
      card.dataset.lessonId = lesson.id;
      card.tabIndex = 0; // keyboard focusable

      card.innerHTML = `
          <img src="${lesson.thumbnail}" alt="${lesson.title}" class="lesson-thumbnail" loading="lazy">
          <div class="lesson-info">
            <h3>${lesson.title}</h3>
            <p>${lesson.description}</p>
          </div>
          <span class="forward-arrow">›</span>
        `;

      const isCollection = lesson.isCollection;
      const handleClick = () => {
        if (isCollection && lesson.category) {
          switchToCategoryView(lesson.category);
        } else {
          navigateToLesson(lesson.id);
        }
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
      const activeList = currentCategory ? (categories.get(currentCategory)?.items || []) : rootCards;
      const filtered = activeList.filter(lesson =>
        lesson.title.toLowerCase().includes(q) ||
        lesson.description.toLowerCase().includes(q)
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
    const cardsToRender = currentCategory ? (categories.get(currentCategory)?.items || []) : rootCards;
    renderLessonCards(cardsToRender);
    if (searchLabel) {
      searchLabel.textContent = currentCategory ? labelizeCategory(currentCategory) : 'Lessons';
    }
    if (backButton) {
      backButton.classList.toggle('hidden', !currentCategory);
    }
  }

  function switchToCategoryView(cat) {
    currentCategory = cat;
    setCategoryInUrl(cat);
    if (searchInput) searchInput.value = '';
    renderCurrentView();
  }

  function switchToMainView() {
    currentCategory = null;
    setCategoryInUrl(null);
    if (searchInput) searchInput.value = '';
    renderCurrentView();
  }

  backButton?.addEventListener('click', switchToMainView);

  // -------- Bottom nav --------
  if (navButtons) {
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const target = btn.dataset.navTarget;
        if (target === 'lessons') {
          // Always return to the dashboard
          window.location.href = 'index.html';
        } else {
          alert(`The "${target.charAt(0).toUpperCase() + target.slice(1)}" section is not yet implemented.`);
        }
      });
    });
  }

  console.log("Dashboard ready.");
});
