// quiz3.js — 3-option "Fill the blank" quiz

// ----------------------------
// DATA
// ----------------------------

/**
 * Each item = one slide
 * - sentence: text with ___ as the blank
 * - choices: 3 options (e.g. ["A", "An", "The"])
 * - correctIndex: index in choices[]
 * - audioQuestion: optional — sentence audio
 * - audioCorrect / audioWrong: optional — feedback audio
 */
const quizItems = [
  {
    image: "./Images/2.webp", // ensure relative to this activity folder
    sentence: "___ boat and ___ ship.",
    choices: ["A", "An", "The"],
    correctIndex: 0,
    audioQuestion: "Audio/whatsthis.mp3",     // “A boat and a ship.”
    audioCorrect: "Audio/02_Chapter 1.mp3",       // “Great! A boat and a ship!”
    audioWrong: "Audio/tryagain.mp3",
    heading: "Choose the correct answer.",
    feedbackCorrect: "Great! A boat and a ship!",
    feedbackWrong: "Listen carefully. We say: A boat and a ship."
  },
  {
    image: "Images/3.webp",
    sentence: "A mug and ___ apple",
    choices: ["a", "an", "the"],
    correctIndex: 1,
    audioQuestion: "Audio/whatsthis.mp3",
    audioCorrect: "Audio/03_Chapter 1.mp3",
    audioWrong: "Audio/not-tryagain.mp3",
    heading: "Fill in the blank.",
    feedbackCorrect: "Yes! This is an apple.",
    feedbackWrong: "We say: This is an apple."
  }
];

// Internal flags
let currentIndex = 0;
let isLocked = false; // until the learner answers

// We recompute score from the array each time, so no separate global "score" needed

// Reusable audio object for question + feedback
const fxAudio = new Audio();
fxAudio.preload = "auto";

function stopFxAudio() {
  fxAudio.pause();
  fxAudio.currentTime = 0;
}

// ----------------------------
// DOM HOOKS
// ----------------------------
const itemImage       = document.getElementById("itemImage");
const questionBox     = document.getElementById("question");
const progressFill    = document.getElementById("progressFill");
const progressStats   = document.getElementById("progressStats");
const progressPill    = document.getElementById("progressPill");

const c0              = document.getElementById("c0");
const c1              = document.getElementById("c1");
const c2              = document.getElementById("c2");
const choiceButtons   = [c0, c1, c2];

const feedback        = document.getElementById("feedback");

const prevBtn         = document.getElementById("prevBtn");
const nextBtn         = document.getElementById("nextBtn");
const resetBtn        = document.getElementById("resetBtn");

// Results overlay
const resultsOverlay  = document.getElementById("resultsOverlay");
const resultsTitle    = document.getElementById("resultsTitle");
const resultsText     = document.getElementById("resultsText");
const reviewBtn       = document.getElementById("reviewBtn");
const restartBtn      = document.getElementById("restartBtn");

const confettiCanvas  = document.getElementById("confettiCanvas");

// ----------------------------
// UTILS
// ----------------------------

function getScore() {
  return quizItems.filter(item => item.wasCorrect === true).length;
}

function playFx(src) {
  if (!src) return;
  stopFxAudio();
  fxAudio.src = src;
  fxAudio.play().catch(() => {
    // ignore autoplay / interruption errors
  });
}

function clearChoiceStyles() {
  choiceButtons.forEach(btn => {
    btn.classList.remove("correct", "incorrect");
  });
}

function setChoicesDisabled(disabled) {
  choiceButtons.forEach(btn => {
    btn.disabled = disabled;
  });
}

// ----------------------------
// RENDER
// ----------------------------

function updateProgressUI() {
  const total = quizItems.length;
  const score = getScore();

  // Bar shows % correct out of total
  const percent = total > 0 ? (score / total) * 100 : 0;
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }

  if (progressStats) {
    progressStats.textContent = `${score} correct so far`;
  }

  if (progressPill) {
    progressPill.textContent = `${currentIndex + 1}/${total}`;
  }
}

