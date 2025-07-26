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
    "Audio/excellent.mp3", // Only 'excellent' will be used for completion now
    "Audio/you_got_it.mp3"
];
const chimeAudio = "Audio/chime.mp3"; // Path to your chime sound

let currentWordIndex = 0;
let starsCollected = 0; // To keep track of stars

// THIS IS THE CRUCIAL CHANGE: EVERYTHING BELOW THIS LINE RUNS ONLY AFTER HTML IS LOADED
document.addEventListener('DOMContentLoaded', () => {

    // Get references to HTML elements
    const wordImage = document.getElementById('wordImage');
    const wordText = document.getElementById('wordText');
    const speakButton = document.getElementById('speakButton');
    const nextButton = document.getElementById('nextButton');
    const previousButton = document.getElementById('prevButton'); // Reference for previous button (id="prevButton")
    const startoverButton = document.getElementById('startoverButton'); // Reference for start over button
    const starCountDisplay = document.getElementById('starCount');

    // --- Start of helper functions ---

    // Function to load the current word's data into the display
    function loadWord() {
        const word = words[currentWordIndex];
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
        if (words[currentWordIndex] && words[currentWordIndex].audio) {
            playSingleAudio(words[currentWordIndex].audio);
        }
    }

    // --- End of helper functions ---


    // Add event listeners
    if (speakButton) {
        speakButton.addEventListener('click', handleWordInteraction);
    }
    if (wordImage) {
        wordImage.addEventListener('click', handleWordInteraction);
    }

    // Event listener for the NEXT button (UPDATED LOGIC)
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            console.log("Next button clicked. currentWordIndex:", currentWordIndex);
            if (currentWordIndex < words.length - 1) { // If not on the last word
                currentWordIndex++;
                loadWord();
                // Ensure next button is enabled if it was disabled
                nextButton.disabled = false;
            } else {
                // We are on the last word, and Next is clicked
                console.log("Reached the last word, playing excellent audio and disabling Next button.");
                playSingleAudio("Audio/excellent.mp3"); // Play excellent audio directly
                if (nextButton) {
                    nextButton.disabled = true; // Disable the next button
                }
                // Stars and chime are no longer here, as per your request
            }
        });
    }

    // Event listener for the PREVIOUS button (logic remains same, stops at first)
    if (previousButton) {
        previousButton.addEventListener('click', () => {
            console.log("Previous button clicked. currentWordIndex:", currentWordIndex);
            if (currentWordIndex > 0) { // Only go back if not on the first word
                currentWordIndex--;
                loadWord();
                // If the next button was disabled from a previous completion, re-enable it
                if (nextButton && nextButton.disabled) {
                    nextButton.disabled = false;
                }
            }
        });
    }

    // NEW: Event listener for the Start Over button (logic remains same)
    if (startoverButton) {
        startoverButton.addEventListener('click', () => {
            currentWordIndex = 0;
            loadWord();
            // When starting over, ensure the next button is re-enabled
            if (nextButton) {
                nextButton.disabled = false;
            }
            console.log('Start Over button clicked, resetting to first word and re-enabling Next button.');
        });
    }

    // Load the very first word when the script loads, ensuring HTML elements are ready
    loadWord();

    console.log("script.js loaded and all interactions set up!");
}); // End of DOMContentLoaded listener