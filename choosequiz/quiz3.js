// =====================
// DATA
// =====================
// Choose data file based on query param (?activity=activity2), default to activity1
const params = new URLSearchParams(window.location.search);
const activityId = params.get("activity") || "activity1";
const DATA_URL = `json/${activityId}.json`;
let ITEMS = [];
let dataLoaded = false;
let loadError = false;
let introData = null;
const dataPromise = fetch(DATA_URL)
  .then(res => res.json())
  .then(json => {
    if (Array.isArray(json)) {
      ITEMS = json;
      introData = json.intro || null;
    } else {
      ITEMS = json?.items || [];
      introData = json?.intro || null;
    }
    dataLoaded = true;
  })
  .catch(() => {
    dataLoaded = false;
    loadError = true;
    ITEMS = [];
    console.error(`quiz3: failed to load ${DATA_URL}`);
  });


// =====================
// ELEMENTS
// =====================
const imgEl = document.getElementById("itemImage");
const qEl = document.getElementById("question");
const pill = document.getElementById("progressPill");
const fbEl = document.getElementById("feedback");
const progressFill = document.getElementById("progressFill");
const progressStats = document.getElementById("progressStats");
const introImgEl = document.getElementById("introImage");
const introAudioEl = document.getElementById("introAudio");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const resetBtn = document.getElementById("resetBtn");

const choiceEls = [0, 1, 2].map(i => document.getElementById("c" + i));

// Results overlay
const resultsOverlay = document.getElementById("resultsOverlay");
const resultsText = document.getElementById("resultsText");
const restartBtn = document.getElementById("restartBtn");
const reviewBtn = document.getElementById("reviewBtn");

// Confetti
const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
const confettiCanvas = document.getElementById("confettiCanvas");
const confettiShot = (window.confetti && confettiCanvas)
  ? window.confetti.create(confettiCanvas, { resize: true, useWorker: true })
  : null;

let lastConfettiAt = 0;
function popConfetti() {
  if (!confettiShot || prefersReduced) return;
  const now = performance.now();
  if (now - lastConfettiAt < 500) return;
  lastConfettiAt = now;

  confettiShot({
    particleCount: 600,
    spread: 70,
    origin: {
      x: Math.random() * 0.6 + 0.2, // spread spawns across 20%-80% width
      y: 0.3
    }
  });
}

// =====================
// STATE
// =====================
let idx = 0;          // current question index
let answered = false; // whether current item has been answered
let score = 0;        // total correct answers
let hadWrongAttempt = false; // track if user already missed this question
let pendingRenderIndex = null;

// mapping from visible buttons 0–2 to original choice indices
let map = [0, 1, 2];

// =====================
// HELPERS
// =====================
function shuffle3() {
  map = [0, 1, 2];
  for (let i = map.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [map[i], map[j]] = [map[j], map[i]];
  }
}

function setFeedback(msg, ok) {
  fbEl.textContent = msg || "";
  fbEl.classList.toggle("good", !!ok);
  fbEl.classList.toggle("bad", !ok && !!msg);
}

// Single shared audio for SFX (question / correct / wrong)
const sfx = new Audio();

function playAudio(path, onEnded) {
  if (!path) {
    if (typeof onEnded === "function") onEnded();
    return;
  }

  try {
    sfx.pause();
    sfx.currentTime = 0;
  } catch (e) { }

  sfx.src = path;
  sfx.onended = () => {
    sfx.onended = null;
    if (typeof onEnded === "function") onEnded();
  };

  sfx.play().catch(() => {
    // If playback fails, still fire callback so UI doesn't get stuck
    if (typeof onEnded === "function") onEnded();
  });
}


