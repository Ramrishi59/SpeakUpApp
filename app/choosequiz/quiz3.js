// =====================
// DATA
// =====================
// Choose data file based on query param (?activity=activity2), default to activity1
const params = new URLSearchParams(window.location.search);
const activityId = params.get("activity") || "activity1";
const returnCategory = params.get("from");
const returnUrl = returnCategory
  ? `../dashboard.html?cat=${encodeURIComponent(returnCategory)}`
  : "../dashboard.html";
const DATA_URL = `json/${activityId}.json`;
let ITEMS = [];
let dataLoaded = false;
let loadError = false;
let introData = null;
let activityTitle = "";
const dataPromise = fetch(DATA_URL)
  .then(res => res.json())
  .then(json => {
    if (Array.isArray(json)) {
      ITEMS = json;
      introData = json.intro || null;
      activityTitle = "";
    } else {
      ITEMS = json?.items || [];
      introData = json?.intro || null;
      activityTitle = json?.title || json?.activityTitle || "";
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
const activityTitleEl = document.getElementById("activityTitle");
const pill = document.getElementById("progressPill");
const progressFill = document.getElementById("progressFill");
const progressStats = document.getElementById("progressStats");
const introImgEl = document.getElementById("introImage");
const introAudioEl = document.getElementById("introAudio");
const homeBtn = document.getElementById("homeBtn");
const introHomeBtn = document.getElementById("introHomeBtn");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const resetBtn = document.getElementById("resetBtn");

const choiceEls = [0, 1, 2].map(i => document.getElementById("c" + i));

// Results overlay
const resultsOverlay = document.getElementById("resultsOverlay");
const resultsText = document.getElementById("resultsText");
const resultsImage = document.getElementById("resultsImage");
const resultsScore = document.getElementById("resultsScore");
const restartBtn = document.getElementById("restartBtn");
const reviewBtn = document.getElementById("reviewBtn");

if (homeBtn) homeBtn.href = returnUrl;
if (introHomeBtn) introHomeBtn.href = returnUrl;

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
const creditedQuestions = new Set();
const wrongAttemptQuestions = new Set();
let persistedProgressIndex = -1;
let progressSaveChain = Promise.resolve();
let completionSaved = false;
let completionSavePromise = null;

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

function getActivityTitle() {
  if (activityTitle) return activityTitle;
  const match = activityId.match(/\d+/);
  return match ? `Choose the right option ${match[0]}` : "Choose the right option";
}


// Single shared audio for SFX (question / correct / wrong)
const sfx = new Audio();
const correctAudio = new Audio();
correctAudio.preload = "auto";
const RIGHT_SFX = "effects/Right.mp3";
const WRONG_SFX = "effects/Wrong.mp3";
const CLAP_SFX = "effects/Clap.mp3";
const NICE_EFFORT_SFX = "../order-activity/Audio/effects/nice_effort.mp3";
const EXCELLENT_SFX = "../order-activity/Audio/effects/excellent_above.mp3";
const NICE_EFFORT_SCORE_CARD = "../order-activity/Images/score2.webp";
const EXCELLENT_SCORE_CARD = "../order-activity/Images/score.webp";
const EXCELLENT_SCORE_THRESHOLD = 0.8;

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
    choiceEls.forEach(btn => btn.disabled = true);
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const it = ITEMS[i];
  if (!it) return;

  answered = false;
  hadWrongAttempt = wrongAttemptQuestions.has(i);
  nextBtn.disabled = true;   // require a choice before moving ahead

  // image + question
  imgEl.src = it.image;
  imgEl.alt = it.question || "Question image";
  if (activityTitleEl) {
    activityTitleEl.textContent = getActivityTitle();
  }
  qEl.textContent = it.question || "";
  pill.textContent = `${i + 1}/${ITEMS.length}`;
  updateProgressUI();
  persistActivityProgress(i);

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
  if (it.audioCorrect) {
    correctAudio.src = it.audioCorrect;
    correctAudio.currentTime = 0;
  } else {
    correctAudio.removeAttribute("src");
  }

}

function updateProgressUI() {
  score = creditedQuestions.size;
  const pct = ITEMS.length > 0 ? Math.round(((idx) / ITEMS.length) * 100) : 0;
  if (progressFill) {
    progressFill.style.width = `${pct}%`;
  }
  if (progressStats) {
    progressStats.textContent = `${score} correct so far`;
  }
}

async function persistActivityProgress(index = idx) {
  if (index <= persistedProgressIndex || ITEMS.length === 0) return;
  persistedProgressIndex = index;

  progressSaveChain = progressSaveChain
    .catch(() => {})
    .then(async () => {
      try {
        await window.SUAuth?.ready;
        if (!window.SUAuth?.saveProgress) return;
        await window.SUAuth.saveProgress(activityId, index, ITEMS.length);
      } catch (error) {
        console.warn("Could not save quiz progress.", error);
      }
    });

  await progressSaveChain;
}

async function completeActivity() {
  if (completionSaved) return;
  if (completionSavePromise) return completionSavePromise;

  completionSavePromise = (async () => {
    try {
      await window.SUAuth?.ready;
      if (!window.SUAuth?.markUnitCompleted) {
        throw new Error("Quiz completion tracking is unavailable.");
      }
      await progressSaveChain.catch(() => {});
      if (window.SUAuth.saveProgress) {
        await window.SUAuth.saveProgress(activityId, Math.max(ITEMS.length - 1, 0), ITEMS.length);
      }
      await window.SUAuth.markUnitCompleted(activityId);
      completionSaved = true;
    } catch (error) {
      completionSavePromise = null;
      console.warn("Could not save completed quiz.", error);
    }
  })();

  return completionSavePromise;
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
    const earnedPoint = !hadWrongAttempt && !creditedQuestions.has(idx);
    if (earnedPoint) {
      creditedQuestions.add(idx);
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
        persistActivityProgress(idx);
      } else {
        showResults();
      }
    };
    playAudio(RIGHT_SFX, () => {
      if (!it.audioCorrect) {
        setTimeout(advanceAfterAudio, 400);
        return;
      }
      correctAudio.onended = () => {
        correctAudio.onended = null;
        advanceAfterAudio();
      };
      correctAudio.play().catch(() => {
        advanceAfterAudio();
      });
    });

    answered = true;
  } else {
    hadWrongAttempt = true;
    wrongAttemptQuestions.add(idx);
    choiceEls[slot].classList.add("incorrect");
    choiceEls[slot].disabled = true; // keep other options active
    playAudio(WRONG_SFX);

    // Keep answered false so user can keep choosing
    nextBtn.disabled = true;
  }
}