function buildSentence(item, fillText = null) {
  const base = item?.sentence || "";
  const token = "___";
  if (fillText) {
    if (base.includes(token)) return base.split(token).join(fillText);
    return `${fillText} ${base}`;
  }
  return base;
}

function renderSlide(index) {
  const item = quizItems[index];
  if (!item) return;

  currentIndex = index;
  isLocked = false;

  stopFxAudio();

  // Prepare defaults
  if (typeof item.userAnswer === "undefined") {
    item.userAnswer = null;
    item.wasCorrect = false;
  }

  // Image
  if (itemImage) {
    itemImage.src = item.image;
    itemImage.alt = item.alt || "";
  }

  // Question + sentence with blank
  if (questionBox) {
    const fillText = item.wasCorrect ? item.choices?.[item.correctIndex] : null;
    const sentence = buildSentence(item, fillText);
    questionBox.innerHTML = `<div class="question-sentence">${sentence}</div>`;
  }

  // Choices (A / An / The style)
  clearChoiceStyles();
  if (Array.isArray(item.choices)) {
    choiceButtons.forEach((btn, i) => {
      if (!btn) return;
      const text = item.choices[i] ?? "";
      btn.textContent = text;
      btn.style.visibility = text ? "visible" : "hidden";
    });
  }

  // Feedback display
  if (feedback) {
    feedback.textContent = "";
    feedback.classList.remove("good", "bad");
  }

  // Restore previous answer (if learner is reviewing)
  if (item.userAnswer !== null && typeof item.userAnswer === "number") {
    isLocked = true;
    setChoicesDisabled(true);

    const scoreItemCorrect = item.wasCorrect === true;
    const chosenBtn = choiceButtons[item.userAnswer];
    const correctBtn = choiceButtons[item.correctIndex];

    if (chosenBtn) {
      chosenBtn.classList.add(scoreItemCorrect ? "correct" : "incorrect");
    }
    if (correctBtn) {
      correctBtn.classList.add("correct");
    }

    if (feedback) {
      if (scoreItemCorrect) {
        feedback.textContent = item.feedbackCorrect || "Great!";
        feedback.classList.add("good");
      } else {
        feedback.textContent = item.feedbackWrong || "Not quite. Listen again.";
        feedback.classList.add("bad");
      }
    }
    nextBtn && (nextBtn.disabled = false);
  } else {
    // Fresh question
    setChoicesDisabled(false);
    nextBtn && (nextBtn.disabled = true);

    // Auto-play question audio on first render (within a user gesture context)
    playFx(item.audioQuestion);
  }

  // Prev / Next buttons state
  if (prevBtn) {
    prevBtn.disabled = currentIndex === 0;
  }

  if (nextBtn) {
    const isLast = currentIndex === quizItems.length - 1;
    nextBtn.textContent = isLast ? "Finish" : "Next";
  }

  updateProgressUI();
}

// ----------------------------
// ANSWER HANDLING
// ----------------------------