// =====================
// RENDER
// =====================
function render(i) {
  if (!dataLoaded) {
    pendingRenderIndex = i;
    dataPromise.finally(() => {
      if (pendingRenderIndex !== null && dataLoaded) {
        const target = pendingRenderIndex;
        pendingRenderIndex = null;
        render(target);
      }
    });
    qEl.textContent = loadError ? "Could not load questions." : "Loading questions...";
    setFeedback(loadError ? "Could not load questions." : "Loading questions...", false);
    choiceEls.forEach(btn => btn.disabled = true);
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const it = ITEMS[i];
  if (!it) return;

  answered = false;
  hadWrongAttempt = false;
  setFeedback("");
  nextBtn.disabled = false;   // user can always move ahead

  // image + question
  imgEl.src = it.image;
  imgEl.alt = it.question || "Question image";
  qEl.textContent = it.question || "";
  pill.textContent = `${i + 1}/${ITEMS.length}`;
  updateProgressUI();

  // shuffle choices for this render
  shuffle3();

  // reset choice buttons
  choiceEls.forEach((btn, slot) => {
    btn.disabled = false;
    btn.classList.remove("correct", "incorrect");

    const choiceIndex = map[slot];          // original index in choices[]
    btn.textContent = it.choices[choiceIndex];
    btn.setAttribute("data-choice-index", choiceIndex);
  });

  prevBtn.disabled = (i === 0);

  // Play question audio if exists
  if (it.audioQuestion) {
    playAudio(it.audioQuestion);
  }

}

function updateProgressUI() {
  const pct = Math.round(((idx) / ITEMS.length) * 100);
  if (progressFill) {
    progressFill.style.width = `${pct}%`;
  }
  if (progressStats) {
    progressStats.textContent = `${score} correct so far`;
  }
}

// =====================
// CHOICE HANDLING
// =====================
function onChoose(slot) {
  if (answered) return;
  const it = ITEMS[idx];
  if (!it) return;

  const chosenOriginalIndex = Number(choiceEls[slot].getAttribute("data-choice-index"));
  const correct = (chosenOriginalIndex === it.correctIndex);

  if (correct) {
    const earnedPoint = !hadWrongAttempt;
    if (earnedPoint) {
      score += 1;
      setFeedback("Great!", true);
    } else {
      setFeedback("Correct! No point this round.", true);
    }
    updateProgressUI();

    choiceEls[slot].classList.add("correct");
    // Lock buttons after correct answer
    choiceEls.forEach(b => { b.disabled = true; });
    popConfetti();
    const advanceAfterAudio = () => {
      if (idx < ITEMS.length - 1) {
        idx += 1;
        render(idx);
      } else {
        showResults();
      }
    };
    if (it.audioCorrect) {
      playAudio(it.audioCorrect, advanceAfterAudio);
    } else {
      setTimeout(advanceAfterAudio, 900);
    }

    answered = true;
    // user can move on anytime
    nextBtn.disabled = false;
  } else {
    hadWrongAttempt = true;
    setFeedback("Try again!", false);
    choiceEls[slot].classList.add("incorrect");
    choiceEls[slot].disabled = true; // keep other options active
    playAudio(it.audioWrong || "Audio/not-correct.mp3");

    // Keep answered false so user can keep choosing
    nextBtn.disabled = false; // allow moving ahead even if wrong
  }
}

// =====================
// RESULTS
// =====================
function showResults() {
  const total = ITEMS.length;
  const pct = Math.round((score / total) * 100);

  resultsText.textContent = `You got ${score} out of ${total} correct (${pct}%).`;
  resultsOverlay.classList.remove("hidden");
  document.body.classList.add("overlay-open");
  reviewBtn?.focus();
  popConfetti();
}

function hideResults() {
  resultsOverlay.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

// =====================
// EVENT WIRES
// =====================
// Choices
choiceEls.forEach((btn, i) => {
  btn.addEventListener("click", () => onChoose(i));
});

// Prev / Next / Reset
prevBtn.addEventListener("click", () => {
  if (idx > 0) {
    idx -= 1;
    render(idx);
  }
});

nextBtn.addEventListener("click", () => {
  if (idx < ITEMS.length - 1) {
    idx += 1;
    render(idx);
  } else {
    // At the end → show results
    showResults();
  }
});

resetBtn.addEventListener("click", () => {
  idx = 0;
  score = 0;
  hideResults();
  render(idx);
});

// Results overlay buttons
restartBtn?.addEventListener("click", () => {
  window.location.href = "../index.html";
});

reviewBtn?.addEventListener("click", () => {
  hideResults(); // keep idx where it is, let user go back/forward
});

// Keyboard shortcuts: 1/2/3 for options, arrows for nav
window.addEventListener("keydown", (e) => {
  if (e.key === "1") return onChoose(0);
  if (e.key === "2") return onChoose(1);
  if (e.key === "3") return onChoose(2);
  if (e.key === "ArrowLeft") prevBtn.click();
  if (e.key === "ArrowRight") nextBtn.click();
});

// Preload images
dataPromise.then(() => {
  ITEMS.forEach(it => {
    const im = new Image();
    im.src = it.image;
  });
  if (introData) {
    if (introImgEl && introData.image) {
      introImgEl.src = introData.image;
      introImgEl.alt = introData.alt || "Welcome";
    }
    if (introAudioEl && introData.audio) {
      introAudioEl.src = introData.audio;
    }
  }
});
