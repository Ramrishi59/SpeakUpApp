const words = [
    { text: "a book", image: "images/a book.png", audio: "audio/a book.mp3" },
    { text: "a pencil", image: "images/a pencil.png", audio: "audio/a pencil.mp3" },
    { text: "a pen", image: "images/a pen.png", audio: "audio/a pen.mp3" },
    { text: "a crayon", image: "images/a crayon.png", audio: "audio/a crayon.mp3" },
    { text: "a ruler", image: "images/a ruler.png", audio: "audio/a ruler.mp3" },
    { text: "a bag", image: "images/a bag.png", audio: "audio/a bag.mp3" },
    { text: "a table", image: "images/a table.png", audio: "audio/a table.mp3" },
    { text: "a chair", image: "images/a chair.png", audio: "audio/a chair.mp3" },
    { text: "an apple", image: "images/an apple.png", audio: "audio/an apple.mp3" },
    { text: "an orange", image: "images/an orange.png", audio: "audio/an orange.mp3" },
    { text: "an egg", image: "images/an egg.png", audio: "audio/an egg.mp3" },
    { text: "an eraser", image: "images/an eraser.png", audio: "audio/an eraser.mp3" },
    { text: "an elephant", image: "images/an elephant.png", audio: "audio/an elephant.mp3" }

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