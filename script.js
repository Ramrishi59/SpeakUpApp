// Define your list of words, their images, and their audio files
const words = [
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
];

// Audio files for encouragement and sound effects (ensure these files exist in Audio/ folder)
const encouragementAudios = [
    "Audio/great_job.mp3",
    "Audio/excellent.mp3",
    "Audio/you_got_it.mp3"
];
const chimeAudio = "Audio/chime.mp3"; // Path to your chime sound

let currentWordIndex = 0;
let starsCollected = 0; // To keep track of stars

// THIS IS THE CRUCIAL CHANGE: EVERYTHING BELOW THIS LINE RUNS ONLY AFTER HTML IS LOADED
document.addEventListener('DOMContentLoaded', () => {

    // Get references to HTML elements (NOW INSIDE DOMContentLoaded)
    const wordImage = document.getElementById('wordImage');
    const wordText = document.getElementById('wordText');
    const speakButton = document.getElementById('speakButton');
    const nextButton = document.getElementById('nextButton');
    const prevButton = document.getElementById('prevButton'); // Reference to the previous button
    const starCountDisplay = document.getElementById('starCount');

    // --- Start of helper functions (can be outside or inside, but it's fine here) ---

    // Function to load the current word's data into the display
    function loadWord() {
        const word = words[currentWordIndex];
        if (wordImage) { // Check if element exists before setting properties
            wordImage.src = word.image;
            wordImage.alt = word.text;
        }
        if (wordText) { // Check if element exists before setting properties
            wordText.textContent = word.text;
        }
    }

    // Generic function to play any specific audio file by its path
    function playSingleAudio(audioPath) {
        if (!audioPath) return; // Prevent error if path is undefined
        const audio = new Audio(audioPath);
        audio.play().catch(e => console.error("Audio playback failed:", e)); // Add error handling
    }

    // Function to play a random encouragement audio (now only used at lesson completion)
    function playEncouragement() {
        const randomIndex = Math.floor(Math.random() * encouragementAudios.length);
        playSingleAudio(encouragementAudios[randomIndex]);
    }

    // Event handler for when the word/button is interacted with (now only plays word audio)
    function handleWordInteraction() {
        if (words[currentWordIndex] && words[currentWordIndex].audio) {
            playSingleAudio(words[currentWordIndex].audio);
        }
    }

    // --- End of helper functions ---


    // Add event listeners (NOW INSIDE DOMContentLoaded, after elements are gotten)
    if (speakButton) { // Added null check for safety
        speakButton.addEventListener('click', handleWordInteraction);
    }
    if (wordImage) { // Added null check for safety
        wordImage.addEventListener('click', handleWordInteraction);
    }

    // Event listener for the NEXT arrow
    if (nextButton) { // Added null check for safety
        nextButton.addEventListener('click', () => {
            const nextIndex = (currentWordIndex + 1); // Calculate what the NEXT index WILL be

            // Check for lesson completion BEFORE updating currentWordIndex and loading the new word
            if (nextIndex === words.length) { // If the NEXT index will be the very end of the array (meaning a full cycle completed)
                // Trigger lesson complete actions
                starsCollected++; // Give one final star for completing the cycle
                if (starCountDisplay) { // Check if element exists before updating
                    starCountDisplay.textContent = starsCollected; // Update the display
                }

                playEncouragement(); // Play encouragement first
                playSingleAudio(chimeAudio); // Play chime immediately after encouragement starts
            }

            // Now update the currentWordIndex and load the word for the NEXT cycle
            currentWordIndex = nextIndex % words.length; // Use modulo to wrap around
            loadWord(); // Load the new word
        });
    }

    // Event listener for the PREVIOUS arrow
    if (prevButton) { // Added null check for safety
        prevButton.addEventListener('click', () => {
            // Move backward in the array, handles wrapping to the end
            currentWordIndex = (currentWordIndex - 1 + words.length) % words.length;
            loadWord(); // Load the new word
            // No encouragement for backward navigation
        });
    }

    // Load the very first word when the script loads, ensuring HTML elements are ready
    loadWord(); // Call loadWord here, as DOMContentLoaded guarantees elements are present.

    console.log("script.js loaded and all interactions set up!");
}); // End of DOMContentLoaded listener