function handleChoiceClick(choiceIndex) {
  const item = quizItems[currentIndex];
  if (!item || isLocked) return;

  isLocked = true;
  setChoicesDisabled(true);

  const isCorrect = choiceIndex === item.correctIndex;
  const chosenBtn = choiceButtons[choiceIndex];
  const correctBtn = choiceButtons[item.correctIndex];

  // Store result for review
  item.userAnswer = choiceIndex;
  item.wasCorrect = isCorrect;

  clearChoiceStyles();
  if (chosenBtn) {
    chosenBtn.classList.add(isCorrect ? "correct" : "incorrect");
  }
  if (correctBtn && !isCorrect) {
    correctBtn.classList.add("correct");
  }

  // Show filled blank when correct
  if (isCorrect && questionBox) {
    const filled = buildSentence(item, item.choices?.[choiceIndex]);
    questionBox.innerHTML = `<div class="question-sentence">${filled}</div>`;
  }

  // Feedback text
  if (feedback) {
    feedback.classList.remove("good", "bad");
    if (isCorrect) {
      feedback.textContent = item.feedbackCorrect || "Great job!";
      feedback.classList.add("good");
    } else {
      feedback.textContent =
        item.feedbackWrong ||
        "Not quite. Listen carefully to the sentence.";
      feedback.classList.add("bad");
    }
  }

  // Audio feedback
  playFx(isCorrect ? item.audioCorrect : item.audioWrong);

  // Enable Next
  if (nextBtn) {
    nextBtn.disabled = false;
  }

  // Update progress
  updateProgressUI();

  // Auto-advance shortly after a correct answer
  if (isCorrect) {
    setTimeout(() => {
      if (currentIndex < quizItems.length - 1) {
        renderSlide(currentIndex + 1);
      } else {
        showResults();
      }
    }, 800);
  }
}

// ----------------------------
// NAVIGATION & RESULTS
// ----------------------------

function goToPrev() {
  if (currentIndex > 0) {
    renderSlide(currentIndex - 1);
  }
}

function goToNextOrFinish() {
  const isLast = currentIndex === quizItems.length - 1;
  if (!isLast) {
    renderSlide(currentIndex + 1);
  } else {
    showResults();
  }
}

function showResults() {
  const total = quizItems.length;
  const score = getScore();

  stopFxAudio();

  if (resultsTitle) {
    resultsTitle.textContent = "Great job!";
  }

  if (resultsText) {
    resultsText.textContent = `You got ${score} out of ${total} correct.`;
  }

  if (resultsOverlay) {
    resultsOverlay.classList.remove("hidden");
    document.body.classList.add("overlay-open");
  }

  // Confetti (if library loaded)
  if (window.confetti && confettiCanvas) {
    const myConfetti = window.confetti.create(confettiCanvas, {
      resize: true,
      useWorker: true
    });
    myConfetti({
      particleCount: 160,
      spread: 80,
      startVelocity: 40,
      origin: { y: 0.25 }
    });
  }
}

function resetQuiz() {
  stopFxAudio();

  quizItems.forEach(item => {
    item.userAnswer = null;
    item.wasCorrect = false;
  });

  currentIndex = 0;
  isLocked = false;

  if (resultsOverlay) {
    resultsOverlay.classList.add("hidden");
    document.body.classList.remove("overlay-open");
  }

  renderSlide(0);
}

// ----------------------------
// EVENT LISTENERS
// ----------------------------

choiceButtons.forEach((btn, index) => {
  if (!btn) return;
  btn.addEventListener("click", () => handleChoiceClick(index));
});

prevBtn && prevBtn.addEventListener("click", goToPrev);
nextBtn && nextBtn.addEventListener("click", goToNextOrFinish);
resetBtn && resetBtn.addEventListener("click", resetQuiz);

reviewBtn &&
  reviewBtn.addEventListener("click", () => {
    if (resultsOverlay) {
      resultsOverlay.classList.add("hidden");
      document.body.classList.remove("overlay-open");
    }
    renderSlide(0);
  });

restartBtn &&
  restartBtn.addEventListener("click", () => {
    // "Go Home" = just reset for now
    resetQuiz();
  });

// ----------------------------
// EXPORT FOR INTRO SCRIPT
// ----------------------------

/**
 * The inline script in your HTML expects:
 *   - global `render`
 *   - global `idx` and `score` (we'll map to our structures)
 * We keep `idx` only for compatibility (not used internally for score).
 */
let idx = 0;
let score = 0; // not used; kept so the intro script doesn't break

window.render = function (index) {
  // keep idx/score in sync for any legacy code
  idx = index;
  score = getScore();
  renderSlide(index);
};

// If someone loads quizCard directly (without intro), you *could* start here:
// document.addEventListener("DOMContentLoaded", () => {
//   renderSlide(0);
// });
