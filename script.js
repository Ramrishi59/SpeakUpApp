let dashboardLessons = [];


document.addEventListener('DOMContentLoaded', async () => {
  const lessonsList = document.querySelector('.lessons-list');
  const searchInput = document.querySelector('.search-input');
  await loadDashboardLessons();

  const navButtons = document.querySelectorAll('.bottom-nav .nav-button');

  // -------- Routing (centralised) --------
  // Special routes (only when a card needs a custom file)
  // Special routes (only when a card needs a custom file)
  const ROUTE_OVERRIDES = {
    'unit1-practice': () => 'an-quiz/an-quiz.html',
    'and-practice': () => 'and-practice/and.html'
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

  // -------------------------------
// Load dashboard lessons from manifest.json
// -------------------------------
async function loadDashboardLessons() {
  try {
    const res = await fetch('units/manifest.json?v=1'); // bump version when you update
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


  function navigateToLesson(id) {
    // find the full card so resolveRoute can honour overrides and future per-card routes
    const card = dashboardLessons.find(c => c.id === id);
    if (!card) {
      console.warn('No card found for id:', id);
      return;
    }
    window.location.href = resolveRoute(card);
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

      // click
      card.addEventListener('click', () => navigateToLesson(lesson.id));
      // keyboard Enter/Space
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigateToLesson(lesson.id);
        }
      });

      lessonsList.appendChild(card);
    });
  }

  // initial render
  renderLessonCards(dashboardLessons);

  // -------- Search --------
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = dashboardLessons.filter(lesson =>
        lesson.title.toLowerCase().includes(q) ||
        lesson.description.toLowerCase().includes(q)
      );
      renderLessonCards(filtered);
    });
  }

  // -------- Bottom nav --------
  if (navButtons) {
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const target = btn.dataset.navTarget;
        if (target !== 'lessons') {
          alert(`The "${target.charAt(0).toUpperCase() + target.slice(1)}" section is not yet implemented.`);
        }
      });
    });
  }

  console.log("Dashboard ready.");
});
