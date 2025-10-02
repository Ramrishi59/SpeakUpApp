const dashboardLessons = [
    {
      id: 'unit1', // new trial page
      title: 'Unit 1: A / An',
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
      title: 'Unit 2: And',
      description: 'Learn And. Just watch, listen and repeat',
      thumbnail: 'Images/Unit2/andthumbnail.webp'
    },
    {
      id: 'unit3',
      title: 'Unit 3: This and That',
      description: 'Learn about This and That. Just watch, listen and repeat',
      thumbnail: 'Images/Unit3/This_That.webp'
    },
    {
      id: 'unit4',
      title: 'Unit 4: What is this?',
      description: 'What is this?',
      thumbnail: 'Images/Unit4/thumbnail.jpg'
    },
    {
      id: 'unit5',
      title: 'Unit 5: What is that?',
      description: 'What is that?',
      thumbnail: 'Images/Unit5/thumbnail.jpg'
    },
    {
      id: 'unit6',
      title: 'Unit 6: Is this a cat?',
      description: 'Is this a cat?',
      thumbnail: 'Images/Unit6/1.webp'
    },
    {
      id: 'unit7',
      title: 'Unit 7: Is that a mountain?',
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
      id: 'unit10',
      title: 'Unit 10: Those are butterflies',
      description: 'Vocabulary set: classroom objects, fruits, animals, and more (plurals).',
      thumbnail: 'Images/Unit10/1.webp'
    },
    {
      id: 'unit11',
      title: 'Unit 11: Are these apples?',
      description: 'Vocabulary set: classroom objects, fruits, animals, and more (plurals).',
      thumbnail: 'Images/Unit11/1.webp'
    },
    {
      id: 'unit12',
      title: 'Unit 12: Are these water bottles?',
      description: 'Vocabulary set: classroom objects, fruits, animals, and more (plurals).',
      thumbnail: 'Images/Unit12/1.webp'
    },
    {
      id: 'unit13',
      title: 'Unit 13: Are they cars?',
      description: 'Vocabulary set: classroom objects, fruits, animals, and more (plurals).',
      thumbnail: 'Images/Unit13/1.webp'
    },
    {
      id: 'unit14',
      title: 'Unit 14: Are they…? Negative answers',
      description: 'Vocabulary set: classroom objects, fruits, animals, and more (plurals).',
      thumbnail: 'Images/Unit14/1.webp'
    },
    {
      id: 'unit15',
      title: 'Unit 15: I am a girl',
      description: 'Vocabulary set: classroom objects, fruits, animals, and more (plurals).',
      thumbnail: 'Images/Unit15/1.webp'
    },
    {
      id: 'unit16',
      title: 'Unit 16: Is he a boy?',
      description: 'Vocabulary set: classroom objects, fruits, animals, and more (plurals).',
      thumbnail: 'Images/Unit16/1.webp'
    },
    {
      id: 'unit20',
      title: 'Unit20: But',
      description: 'Learn simple daily activities (eat, play, sleep), use "I eat," "I play," "I sleep," and relate to time of day.',
      thumbnail: 'Images/Unit20/thumbnail.svg'
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
      'unit11': (id) => `Trial.html?unitId=unit11`,
      'unit12': (id) => `Trial.html?unitId=unit12`,
      'unit13': (id) => `Trial.html?unitId=unit13`,
      'unit14': (id) => `Trial.html?unitId=unit14`,
      'unit15': (id) => `Trial.html?unitId=unit15`,
      'unit16': (id) => `Trial.html?unitId=unit16`,
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
  