// =====================
// RESULTS
// =====================
function showResults() {
  const total = ITEMS.length;
  score = creditedQuestions.size;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const isExcellentScore = total > 0 && (score / total) >= EXCELLENT_SCORE_THRESHOLD;
  completeActivity();

  if (resultsScore) {
    resultsScore.textContent = `${score}/${total}`;
  }
  if (resultsImage) {
    resultsImage.src = isExcellentScore ? EXCELLENT_SCORE_CARD : NICE_EFFORT_SCORE_CARD;
  }
  if (resultsText) {
    resultsText.textContent = `You got ${score} out of ${total} correct (${pct}%).`;
  }

  const revealResults = () => {
    resultsOverlay.classList.remove("hidden");
    document.body.classList.add("overlay-open");
    reviewBtn?.focus();
    const resultSfx = isExcellentScore ? EXCELLENT_SFX : NICE_EFFORT_SFX;
    playAudio(resultSfx, () => {
      playAudio(CLAP_SFX);
    });
    popConfetti();
    pill?.classList.add("hidden");
  };

  revealResults();
}

function hideResults() {
  resultsOverlay.classList.add("hidden");
  document.body.classList.remove("overlay-open");
  pill?.classList.remove("hidden");
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
    persistActivityProgress(idx);
  } else {
    // At the end → show results
    showResults();
  }
});

resetBtn.addEventListener("click", () => {
  idx = 0;
  score = 0;
  creditedQuestions.clear();
  wrongAttemptQuestions.clear();
  persistedProgressIndex = -1;
  progressSaveChain = Promise.resolve();
  completionSaved = false;
  completionSavePromise = null;
  hideResults();
  render(idx);
  persistActivityProgress(idx);
});

// Results overlay buttons
restartBtn?.addEventListener("click", async () => {
  await completeActivity();
  window.location.href = returnUrl;
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
    if (introAudioEl && introData.audio) {
      introAudioEl.src = introData.audio;
    }
  }
});
