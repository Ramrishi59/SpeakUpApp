const dashboardLessons = [
    {
        id: 'unit2', // Corresponds to the unit ID in old-script.js
        title: 'A / An',
        description: 'Learn A and An. Just watch, listen and repeat',
        thumbnail: 'Images/a_an_thumbnail.jpg' // You'll need to create this image
    },
    {
        id: 'science-experiment',
        title: 'Science Experiment',
        description: 'Conduct experiments to learn about the physical properties of matter, including density and buoyancy',
        thumbnail: 'Images/a_an_thumbnail.jpg' // Placeholder thumbnail
    },
    {
        id: 'programming-basics',
        title: 'Programming Basics',
        description: 'Learn the basics of computer programming, including data structures and algorithms',
        thumbnail: 'Images/a_an_thumbnail.jpg' // Placeholder thumbnail
    },
    {
        id: 'environmental-conservation',
        title: 'Environmental Conservation',
        description: 'Understand the importance of protecting the environment and ways to make a positive impact',
        thumbnail: 'Images/a_an_thumbnail.jpg' // Placeholder thumbnail
    },
    {
        id: 'history-of-art',
        title: 'History of Art',
        description: 'Discover the history of art movements, styles, and famous artists across the world',
        thumbnail: 'Images/a_an_thumbnail.jpg' // Placeholder thumbnail
    }
];

document.addEventListener('DOMContentLoaded', () => {
    const lessonsList = document.querySelector('.lessons-list');
    const searchInput = document.querySelector('.search-input');
    const navButtons = document.querySelectorAll('.bottom-nav .nav-button');

    // Function to render lesson cards
    function renderLessonCards(lessonsToRender) {
        lessonsList.innerHTML = ''; // Clear existing cards
        lessonsToRender.forEach(lesson => {
            const lessonCard = document.createElement('div');
            lessonCard.classList.add('lesson-card');
            lessonCard.dataset.lessonId = lesson.id; // Store the ID for later use

            lessonCard.innerHTML = `
                <img src="${lesson.thumbnail}" alt="${lesson.title}" class="lesson-thumbnail">
                <div class="lesson-info">
                    <h3>${lesson.title}</h3>
                    <p>${lesson.description}</p>
                </div>
                <span class="forward-arrow">></span>
            `;
            lessonsList.appendChild(lessonCard);
        });
    }

    // Initial render of all lessons
    renderLessonCards(dashboardLessons);

    // Event Listener for Search Input
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredLessons = dashboardLessons.filter(lesson =>
                lesson.title.toLowerCase().includes(searchTerm) ||
                lesson.description.toLowerCase().includes(searchTerm)
            );
            renderLessonCards(filteredLessons);
        });
    }

    // Event Listener for Lesson Card Clicks
    // Using event delegation on the parent container
    if (lessonsList) {
        lessonsList.addEventListener('click', (e) => {
            const clickedCard = e.target.closest('.lesson-card');
            if (clickedCard) {
                const lessonId = clickedCard.dataset.lessonId;
                console.log(`Clicked on lesson: ${lessonId}`);

                // === CRITICAL INTEGRATION POINT ===
                // For now, we'll only navigate to 'A / An' (unit2) which uses your old-index.html
                // For other lessons, we'll show an alert.
                if (lessonId === 'unit2') {
                    // Redirect to the old-index.html (now word-display-screen.html)
                    // and pass the unitId as a URL parameter
                    window.location.href = `old-index.html?unitId=${lessonId}`;
                } else {
                    alert(`The "${dashboardLessons.find(l => l.id === lessonId)?.title}" lesson is not yet ready!`);
                }
            }
        });
    }

    // Event Listeners for Bottom Navigation Buttons
    if (navButtons) {
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove 'active' from all buttons
                navButtons.forEach(btn => btn.classList.remove('active'));
                // Add 'active' to the clicked button
                button.classList.add('active');

                const target = button.dataset.navTarget;
                if (target === 'lessons') {
                    // Do nothing, already on lessons screen
                    console.log("Already on Lessons screen.");
                } else {
                    alert(`The "${target.charAt(0).toUpperCase() + target.slice(1)}" section is not yet implemented.`);
                }
            });
        });
    }

    console.log("New dashboard script.js loaded!");
});

