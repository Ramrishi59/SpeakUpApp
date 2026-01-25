// =====================
// DATA LOADING
// =====================
const params = new URLSearchParams(window.location.search);
const activityId = params.get("activity") || "activity1";
const DATA_URL = `json/${activityId}.json`;

let ITEMS = [];
let dataLoaded = false;
let loadError = false;
let introData = null;
let outroData = null;

const dataPromise = fetch(DATA_URL)
  .then(res => res.json())
  .then(json => {
    if (Array.isArray(json)) {
      ITEMS = json;
    } else {
      ITEMS = json?.items || [];
      introData = json?.intro || null;
      outroData = json?.outro || null;
    }
    dataLoaded = true;
  })
  .catch(() => {
    dataLoaded = false;
    loadError = true;
    ITEMS = [];
    console.error(`order4: failed to load ${DATA_URL}`);
  });

// =====================
// ELEMENTS
// =====================
const qEl = document.getElementById("question");
const pill = document.getElementById("progressPill");
const progressFill = document.getElementById("progressFill");
const progressStats = document.getElementById("progressStats");
const introImgEl = document.getElementById("introImage");
const introAudioEl = document.getElementById("introAudio");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const resetBtn = document.getElementById("resetBtn");

const wordGrid = document.querySelector(".word-grid");
const answerTextEl = document.getElementById("answerText");
let wordBtns = [];

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
      x: Math.random() * 0.6 + 0.2,
      y: 0.3
    }
  });
}

// =====================
// STATE
// =====================
let idx = 0;
let score = 0;
let answered = false;
let hadWrongAttempt = false;
let pendingRenderIndex = null;

// mapping from button slot -> original word index
let map = [];
// order of selected original indices
let selectionIndices = [];

// =====================
// HELPERS
// =====================
function shuffleWords(count) {
  map = Array.from({ length: count }, (_, i) => i);
  if (count < 2) return;
  const isOrdered = (arr) => arr.every((v, i) => v === i);
  let attempts = 0;
  do {
    for (let i = map.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [map[i], map[j]] = [map[j], map[i]];
    }
    attempts += 1;
  } while (isOrdered(map) && attempts < 5);
  if (isOrdered(map)) {
    map.push(map.shift());
  }
}


function updateAnswerText(words, indices) {
  if (!words || indices.length === 0) {
    answerTextEl.textContent = "";
    return;
  }
  const parts = indices.map(i => words[i]);
  answerTextEl.textContent = parts.join(" ");
}

function updateWordGridDensity(words) {
  if (!wordGrid) return;
  const totalWords = words?.length || 0;
  const totalChars = (words || []).join(" ").length;
  const compact = totalWords > 4 || totalChars > 20;
  wordGrid.classList.toggle("compact", compact);
}

function getSentenceAudio(it, index) {
  if (it?.audioSentence) return it.audioSentence;
  const num = String(index + 1).padStart(2, "0");
  return `Audio/${num}_Chapter 1.mp3`;
}

function renderWordButtons(words) {
  if (!wordGrid) return;
  const count = words.length;
  shuffleWords(count);
  wordGrid.innerHTML = "";
  wordBtns = map.map((wordIndex, slot) => {
    const btn = document.createElement("button");
    btn.className = "word-btn";
    btn.type = "button";
    btn.id = `w${slot}`;
    btn.textContent = words[wordIndex] ?? "";
    btn.setAttribute("data-word-index", wordIndex);
    btn.addEventListener("click", () => handleWordTap(slot));
    wordGrid.appendChild(btn);
    return btn;
  });
}

const sfx = new Audio();
const RIGHT_SFX = "../choosequiz/effects/Right.mp3";
const WRONG_SFX = "../choosequiz/effects/Wrong.mp3";
const CLAP_SFX = "../choosequiz/effects/Clap.mp3";

function vibrate(pattern) {
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {}
}
function playAudio(path, onEnded) {
  if (!path) {
    if (typeof onEnded === "function") onEnded();
    return;
  }
  try {
    sfx.pause();
    sfx.currentTime = 0;
  } catch (e) {}

  sfx.src = path;
  sfx.onended = () => {
    sfx.onended = null;
    if (typeof onEnded === "function") onEnded();
  };

  sfx.play().catch(() => {
    if (typeof onEnded === "function") onEnded();
  });
}

function updateProgressUI() {
  const total = ITEMS.length || 1;
  const pct = Math.round((idx / total) * 100);
  if (progressFill) progressFill.style.width = `${pct}%`;
  if (progressStats) {
    progressStats.textContent = `${score} correct so far`;
  }
}

