// =====================
// DATA LOADING
// =====================
const params = new URLSearchParams(window.location.search);
const activityId = params.get("activity") || "activity1";
const activityNumberMatch = activityId.match(/\d+/);
const activityNumber = activityNumberMatch ? activityNumberMatch[0] : "1";
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
const mankuCorner = document.getElementById("mankuCorner");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const resetBtn = document.getElementById("resetBtn");

const wordGrid = document.querySelector(".word-grid");
const answerSlot = document.getElementById("answerSlot");
const answerTextEl = document.getElementById("answerText");
let wordBtns = [];

// Results overlay
const resultsOverlay = document.getElementById("resultsOverlay");
const resultsText = document.getElementById("resultsText");
const resultsImage = document.getElementById("resultsImage");
const resultsScore = document.getElementById("resultsScore");
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

function popAnswerSlot() {
  if (!answerSlot) return;
  answerSlot.classList.remove("word-landed");
  void answerSlot.offsetWidth;
  answerSlot.classList.add("word-landed");
}

function animateWordToAnswer(btn, label, onDone) {
  if (!btn || !answerSlot || prefersReduced) {
    if (typeof onDone === "function") onDone();
    return;
  }

  const from = btn.getBoundingClientRect();
  const to = answerSlot.getBoundingClientRect();
  const flyWord = document.createElement("span");

  flyWord.className = "fly-word";
  flyWord.textContent = label;
  flyWord.style.left = `${from.left}px`;
  flyWord.style.top = `${from.top}px`;
  flyWord.style.width = `${from.width}px`;
  flyWord.style.height = `${from.height}px`;

  document.body.appendChild(flyWord);

  const targetX = to.left + (to.width / 2) - (from.width / 2);
  const targetY = to.top + (to.height / 2) - (from.height / 2);
  const lift = Math.min(72, Math.max(36, from.top - to.top));

  const flight = flyWord.animate(
    [
      {
        transform: "translate3d(0, 0, 0) scale(1)",
        opacity: 1
      },
      {
        transform: `translate3d(${(targetX - from.left) * 0.5}px, ${targetY - from.top - lift}px, 0) scale(1.08)`,
        opacity: 1,
        offset: 0.55
      },
      {
        transform: `translate3d(${targetX - from.left}px, ${targetY - from.top}px, 0) scale(0.86)`,
        opacity: 0.18
      }
    ],
    {
      duration: 430,
      easing: "cubic-bezier(.2,.82,.2,1)",
      fill: "forwards"
    }
  );

  flight.onfinish = () => {
    flyWord.remove();
    if (typeof onDone === "function") onDone();
    popAnswerSlot();
  };
}

function shakeWrongWord(btn) {
  if (!btn) return;
  const shakeId = String(Date.now());
  btn.dataset.shakeId = shakeId;
  btn.classList.remove("wrong-shake");
  void btn.offsetWidth;
  btn.classList.add("wrong-shake");
  btn.addEventListener("animationend", () => {
    btn.classList.remove("wrong-shake");
  }, { once: true });
  setTimeout(() => {
    if (btn.dataset.shakeId === shakeId) {
      btn.classList.remove("wrong-shake");
    }
  }, 380);
}

function animateManku(mood) {
  if (!mankuCorner || !mood) return;
  mankuCorner.classList.remove("manku-happy", "manku-wrong", "manku-celebrate");
  void mankuCorner.offsetWidth;
  mankuCorner.classList.add(`manku-${mood}`);
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
  return `Audio/${activityNumber}/${num}_Chapter 1.mp3`;
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
    const label = words[wordIndex] ?? "";
    btn.textContent = label;
    if (label.length > 10) btn.classList.add("long-word");
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
const NICE_EFFORT_SFX = "Audio/effects/nice_effort.mp3";
const EXCELLENT_SFX = "Audio/effects/excellent_above.mp3";

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
  answerSlot?.classList.remove("word-landed");
  updateAnswerText(it?.words || [], selectionIndices);
  wordBtns.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove("selected", "correct", "incorrect", "wrong-shake");
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
    mankuCorner?.classList.remove("manku-happy", "manku-wrong", "manku-celebrate");
    wordBtns.forEach(btn => btn.disabled = true);
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  const it = ITEMS[i];
  if (!it) return;

  hadWrongAttempt = false;
  nextBtn.disabled = false;
  mankuCorner?.classList.remove("manku-happy", "manku-wrong", "manku-celebrate");

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
    btn.classList.add("incorrect");
    shakeWrongWord(btn);
    animateManku("wrong");
    vibrate([40, 60, 40]);
    playAudio(WRONG_SFX, () => {
      if (it.audioWrong) playAudio(it.audioWrong);
    });
    return;
  }

  btn.disabled = true;
  wordBtns.forEach(b => b.classList.remove("wrong-shake"));
  btn.classList.remove("incorrect", "wrong-shake");
  btn.classList.add("selected");
  animateManku("happy");

  selectionIndices.push(wordIndex);
  const visibleSelection = [...selectionIndices];
  const tappedAtIndex = idx;
  animateWordToAnswer(btn, it.words?.[wordIndex] || "", () => {
    if (tappedAtIndex !== idx) return;
    updateAnswerText(it.words || [], visibleSelection);
  });

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
  animateManku("celebrate");
  vibrate(30);

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
  if (resultsScore) {
    resultsScore.textContent = `${score}/${total}`;
  }
  if (resultsImage) {
    resultsImage.src = score <= 8 ? "Images/score2.webp" : "Images/score.webp";
  }
  if (resultsText) {
    resultsText.textContent = `You built ${score} out of ${total} sentences correctly (${pct}%).`;
  }

  const revealResults = () => {
    resultsOverlay.classList.remove("hidden");
    document.body.classList.add("overlay-open");
    reviewBtn?.focus();
    const resultSfx = score >= 8 ? EXCELLENT_SFX : NICE_EFFORT_SFX;
    playAudio(resultSfx, () => {
      playAudio(CLAP_SFX);
    });
    popConfetti();
    pill?.classList.add("hidden");
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
  pill?.classList.remove("hidden");
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
  window.location.href = "../dashboard.html";
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
