const dashboardLessons = [
    {
      id: 'unit2', // new trial page
      title: 'A / An',
      description: 'Learn A and An. Just watch, listen and repeat',
      thumbnail: 'Images/Unit1/a_an_thumbnail.jpg'
    },
    {
      id: 'unit1',
      title: 'My Family',
      description: 'Learn about family with Manku!',
      thumbnail: 'Images/Unit1/familydash.jpg'
    },
    {
      id: 'unit2-toys',
      title: 'My Favourite Toys',
      description: 'Learn about toys with Manku!',
      thumbnail: 'Images/Unit1/toysdash.png'
    },
    {
      id: 'unit3',
      title: 'My Happy Day',
      description: 'Learn simple daily activities (eat, play, sleep), use "I eat," "I play," "I sleep," and relate to time of day.',
      thumbnail: 'Images/Unit1/happyday.png'
    },
    {
      id: 'history-of-art',
      title: 'History of Art',
      description: 'Discover the history of art movements, styles, and famous artists across the world',
      thumbnail: 'Images/Unit1/a_an_thumbnail.jpg'
    }
  ];
  
  document.addEventListener('DOMContentLoaded', () => {
    const lessonsList = document.querySelector('.lessons-list');
    const searchInput = document.querySelector('.search-input');
    const navButtons = document.querySelectorAll('.bottom-nav .nav-button');
  
    // -------- Routing (centralised) --------
    const ROUTES = {
      // point Unit 2 to the new trial page
      'unit2': (id) => `Trial.html?unitId=${id}`,
  
      // existing pages (unchanged)
      'unit2-toys': () => 'unit2.html',
      'unit1':      () => 'unit1.html',
  
      // default fallback: old index with query (works for future JSON units)
      '__default': (id) => `old-index.html?unitId=${id}`
    };
  
    function navigateToLesson(id) {
      const build = ROUTES[id] || ROUTES['__default'];
      window.location.href = build(id);
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
  