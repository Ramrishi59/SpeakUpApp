// Define your list of words, their images, and their audio files
const words = [
    { text: "a book", image: "Images/a book.png", audio: "Audio/a book.mp3" },
    { text: "a pencil", image: "images/a pencil.png", audio: "audio/a pencil.mp3" },
    { text: "a pen", image: "images/a pen.png", audio: "audio/a pen.mp3" },
    { text: "a crayon", image: "images/a crayon.png", audio: "audio/a crayon.mp3" },
    { text: "a ruler", image: "images/a ruler.png", audio: "audio/a ruler.mp3" },
    { text: "a bag", image: "images/a bag.png", audio: "audio/a bag.mp3" },
    { text: "a table", image: "images/a table.png", audio: "audio/a table.mp3" },
    { text: "a chair", image: "images/a chair.png", audio: "audio/a chair.mp3" },
    { text: "an apple", image: "Images/an apple.png", audio: "Audio/an apple.mp3" },
    { text: "an orange", image: "images/an orange.png", audio: "audio/an orange.mp3" },
    { text: "an egg", image: "images/an egg.png", audio: "audio/an egg.mp3" },
    { text: "an eraser", image: "images/an eraser.png", audio: "audio/an eraser.mp3" },
    { text: "an elephant", image: "images/an elephant.png", audio: "audio/an elephant.mp3" }
];

// Audio files for encouragement and sound effects
const encouragementAudios = [
    "audio/great_job.mp3",
    "audio/excellent.mp3",
    "audio/you_got_it.mp3"
    // Add paths to all your encouragement audios here if you have more
];
const chimeAudio = "audio/chime.mp3"; // Path to your chime sound

let currentWordIndex = 0;
let starsCollected = 0; // To keep track of stars

// Get references to HTML elements
const wordImage = document.getElementById('wordImage');
const wordText = document.getElementById('wordText');
const speakButton = document.getElementById('speakButton');
const nextButton = document.getElementById('nextButton');
const prevButton = document.getElementById('prevButton'); // Reference to the previous button
const starCountDisplay = document.getElementById('starCount');

// Function to load the current word's data into the display
function loadWord() {
    const word = words[currentWordIndex];
    wordImage.src = word.image;
    wordImage.alt = word.text;
    wordText.textContent = word.text;
}

// Generic function to play any specific audio file by its path
function playSingleAudio(audioPath) {
    if (!audioPath) return; // Prevent error if path is undefined
    const audio = new Audio(audioPath);
    audio.play();
}

// Function to play a random encouragement audio (now only used at lesson completion)
function playEncouragement() {
    const randomIndex = Math.floor(Math.random() * encouragementAudios.length);
    playSingleAudio(encouragementAudios[randomIndex]);
}

// Event handler for when the word/button is interacted with (now only plays word audio)
function handleWordInteraction() {
    const wordAudio = new Audio(words[currentWordIndex].audio);
    wordAudio.play();
}

// Add event listeners
speakButton.addEventListener('click', handleWordInteraction);
wordImage.addEventListener('click', handleWordInteraction);

// Event listener for the NEXT arrow
nextButton.addEventListener('click', () => {
    const nextIndex = (currentWordIndex + 1); // Calculate what the NEXT index WILL be

    // Check for lesson completion BEFORE updating currentWordIndex and loading the new word
    if (nextIndex === words.length) { // If the NEXT index will be the very end of the array (meaning a full cycle completed)
        // Trigger lesson complete actions
        starsCollected++; // Give one final star for completing the cycle
        starCountDisplay.textContent = starsCollected; // Update the display

        playEncouragement(); // Play encouragement first
        playSingleAudio(chimeAudio); // Play chime immediately after encouragement starts

        // Optional: Reset stars after a short delay for a new lesson cycle to begin visually
        // setTimeout(() => {
        //     starsCollected = 0;
        //     starCountDisplay.textContent = starsCollected;
        // }, 3000); // Reset after 3 seconds, adjust as needed
    }

    // Now update the currentWordIndex and load the word for the NEXT cycle
    currentWordIndex = nextIndex % words.length; // Use modulo to wrap around
    loadWord(); // Load the new word
});

// Event listener for the PREVIOUS arrow
prevButton.addEventListener('click', () => {
    // Move backward in the array, handles wrapping to the end
    currentWordIndex = (currentWordIndex - 1 + words.length) % words.length;
    loadWord(); // Load the new word
    // No encouragement for backward navigation
});

// Load the very first word when the script loads, ensuring HTML elements are ready
document.addEventListener('DOMContentLoaded', loadWord);

console.log("script.js loaded and all interactions set up!");