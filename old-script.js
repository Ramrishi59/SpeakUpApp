// Define your lessons, organized by unit
const lessons = {
    // Unit 1: Hello (example - you'd add words/phrases here as you prepare assets)
    unit1: {
        name: "Unit 1: Hello",
        description: "Learn greetings and character names.",
        words: [
            // Example: Based on Speak Up 1 Full Text Unit 1
            // You'll need images and audio for these (e.g., Images/hi.png, Audio/hi.mp3)
            // { text: "Hi", image: "Images/hi.png", audio: "Audio/hi.mp3" },
            // { text: "Hello", image: "Images/hello.png", audio: "Audio/hello.mp3" },
            // { text: "My name is Thomas.", image: "Images/thomas.png", audio: "Audio/my_name_is_thomas.mp3" }
        ]
    },
    
    // Unit 2: a, an (Your existing 13 words go here)
    unit2: {
        name: "Unit 2: a, an",
        description: "Learn about indefinite articles with common objects.",
        words: [
            { text: "a book", image: "Images/a book.png", audio: "Audio/a book.mp3" },
            { text: "a pencil", image: "Images/a pencil.png", audio: "Audio/a pencil.mp3" },
            { text: "a pen", image: "Images/a pen.png", audio: "Audio/a pen.mp3" },
            { text: "a crayon", image: "Images/a crayon.png", audio: "Audio/a crayon.mp3" },
            { text: "a ruler", image: "Images/a ruler.png", audio: "Audio/a ruler.mp3" },
            { text: "a bag", image: "Images/a bag.png", audio: "Audio/a bag.mp3" },
            { text: "a table", image: "Images/a table.png", audio: "Audio/a table.mp3" },
            { text: "a chair", image: "Images/a chair.png", audio: "Audio/a chair.mp3" },
            { text: "an apple", image: "Images/an apple.png", audio: "Audio/an apple.mp3" },
            { text: "an orange", image: "Images/an orange.png", audio: "Audio/an orange.mp3" },
            { text: "an egg", image: "Images/an egg.png", audio: "Audio/an egg.mp3" },
            { text: "an eraser", image: "Images/an eraser.png", audio: "Audio/an eraser.mp3" },
            { text: "an elephant", image: "Images/an elephant.png", audio: "Audio/an elephant.mp3" }
        ]
    },

    // Unit 3: What is it? (You'll fill this as you prepare assets)
    unit3: {
        name: "Unit 3: What is it?",
        description: "Ask and answer questions about objects.",
        words: [
            // Example: Based on Speak Up 1 Full Text Unit 3
            // { text: "What is this?", image: "Images/question_mark.png", audio: "Audio/what_is_this.mp3" },
            // { text: "It is a pencil.", image: "Images/it_is_a_pencil.png", audio: "Audio/it_is_a_pencil.mp3" },
            // { text: "It is an ice cream.", image: "Images/it_is_an_ice_cream.png", audio: "Audio/it_is_an_ice_cream.mp3" }
        ]
    }
    // ... Add more units here (unit4, unit5, etc.) as you prepare their content
};

// This will hold the words for the currently active lesson
let activeWords = []; 
// And this will track the currently selected lesson ID
let currentLessonId = null;

let currentWordIndex = 0;
let starsCollected = 0; // To keep track of stars

// Audio files for encouragement and sound effects (ensure these files exist in Audio/ folder)
const encouragementAudios = [
    "Audio/great_job.mp3",
    "Audio/excellent.mp3",
    "Audio/you_got_it.mp3"
];
const chimeAudio = "Audio/chime.mp3"; // Path to your chime sound

// Helper function to get a URL parameter - MOVED TO TOP FOR CLARITY
function getUnitIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('unitId'); // Gets the value of the 'unitId' parameter
}

