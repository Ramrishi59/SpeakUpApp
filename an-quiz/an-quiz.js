// A / An — 3-item smoke test (with auto-advance on audio end)

const ITEMS = [
  { noun: "orange",   correct: "An", image: "Images/an_orange.png",   audio: "Audio/u1_c1_item_21_an_orange.mp3" },
  { noun: "elephant", correct: "An", image: "Images/an_elephant.png", audio: "Audio/u1_c1_item_25_an_elephant.mp3" },
  { noun: "umbrella", correct: "An", image: "Images/an_umbrella.png", audio: "Audio/u1_c1_item_23_an_umbrella.mp3" },
];

const TRY_AGAIN = "Audio/not-correct.mp3";

// Elements
const imgEl      = document.getElementById("wordImage");
const textEl     = document.getElementById("wordText");
const feedbackEl = document.getElementById("feedback");
const btnA       = document.getElementById("btnA");
const btnAn      = document.getElementById("btnAn");
const prevBtn    = document.getElementById("prevBtn");
const nextBtn    = document.getElementById("nextBtn");
const resetBtn   = document.getElementById("resetBtn");
const imageWrap  = document.querySelector(".image-wrap");

// ★ Stars row
const starsContainer = document.getElementById("starsContainer");

// State
let index = 0;
let totalCorrect = 0;
let answeredThisItem = false;
let currentAudio = null;

// Auto-advance helpers
let autoAdvanceTimer = null;
let autoAdvanceBound = null; // the 'ended' listener we attach
const AUTO_ADVANCE_PAD_MS = 200;
const AUTO_ADVANCE_FALLBACK_MS = 6000;

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
  a.play().catch(() => {}); // ignore autoplay errors for effects
  return a;
}

function setFeedback(msg = "") { feedbackEl.textContent = msg; }

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
  if (textEl) textEl.textContent = item.noun;

  prevBtn.disabled = (i === 0);
}

function handleChoice(choice) {
  if (answeredThisItem) return;
  const item = ITEMS[index];
  const isCorrect = (choice === item.correct);

  if (isCorrect) {
    answeredThisItem = true;
    setFeedback(`${item.correct} ${item.noun}`);
    imageWrap.classList.add("correct-sparkle");
    (choice === "A" ? btnA : btnAn).classList.add("correct");

    totalCorrect += 1;
    addStar(); // ⭐

    // Play the phrase and advance when it ends (with safety fallback)
    const a = playSound(item.audio);

    autoAdvanceBound = () => { autoAdvanceBound = null; next(); };
    if (a) a.addEventListener("ended", autoAdvanceBound, { once: true });

    const expected = a && isFinite(a.duration) && a.duration > 0
      ? Math.min(a.duration * 1000 + AUTO_ADVANCE_PAD_MS, AUTO_ADVANCE_FALLBACK_MS)
      : 1800;
    autoAdvanceTimer = setTimeout(() => { next(); }, expected);

  } else {
    setFeedback("Try again!");
    (choice === "A" ? btnA : btnAn).classList.add("incorrect");
    playSound(TRY_AGAIN);
  }
}

function prev() {
  clearAutoAdvance();
  if (index > 0) index -= 1;
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
  if (starsContainer) starsContainer.innerHTML = ""; // clear ⭐
  renderItem(index);
}

// Events
btnA.addEventListener("click", () => handleChoice("A"));
btnAn.addEventListener("click", () => handleChoice("An"));
prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);
resetBtn.addEventListener("click", resetAll);

// Preload item images (+ star to avoid first-pop flicker)
ITEMS.forEach(it => { const im = new Image(); im.src = it.image; });
(function preloadStar(){ const im = new Image(); im.src = 'Images/star.png'; })();

// Init
renderItem(index);

// ===== Intro overlay logic =====
const introEl   = document.getElementById('practiceIntro');
const playBtnEl = document.getElementById('introPlayBtn');
const appEl     = document.getElementById('app');

const introAudio = new Audio('Audio/intro.mp3'); // ensure this path exists
introAudio.preload = 'auto';

let introStarted = false;
let introFinished = false;
let introFallbackTimer = null;

function showQuiz() {
  appEl.classList.remove('hidden');
}

function endIntro() {
  if (introFinished) return;
  introFinished = true;
  try { introAudio.pause(); introAudio.currentTime = 0; } catch {}
  if (introFallbackTimer) clearTimeout(introFallbackTimer);
  introEl?.remove();
  showQuiz();
}

function armFallback(ms = 2800) {
  if (introFallbackTimer) clearTimeout(introFallbackTimer);
  introFallbackTimer = setTimeout(endIntro, ms);
}

async function handleIntroStart(e) {
  if (introStarted) return;
  introStarted = true;

  if (playBtnEl) playBtnEl.style.display = 'none';
  armFallback(2800);

  try {
    await introAudio.play();
    introAudio.addEventListener('ended', endIntro, { once: true });
  } catch {
    // muted/blocked → fallback will end the intro
  }
}

(function initIntro() {
  if (!introEl) { showQuiz(); return; }
  introEl.addEventListener('click', handleIntroStart, { once: true });
  playBtnEl?.addEventListener('click', handleIntroStart, { once: true });
})();

// ===== Stars: pop + glow on add =====
function addStar() {
  if (!starsContainer) return;
  const star = new Image();
  star.src = 'Images/star.png';      // <-- confirm path
  star.alt = 'Star';
  star.className = 'star star--pop';
  star.addEventListener('animationend', () => {
    star.classList.remove('star--pop');
  }, { once: true });
  starsContainer.appendChild(star);
}