function resetWordUI(it) {
  selectionIndices = [];
  answered = false;
  updateAnswerText(it?.words || [], selectionIndices);
  wordBtns.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove("selected", "correct", "incorrect");
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
    qEl.textContent = loadError ? "Could not load activity." : "Loading...";
    wordBtns.forEach(btn => btn.disabled = true);
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const it = ITEMS[i];
  if (!it) return;

  hadWrongAttempt = false;
  nextBtn.disabled = false;

  qEl.textContent = it.question || "Tap the words in order to make the sentence.";
  pill.textContent = `${i + 1}/${ITEMS.length}`;
  updateProgressUI();

  const words = it.words || [];
  updateWordGridDensity(words);
  renderWordButtons(words);
  resetWordUI(it);

  prevBtn.disabled = (i === 0);

  if (it.audioQuestion) {
    playAudio(it.audioQuestion);
  }
}

// =====================
// WORD TAPS
// =====================
function handleWordTap(slot) {
  const it = ITEMS[idx];
  if (!it || answered) return;

  const btn = wordBtns[slot];
  if (!btn || btn.disabled) return;

  const wordIndex = Number(btn.getAttribute("data-word-index"));
  if (Number.isNaN(wordIndex)) return;

  const expectedIndex = selectionIndices.length;
  if (wordIndex !== expectedIndex) {
    hadWrongAttempt = true;
    vibrate([40, 60, 40]);
    playAudio(WRONG_SFX, () => {
      if (it.audioWrong) playAudio(it.audioWrong);
    });
    return;
  }

  btn.disabled = true;
  btn.classList.add("selected");

  selectionIndices.push(wordIndex);
  updateAnswerText(it.words || [], selectionIndices);

  const totalWords = it.words?.length || 0;
  if (selectionIndices.length < totalWords) return;

  const earnedPoint = !hadWrongAttempt;
  if (earnedPoint) {
    score += 1;
  } else {
  }
  updateProgressUI();

  wordBtns.forEach(b => {
    b.classList.remove("selected", "incorrect");
    b.classList.add("correct");
    b.disabled = true;
  });

  answered = true;
  vibrate(30);
  popConfetti();

  const advance = () => {
    if (idx < ITEMS.length - 1) {
      idx += 1;
      render(idx);
    } else {
      showResults();
    }
  };

  playAudio(RIGHT_SFX, () => {
    const sentenceAudio = getSentenceAudio(it, idx);
    if (sentenceAudio) {
      setTimeout(() => playAudio(sentenceAudio, advance), 80);
    } else {
      setTimeout(advance, 300);
    }
  });
}

// =====================
// RESULTS
// =====================
function showResults() {
  const total = ITEMS.length || 1;
  const pct = Math.round((score / total) * 100);
  resultsText.textContent = `You built ${score} out of ${total} sentences correctly (${pct}%).`;

  const revealResults = () => {
    resultsOverlay.classList.remove("hidden");
    document.body.classList.add("overlay-open");
    reviewBtn?.focus();
    playAudio(CLAP_SFX);
    popConfetti();
  };

  if (outroData && outroData.audio) {
    let revealed = false;
    const finalize = () => {
      if (revealed) return;
      revealed = true;
      revealResults();
    };

    const fallback = setTimeout(finalize, 3000);
    playAudio(outroData.audio, () => {
      clearTimeout(fallback);
      finalize();
    });
    return;
  }

  revealResults();
}

function hideResults() {
  resultsOverlay.classList.add("hidden");
  document.body.classList.remove("overlay-open");
}

// =====================
// EVENT WIRES
// =====================
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
    showResults();
  }
});

resetBtn.addEventListener("click", () => {
  idx = 0;
  score = 0;
  hideResults();
  if (ITEMS.length > 0) render(idx);
});

restartBtn?.addEventListener("click", () => {
  window.location.href = "../index.html";
});

reviewBtn?.addEventListener("click", () => {
  hideResults();
});

// Keyboard shortcuts: 1–4 for words, arrows for nav
window.addEventListener("keydown", (e) => {
  if (/^[1-9]$/.test(e.key)) {
    const idx = Number(e.key) - 1;
    if (idx < wordBtns.length) return handleWordTap(idx);
  }
  if (e.key === "ArrowLeft") prevBtn.click();
  if (e.key === "ArrowRight") nextBtn.click();
});

// Intro media from JSON
dataPromise.then(() => {
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