// THIS IS THE CRUCIAL CHANGE: EVERYTHING BELOW THIS LINE RUNS ONLY AFTER HTML IS LOADED
document.addEventListener('DOMContentLoaded', () => {

    // Get references to HTML elements (NOW INSIDE DOMContentLoaded)
    // Screen Elements
    const unitSelectionScreen = document.getElementById('unitSelectionScreen'); 
    const wordDisplayScreen = document.getElementById('wordDisplayScreen');   

    // Word Display Elements
    const wordImage = document.getElementById('wordImage');
    const wordText = document.getElementById('wordText');
    // const speakButton = document.getElementById('speakButton'); // This button is commented out in HTML
    const nextButton = document.getElementById('nextButton');
    const previousButton = document.getElementById('prevButton'); // Reference for previous button (id="prevButton")
    const startoverButton = document.getElementById('startoverButton'); // Reference for start over button
    const starCountDisplay = document.getElementById('starCount');

    // Button Collections (for event delegation)
    const unitButtons = document.querySelectorAll('.unit-button');           
    const dashboardButtons = document.querySelectorAll('.dashboard-button'); 
    const backButtons = document.querySelectorAll('.back-button');           

    // --- Start of helper functions ---

    // Function to show a specific screen and hide others
    function showScreen(screenId) {
        // Hide all screens first (add new screens here as you create them)
        // Ensure these IDs actually exist in your old-index.html
        if (unitSelectionScreen) unitSelectionScreen.classList.remove('active');
        if (wordDisplayScreen) wordDisplayScreen.classList.remove('active');
        
        // Show the requested screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active'); // Add 'active' class to show
        }
    }

    // Function to load the current word's data into the display
    function loadWord() {
        if (activeWords.length === 0) { // Handle case if a unit has no words yet
            console.warn("No words in the active lesson.");
            if (wordImage) wordImage.src = ""; // Clear image
            if (wordText) wordText.textContent = "Select a unit!"; // Display message
            return;
        }
        const word = activeWords[currentWordIndex];
        if (wordImage) {
            wordImage.src = word.image;
            wordImage.alt = word.text;
        }
        if (wordText) {
            wordText.textContent = word.text;
        }
    }

    // Generic function to play any specific audio file by its path
    function playSingleAudio(audioPath) {
        if (!audioPath) return;
        const audio = new Audio(audioPath);
        audio.play().catch(e => console.error("Audio playback failed:", e));
    }

    // Event handler for when the word/button is interacted with
    function handleWordInteraction() {
        if (activeWords[currentWordIndex] && activeWords[currentWordIndex].audio) {
            playSingleAudio(activeWords[currentWordIndex].audio);
        }
    }

    // Function to load a specific unit
    function loadUnit(unitId) {
        currentLessonId = unitId; // Store the active lesson ID
        activeWords = lessons[unitId].words; // Set activeWords to the selected unit's words
        currentWordIndex = 0; // Reset word index for the new unit
        starsCollected = 0; // Reset stars for new unit (if starting a new lesson)
        if (starCountDisplay) starCountDisplay.textContent = starsCollected; // Update display
        
        loadWord(); // Load the first word of the new unit
        
        // Ensure next button is enabled for a new lesson
        if (nextButton) nextButton.classList.remove('disabled');
        console.log(`Loaded unit: ${lessons[unitId].name}`);
    }

    // --- End of helper functions ---

    if (wordImage) {
        wordImage.addEventListener('click', handleWordInteraction);
    }

    // Event listener for the NEXT button
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            // Immediately disable the button to prevent rapid clicks
            nextButton.classList.add('disabled'); 
            console.log("Next button clicked. currentWordIndex:", currentWordIndex);
            console.log("activeWords.length:", activeWords.length); 

            if (currentWordIndex < activeWords.length - 1) { // If not on the last word
                console.log("Moving to next word.");
                currentWordIndex++;
                loadWord();
                // Re-enable the button AFTER the new word has loaded (or a brief moment)
                setTimeout(() => { 
                    nextButton.classList.remove('disabled');
                }, 100); 
            } else {
                // We are on the last word, and Next is clicked
                console.log("Reached the last word, playing excellent audio and then disabling Next button.");

                starsCollected++; 
                if (starCountDisplay) {
                    starCountDisplay.textContent = starsCollected;
                    console.log("Stars after increment (display updated):", starsCollected);
                } else {
                    console.log("Error: starCountDisplay element not found!");
                }
                
                // Play excellent audio
                const excellentAudio = new Audio("Audio/excellent.mp3");
                excellentAudio.play().catch(e => console.error("Excellent audio playback failed:", e));
                playSingleAudio(chimeAudio)

                // ONLY disable the button AFTER the audio finishes, and KEEP it disabled
                excellentAudio.onended = () => {
                    if (nextButton) {
                        nextButton.classList.add('disabled'); // Keep disabled after completion
                    }
                    console.log("Excellent audio finished, Next button now permanently disabled for this cycle.");
                };
            }
        });
    }

    // Event listener for the PREVIOUS button
    if (previousButton) {
        previousButton.addEventListener('click', () => {
            console.log("Previous button clicked. currentWordIndex:", currentWordIndex);
            if (currentWordIndex > 0) { // Only go back if not on the first word
                currentWordIndex--;
                loadWord();
                // Ensure next button is re-enabled when going back
                if (nextButton) {
                    nextButton.classList.remove('disabled');
                }
            }
        });
    }

    // Event listener for the Start Over button
    if (startoverButton) {
        startoverButton.addEventListener('click', () => {
            currentWordIndex = 0;
            loadWord();
            // When starting over, ensure the next button is re-enabled
            if (nextButton) {
                nextButton.classList.remove('disabled');
            }
            console.log('Start Over button clicked, resetting to first word and re-enabling Next button.');
        });
    }

    // Add event listeners for all Back Buttons
    // These are still relevant as they navigate within the old-index.html structure
    // Add event listeners for all Back Buttons
    backButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetScreenId = button.dataset.screen; 

        // If the button is meant to go back to the main dashboard OR unit selection (which is now replaced by new dashboard)
        if (targetScreenId === 'mainDashboardScreen' || targetScreenId === 'unitSelectionScreen') {
            // Redirect to the new dashboard (index.html)
            window.location.href = 'index.html'; 
        } else {
            // For any other internal screen transitions within old-index.html (if they exist)
            showScreen(targetScreenId);
        }

        // Optionally, reset current word index or other state if going back
        currentWordIndex = 0;
        if (nextButton) nextButton.classList.remove('disabled'); 
    });
});

    // >>>>> THIS IS THE CRUCIAL PART FOR INITIAL LOADING <<<<<
    // Initial app state: Determine which screen to show based on URL or default
    const initialUnitId = getUnitIdFromUrl(); // Use the helper function defined above

    if (initialUnitId && lessons[initialUnitId]) {
        // If a unit ID is found in the URL and it's a valid lesson, load it
        loadUnit(initialUnitId);
        showScreen('wordDisplayScreen'); // Ensure this screen is activated
    } else {
        // This 'else' block means 'old-index.html' was opened directly WITHOUT a unitId parameter,
        // which shouldn't happen if navigation always comes from the new dashboard.
        // We'll redirect to the new dashboard in this case for a seamless experience.
        console.warn("old-index.html loaded without a specific unitId. Redirecting to new dashboard.");
        window.location.href = 'index.html'; // Redirect to the main dashboard
    }

    console.log("old-script.js loaded and all interactions set up!");
}); // End of DOMContentLoaded listener