let activeWords = []; 
let currentLessonId = null;
let currentWordIndex = 0;
let starsCollected = 0; 

const unitId = getUnitIdFromUrl();


const encouragementAudios = [
    "Audio/great_job.mp3",
    "Audio/excellent.mp3",
    "Audio/you_got_it.mp3"
];
const chimeAudio = "Audio/chime.mp3"; 

function getUnitIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('unitId'); 
}

async function fetchUnitData(unitId) {
    try {
        const response = await fetch(`units/${unitId}.json`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const unitData = await response.json();
        return unitData;
    } catch (error) {
        console.error(`Could not fetch unit data for ${unitId}:`, error);
        alert("Failed to load lesson. Please try again or select a different lesson.");
        window.location.href = 'index.html';
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const wordDisplayScreen = document.getElementById('wordDisplayScreen');   
    const wordImage = document.getElementById('wordImage');
    const wordText = document.getElementById('wordText');
    const nextButton = document.getElementById('nextButton');
    const previousButton = document.getElementById('prevButton'); 
    const startoverButton = document.getElementById('startoverButton'); 
    const starCountDisplay = document.getElementById('starCount');
    const backButtons = document.querySelectorAll('.back-button');           

    function showScreen(screenId) {
        document.querySelectorAll('.full-screen-center').forEach(screen => {
          screen.classList.remove('active'); // 🔴 remove from all others
        });
      
        const target = document.getElementById(screenId);
        if (target) {
          target.classList.add('active');    // ✅ Add it to the visible one
          console.log(`✅ Showing screen: ${screenId}`);
        } else {
          console.warn(`Screen not found: ${screenId}`);
        }
      }
      
    

    function loadWord() {
        if (activeWords.length === 0) {
            console.warn("❌ No words in the active lesson.");
            wordImage.src = "";
            wordText.textContent = "Select a unit!";
            return;
        }
    
        const word = activeWords[currentWordIndex];
        console.log("✅ Loading word:", word);
    
        wordImage.src = word.image;
        wordImage.alt = word.text;
        wordText.textContent = word.text;

        if (previousButton) {
            if (currentWordIndex === 0) {
                previousButton.classList.add('disabled');
            } else {
                previousButton.classList.remove('disabled');
            }
        }

        if (nextButton) {
            if (currentWordIndex === activeWords.length - 1) {
                nextButton.classList.add('disabled');
            } else {
                nextButton.classList.remove('disabled');
            }
        }
    
        console.log("Image src is:", wordImage.src);
        console.log("Image visible?", getComputedStyle(wordImage).display);
        console.log("Text content is:", wordText.textContent);

    }
    

    function playSingleAudio(audioPath) {
        if (!audioPath) return;
        const audio = new Audio(audioPath);
        audio.play().catch(e => console.error("Audio playback failed:", e));
    }

    function handleWordInteraction() {
        if (activeWords[currentWordIndex]?.audio) {
            playSingleAudio(activeWords[currentWordIndex].audio);
        }
    }

    function loadUnit(unitData) {
        currentLessonId = unitData.id; 
        console.log("unitData.words =", unitData.words);
        activeWords = unitData.words; 
        currentWordIndex = 0; 
        starsCollected = 0; 
        if (starCountDisplay) starCountDisplay.textContent = starsCollected; 
        loadWord(); 
        if (nextButton) nextButton.classList.remove('disabled');
        console.log(`Loaded unit: ${unitData.name}`); 
        
    }

    if (wordImage) wordImage.addEventListener('click', handleWordInteraction);

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            nextButton.classList.add('disabled');
    
            if (currentWordIndex < activeWords.length - 1) {
                currentWordIndex++;
                loadWord();
                // Removed playSingleAudio(chimeAudio) from here
                setTimeout(() => nextButton.classList.remove('disabled'), 100);
            } else {
                // This is the LAST word
                starsCollected++;
                if (starCountDisplay) {
                    starCountDisplay.textContent = starsCollected;
                }
                // Now chimeAudio plays ONLY on the last word
                playSingleAudio(chimeAudio); // <--- Moved here    
                const excellentAudio = new Audio("Audio/excellent.mp3");
                excellentAudio.play().catch(e => console.error("Audio playback failed:", e));
                setTimeout(() => nextButton.classList.add('disabled'), 100); // Re-enable for safety or just keep it disabled
            }
        });
    }

    if (previousButton) {
        previousButton.addEventListener('click', () => {
            if (currentWordIndex > 0) {
                currentWordIndex--;
                loadWord();
                nextButton?.classList.remove('disabled');
            }
        });
    }

    if (startoverButton) {
        startoverButton.addEventListener('click', () => {
            currentWordIndex = 0;
            loadWord();
            nextButton?.classList.remove('disabled');
        });
    }

    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            window.location.href = 'index.html'; 
            currentWordIndex = 0; 
            nextButton?.classList.remove('disabled');
        });
    });

    const unitId = "unit2";
    const unitData = await fetchUnitData(unitId); 
    if (unitData) {
        loadUnit(unitData);
        showScreen('wordDisplayScreen');
    } else {
        console.error("No unit data found or fetch failed.");
        alert("Could not load the lesson.");
        window.location.href = "index.html";
    }

    console.log("✅ a-an.js loaded successfully");
});
