let activeWords = []; 
let currentLessonId = null;
let currentWordIndex = 0;
let starsCollected = 0; 
let currentAudio = null;
let isPlaying = false;


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
          if (wordImage) wordImage.src = "";
          if (wordText)  wordText.textContent = "Select a unit!";
          return;
        }
      
        // always stop any currently playing audio before rendering new content
        stopAudio();
      
        const word = activeWords[currentWordIndex];
        const hint = document.querySelector('.hint-text');
      
        // TEXT
        if (wordText) wordText.textContent = word.text || "";
      
        // IMAGE + HINT
        if (word && word.image) {
          wordImage.style.display = "block";
          wordImage.src = word.image;
          wordImage.alt = word.text || "";
          if (hint) hint.style.display = "block";
        } else {
          wordImage.style.display = "none";
          if (hint) hint.style.display = "none";
        }
      
        // AUTOPLAY using the shared player (no stacking)
        if (word.audio) {
          playAudio(word.audio);
        }
      
        // NAV BUTTON STATES
        if (previousButton) {
          previousButton.classList.toggle('disabled', currentWordIndex === 0);
        }
        if (nextButton) {
          nextButton.classList.toggle('disabled', currentWordIndex === activeWords.length - 1);
        }
      }
      

      function stopAudio() {
        if (currentAudio) {
          currentAudio.onended = null;
          try { currentAudio.pause(); } catch {}
          try { currentAudio.currentTime = 0; } catch {}
          currentAudio.src = ""; // release
        }
        isPlaying = false;
      }
      
      function playAudio(src, onEnded = null) {
        stopAudio(); // ensure nothing else is playing
        if (!src) return;
        currentAudio = new Audio(src);
        nextButton?.classList.add('disabled'); // lock while playing
        currentAudio.onended = () => {
          isPlaying = false;
          nextButton?.classList.remove('disabled'); // unlock
          if (typeof onEnded === "function") onEnded();
        };
        currentAudio.play()
          .then(() => { isPlaying = true; })
          .catch(e => {
            console.warn("Audio autoplay blocked or failed:", e);
            isPlaying = false;
          });
      }
      
      
    

    // function playSingleAudio(audioPath) {
    //     if (!audioPath) return;
    //     const audio = new Audio(audioPath);
    //     audio.play().catch(e => console.error("Audio playback failed:", e));
    // }

    function handleWordInteraction() {
        if (activeWords[currentWordIndex]?.audio) {
            playAudio(activeWords[currentWordIndex].audio);
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
        if (word.audio) {
            playAudio(word.audio);
          }
        
    }

    if (wordImage) wordImage.addEventListener('click', handleWordInteraction);

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            nextButton.classList.add('disabled');

            stopAudio(); // Stop any current audio when moving to the next word
    
            if (currentWordIndex < activeWords.length - 1) {
                currentWordIndex++;
                loadWord();
                
                setTimeout(() => nextButton.classList.remove('disabled'), 100);
            } else {
                // This is the LAST word
                starsCollected++;
                if (starCountDisplay) {
                    starCountDisplay.textContent = starsCollected;
                }
                // Now chimeAudio plays ONLY on the last word
                playAudio(chimeAudio); // <--- Moved here    
                const excellentAudio = new Audio("Audio/excellent.mp3");
                excellentAudio.play().catch(e => console.error("Audio playback failed:", e));
                setTimeout(() => nextButton.classList.add('disabled'), 100); // Re-enable for safety or just keep it disabled
            }
        });
    }

    if (previousButton) {
        previousButton.addEventListener('click', () => {
            stopAudio(); // Stop any current audio when moving to the previous word
            if (currentWordIndex > 0) {
                currentWordIndex--;
                loadWord();
                nextButton?.classList.remove('disabled');
            }
        });
    }

    if (startoverButton) {
        startoverButton.addEventListener('click', () => {
            stopAudio(); // Stop any current audio when starting over
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
