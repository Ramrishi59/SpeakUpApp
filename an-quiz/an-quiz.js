// A / An — 3-item smoke test (with auto-advance on audio end)

const ITEMS = [
    { noun: "orange",   correct: "An", image: "Images/an_orange.png",   audio: "Audio/u1_c1_item_21_an_orange.mp3" },
    { noun: "elephant", correct: "An", image: "Images/an_elephant.png", audio: "Audio/u1_c1_item_25_an_elephant.mp3" },
    { noun: "umbrella", correct: "An", image: "Images/an_umbrella.png", audio: "Audio/u1_c1_item_23_an_umbrella.mp3" },
  ];
  
  const TRY_AGAIN = "Audio/AnQuiz/try_again.mp3";
  
  // Elements
  const imgEl = document.getElementById("wordImage");
  const textEl = document.getElementById("wordText");
  const feedbackEl = document.getElementById("feedback");
  const starCountEl = document.getElementById("starCount");
  const btnA = document.getElementById("btnA");
  const btnAn = document.getElementById("btnAn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const resetBtn = document.getElementById("resetBtn");
  const imageWrap = document.querySelector(".image-wrap");
  
  // State
  let index = 0;
  let totalCorrect = 0;
  let stars = 0;
  let answeredThisItem = false;
  let currentAudio = null;
  
  // Auto-advance helpers
  let autoAdvanceTimer = null;
  let autoAdvanceBound = null; // the 'ended' listener we attach
  const AUTO_ADVANCE_PAD_MS = 200;   // small pause after audio ends
  const AUTO_ADVANCE_FALLBACK_MS = 6000; // safety if 'ended' never fires
  
  function clearAutoAdvance() {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    if (currentAudio && autoAdvanceBound) {
      currentAudio.removeEventListener("ended", autoAdvanceBound);
      autoAdvanceBound = null;
    }
  }
  
  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
  }
  
  function playSound(src) {
    if (!src) return null;
    stopAudio();
    const a = new Audio(src);
    currentAudio = a;
    a.play().catch(() => {});
    return a; // IMPORTANT: return the element so we can wait for 'ended'
  }
  
  function setFeedback(msg = "") { feedbackEl.textContent = msg; }
  
  function updateStars() {
    const newStars = Math.floor(totalCorrect / 3); // 1 star per 3 correct
    if (newStars !== stars) {
      stars = newStars;
      starCountEl.textContent = String(stars);
    }
  }
  
  function clearChoiceStates() {
    btnA.classList.remove("correct", "incorrect");
    btnAn.classList.remove("correct", "incorrect");
    imageWrap.classList.remove("correct-sparkle");
  }
  
  function renderItem(i) {
    const item = ITEMS[i];
    if (!item) return;
  
    clearAutoAdvance();
    stopAudio();
    answeredThisItem = false;
    clearChoiceStates();
    setFeedback("");
  
    imgEl.src = item.image;
    imgEl.alt = item.noun;
    if (textEl) textEl.textContent = item.noun; // <-- guard
  
    prevBtn.disabled = (i === 0);
  }
  
  
  function handleChoice(choice) {
    if (answeredThisItem) return;
    const item = ITEMS[index];
    const isCorrect = (choice === item.correct);
  
    if (isCorrect) {
      answeredThisItem = true;
      setFeedback(`${item.correct} ${item.noun}. Great!`);
      imageWrap.classList.add("correct-sparkle");
      (choice === "A" ? btnA : btnAn).classList.add("correct");
  
      totalCorrect += 1;
      updateStars();
  
      // Play the phrase and advance when it ENDS
      const a = playSound(item.audio);
  
      // 1) Advance on 'ended'
      autoAdvanceBound = () => {
        autoAdvanceBound = null;
        next();
      };
      if (a) a.addEventListener("ended", autoAdvanceBound, { once: true });
  
      // 2) Safety fallback (in case 'ended' doesn't fire)
      //    Use a.duration if available; otherwise cap to fallback.
      const expected = a && isFinite(a.duration) && a.duration > 0
        ? Math.min(a.duration * 1000 + AUTO_ADVANCE_PAD_MS, AUTO_ADVANCE_FALLBACK_MS)
        : 1800; // reasonable default if duration unknown
      autoAdvanceTimer = setTimeout(() => { next(); }, expected);
  
    } else {
      setFeedback("Try again!");
      (choice === "A" ? btnA : btnAn).classList.add("incorrect");
      playSound(TRY_AGAIN);
    }
  }
  
  function prev() {
    clearAutoAdvance();
    if (index > 0) {
      index -= 1;
    }
    renderItem(index);
  }
  
  function next() {
    clearAutoAdvance();
    if (index < ITEMS.length - 1) {
      index += 1;
    } else {
      index = 0; // wrap (or keep at last if you prefer)
    }
    renderItem(index);
  }
  
  function resetAll() {
    clearAutoAdvance();
    stopAudio();
    index = 0;
    totalCorrect = 0;
    stars = 0;
    starCountEl.textContent = "0";
    renderItem(index);
  }
  
  // Events
  btnA.addEventListener("click", () => handleChoice("A"));
  btnAn.addEventListener("click", () => handleChoice("An"));
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  resetBtn.addEventListener("click", resetAll);
  
  // Preload images (optional)
  ITEMS.forEach(it => { const im = new Image(); im.src = it.image; });
  
  // Init
  renderItem(index);
  
  // ===== Robust Intro overlay logic =====
