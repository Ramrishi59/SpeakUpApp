const words = [
    // For now, let's start with just one word.
    // You will add more words, images, and audio files here later.
    { text: "Apple", image: "images/apple.png", audio: "audio/apple.mp3" }
];

let currentWordIndex = 0;

// Get references to HTML elements
const wordImage = document.getElementById('wordImage');
const wordText = document.getElementById('wordText');
const speakButton = document.getElementById('speakButton');
const nextButton = document.getElementById('nextButton');

// Function to load the current word's data into the display
function loadWord() {
    const word = words[currentWordIndex];
    wordImage.src = word.image; // Set the image source
    wordImage.alt = word.text;   // Set alt text for accessibility
    wordText.textContent = word.text; // Display the word text
}

// Function to play the audio for the current word
function playAudio() {
    const audio = new Audio(words[currentWordIndex].audio);
    audio.play();
}

// Add event listeners: when buttons/image are clicked, do something
speakButton.addEventListener('click', playAudio);
wordImage.addEventListener('click', playAudio); // Make the image itself clickable

nextButton.addEventListener('click', () => {
    // Move to the next word in the array
    currentWordIndex = (currentWordIndex + 1) % words.length; // % operator makes it loop back to 0
    loadWord(); // Load the new word
});

// Load the very first word when the script loads
loadWord();

console.log("script.js loaded and basic interactions set up!");