// =====================
// DATA
// =====================
// Replace these with your real questions, images, and audio.
const ITEMS = [
  {
    image: "Images/2.webp",  // or "Images/3.webp" if that's your path
    choices: [
      "It’s a book",   // ✅ correct
      "It’s the book",
      "It’s an book"
    ],
    correctIndex: 0,
    audioQuestion: "Audio/02_Chapter 1.mp3",
    audioCorrect: "Audio/03_Chapter 1.mp3",  // “Yes! It’s a book!”
    audioWrong: "Audio/tryagain.mp3"
  },
  {
    image: "Images/3.webp",
    choices: ["It's a apple", "It's an apple", "It's some apple"],
    correctIndex: 1,
    audioQuestion: "Audio/04_Chapter 1.mp3",
    audioCorrect: "Audio/05_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  },
  {
    image: "Images/4.webp",
    choices: ["It’s mug", "It’s mug the", "It’s a mug"],
    correctIndex: 2,
    audioQuestion: "Audio/06_Chapter 1.mp3",
    audioCorrect: "Audio/07_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  },
  {
    image: "Images/5.webp",
    choices: ["It’s the tooth brush", "It’s a tooth brush", "It’s an tooth brush"],
    correctIndex: 1,
    audioQuestion: "Audio/08_Chapter 1.mp3",
    audioCorrect: "Audio/09_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  },
  {
    image: "Images/6.webp",
    choices: ["It’s the umbrella", "A umbrella", "It’s an umbrella"],
    correctIndex: 2,
    audioQuestion: "Audio/10_Chapter 1.mp3",
    audioCorrect: "Audio/11_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  }, 
  
  {
    image: "Images/7.webp",
    choices: ["It’s egg the", "It’s an egg", "It’s the egg"],
    correctIndex: 1,
    audioQuestion: "Audio/12_Chapter 1.mp3",
    audioCorrect: "Audio/13_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  }, 
  {
    image: "Images/8.webp",
    choices: ["It’s a orange", "The orange", " It’s an orange"],
    correctIndex: 2,
    audioQuestion: "Audio/14_Chapter 1.mp3",
    audioCorrect: "Audio/15_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  },
  {
    image: "Images/9.webp",
    choices: ["It’s backpack", "The backpack", " It’s a backpack"],
    correctIndex: 2,
    audioQuestion: "Audio/16_Chapter 1.mp3",
    audioCorrect: "Audio/17_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  },
  {
    image: "Images/10.webp",
    choices: ["It’s the eraser", "A eraser", "It’s an eraser"],
    correctIndex: 2,
    audioQuestion: "Audio/18_Chapter 1.mp3",
    audioCorrect: "Audio/19_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  },
  {
    image: "Images/11.webp",
    choices: ["It’s an leaf", "It’s a leaf", "It’s the leaf"],
    correctIndex: 1,
    audioQuestion: "Audio/20_Chapter 1.mp3",
    audioCorrect: "Audio/21_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  },
  {
    image: "Images/12.webp",
    choices: ["It’s a chair", "It’s the chair", "It’s an chair"],
    correctIndex: 0,
    audioQuestion: "Audio/22_Chapter 1.mp3",
    audioCorrect: "Audio/23_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  },
  {
    image: "Images/13.webp",
    choices: ["A torch", "The torch", "It’s a torch"],
    correctIndex: 2,
    audioQuestion: "Audio/24_Chapter 1.mp3",
    audioCorrect: "Audio/25_Chapter 1.mp3",
    audioWrong: "Audio/tryagain.mp3"
  },
];


// =====================
// ELEMENTS
// =====================
const imgEl = document.getElementById("itemImage");
const qEl = document.getElementById("question");
const pill = document.getElementById("progressPill");
const fbEl = document.getElementById("feedback");

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
    particleCount: 200,
    spread: 70,
    origin: { y: 0.3 }
  });
}

// =====================
// STATE
// =====================
let idx = 0;          // current question index
let answered = false; // whether current item has been answered
let score = 0;        // total correct answers
let hadWrongAttempt = false; // track if user already missed this question

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
ITEMS.forEach(it => {
  const im = new Image();
  im.src = it.image;
});