const introEl   = document.getElementById('practiceIntro');
const playBtnEl = document.getElementById('introPlayBtn');
const appEl     = document.getElementById('app');

const introAudio = new Audio('Audio/intro.mp3');
introAudio.preload = 'auto';

let introStarted = false;
let introFinished = false;
let introFallbackTimer = null;
let quizInitialized = false;

// Ensure the quiz is ready the moment we reveal it.
function ensureQuizInit() {
  if (!quizInitialized) {
    // renderItem(index) must exist from your quiz code:
    try { renderItem(index); } catch (e) {}
    quizInitialized = true;
  }
}

function showQuiz() {
  ensureQuizInit();
  appEl.classList.remove('hidden');
}

function endIntro() {
  if (introFinished) return;
  introFinished = true;

  // Safety: stop audio and timers
  try { introAudio.pause(); introAudio.currentTime = 0; } catch (e) {}
  if (introFallbackTimer) clearTimeout(introFallbackTimer);

  // Remove the overlay immediately so it can’t block clicks
  if (introEl && introEl.parentNode) {
    introEl.parentNode.removeChild(introEl);
  }
  showQuiz();
}

// Proceed even if audio never fires 'ended' (max ~3s)
function armFallback(ms = 2800) {
  if (introFallbackTimer) clearTimeout(introFallbackTimer);
  introFallbackTimer = setTimeout(endIntro, ms);
}

async function handleIntroStart(ev) {
  if (introStarted) return;
  introStarted = true;

  // hide the button so kids know it started
  if (playBtnEl) playBtnEl.style.display = 'none';

  // Start a fallback timer NOW (in case audio won’t play)
  armFallback(2800);

  try {
    await introAudio.play();
    // If it *does* play, end when finished (and the fallback will be cleared)
    introAudio.addEventListener('ended', () => endIntro(), { once: true });
  } catch (err) {
    // Autoplay blocked / device muted / etc. — just proceed via fallback
    // (No-op: fallback timer will fire)
  }
}

// Start wiring once DOM is ready (your script is defer, so DOM is ready)
(function initIntro() {
  if (!introEl) {
    // No intro in DOM → just show the quiz
    showQuiz();
    return;
  }
  // Let user tap either the button or the whole screen
  playBtnEl?.addEventListener('click', handleIntroStart, { once: true });
  introEl.addEventListener('click', handleIntroStart, { once: true });
})();
