const dashboardLessons = [
    {
      id: 'unit1', // new trial page
      title: 'A / An',
      description: 'Learn A and An. Just watch, listen and repeat',
      thumbnail: 'Images/Unit1/anthumbnail.png'
    },
    {
      id: 'unit1-practice',
      title: 'Pracrice Session- Unit 1',
      description: 'Practice',
      thumbnail: 'an-quiz/Images/introquiz.webp'
    },
    {
      id: 'unit2',
      title: 'And',
      description: 'Learn And. Just watch, listen and repeat',
      thumbnail: 'Images/Unit2/andthumbnail.webp'
    },
    {
      id: 'unit3',
      title: 'This and That',
      description: 'Learn about This and That. Just watch, listen and repeat',
      thumbnail: 'Images/Unit3/This_That.webp'
    },
    {
      id: 'unit4',
      title: 'What is this?',
      description: 'What is this?',
      thumbnail: 'Images/Unit4/thumbnail.jpg'
    },
    {
      id: 'unit5',
      title: 'What is that?',
      description: 'What is that?',
      thumbnail: 'Images/Unit5/thumbnail.jpg'
    },
    {
      id: 'unit6',
      title: 'Is this a cat?',
      description: 'Is this a cat?',
      thumbnail: 'Images/Unit6/1.webp'
    },
    {
      id: 'unit7',
      title: 'Is that a mountain?',
      description: 'Is that a mountain?',
      thumbnail: 'Images/Unit7/1.webp'
    },
    {
      id: 'unit8',
      title: 'Unit 8: Books, Pencils"',
      description: 'Vocabulary set: classroom objects, fruits, animals, and more (plurals).',
      thumbnail: 'Images/Unit8/1.webp'
    },
    {
      id: 'unit9',
      title: 'Unit 9: These are bananas',
      description: 'Vocabulary set: classroom objects, fruits, animals, and more (plurals).',
      thumbnail: 'Images/Unit9/1.webp'
    },
    {
      id: 'unit20',
      title: 'But',
      description: 'Learn simple daily activities (eat, play, sleep), use "I eat," "I play," "I sleep," and relate to time of day.',
      thumbnail: 'Images/Unit8/thumbnail.svg'
    },
    {
      id: 'and-practice',
      title: 'And Practice',
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
      // Both cards (unit1 + unit2) point to the same file for now
      'unit1': (id) => `Trial.html?unitId=unit1`,
      'unit2': (id) => `Trial.html?unitId=unit2`,  // 👈 force unit2 card to also load unit1.json
      'unit3': (id) => `Trial.html?unitId=unit3`,
      'unit4': (id) => `Trial.html?unitId=unit4`,
      'unit5': (id) => `Trial.html?unitId=unit5`,
      'unit6': (id) => `Trial.html?unitId=unit6`,
      'unit7': (id) => `Trial.html?unitId=unit7`,
      'unit8': (id) => `Trial.html?unitId=unit8`,
      'unit9': (id) => `Trial.html?unitId=unit9`,
      'unit10': (id) => `Trial.html?unitId=unit10`,
      'unit20': (id) => `Trial.html?unitId=unit20`,
       // Practice sessions → point to their folders
      'unit1-practice': () => 'an-quiz/an-quiz.html',
      'and-practice': () => 'and-practice/and.html',

      // default fallback
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
  