// =====================
// DATA
// =====================
// Replace these with your real questions, images, and audio.
const ITEMS = [
    {
      image: "3.webp",
      question: "Which is the correct phrase?",
      choices: ["A book", "An book", "The book"],
      correctIndex: 0,                    // index in choices[]
      audioCorrect: "Audio/u1_q1_correct.mp3",
      audioWrong:   "Audio/not-correct.mp3"
    },
    {
      image: "5.webp",
      question: "Choose the best answer:",
      choices: ["A apple", "An apple", "Some apple"],
      correctIndex: 1,
      audioCorrect: "Audio/u1_q2_correct.mp3",
      audioWrong:   "Audio/not-correct.mp3"
    },
    {
      image: "6.webp",
      question: "What should we say?",
      choices: ["A pen", "An pen", "Pen is"],
      correctIndex: 0,
      audioCorrect: "Audio/u1_q3_correct.mp3",
      audioWrong:   "Audio/not-correct.mp3"
    }
  ];
  
  // =====================
  // ELEMENTS
  // =====================
  const imgEl     = document.getElementById("itemImage");
  const qEl       = document.getElementById("question");
  const pill      = document.getElementById("progressPill");
  const fbEl      = document.getElementById("feedback");
  
  const prevBtn   = document.getElementById("prevBtn");
  const nextBtn   = document.getElementById("nextBtn");
  const resetBtn  = document.getElementById("resetBtn");
  
  const choiceEls = [0, 1, 2].map(i => document.getElementById("c" + i));
  
  // Results overlay
  const resultsOverlay = document.getElementById("resultsOverlay");
  const resultsText    = document.getElementById("resultsText");
  const restartBtn     = document.getElementById("restartBtn");
  const reviewBtn      = document.getElementById("reviewBtn");
  
  // Confetti
  const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const confettiCanvas = document.getElementById("confettiCanvas");
  const confettiShot   = (window.confetti && confettiCanvas)
    ? window.confetti.create(confettiCanvas, { resize: true, useWorker: true })
    : null;
  
  let lastConfettiAt = 0;
  function popConfetti() {
    if (!confettiShot || prefersReduced) return;
    const now = performance.now();
    if (now - lastConfettiAt < 500) return;
    lastConfettiAt = now;
  
    confettiShot({
      particleCount: 120,
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
  
  function playAudio(path) {
    if (!path) return;
    const a = new Audio(path);
    a.play().catch(() => {});
  }
  
  // =====================
  // RENDER
  // =====================
  function render(i) {
    const it = ITEMS[i];
    if (!it) return;
  
    answered = false;
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
  }
  
  // =====================
  // CHOICE HANDLING
  // =====================
  function onChoose(slot) {
    if (answered) return;
    const it = ITEMS[idx];
    if (!it) return;
  
    const chosenOriginalIndex = Number(
      choiceEls[slot].getAttribute("data-choice-index")
    );
    const correct = (chosenOriginalIndex === it.correctIndex);
  
    // Lock buttons after first pick
    choiceEls.forEach(b => { b.disabled = true; });
  
    if (correct) {
      score += 1; // tally correct
      setFeedback("Great!", true);
      choiceEls[slot].classList.add("correct");
      popConfetti();
      playAudio(it.audioCorrect);
  
      answered = true;
      // user can move on anytime
      nextBtn.disabled = false;
  
      // Optional: small auto-advance + show score on last one
      setTimeout(() => {
        if (idx < ITEMS.length - 1) {
          idx += 1;
          render(idx);
        } else {
          showResults();
        }
      }, 900);
  
    } else {
      setFeedback("Try again! You can go ahead.", false);
      choiceEls[slot].classList.add("incorrect");
      playAudio(it.audioWrong || "Audio/not-correct.mp3");
  
      answered = true;
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
    reviewBtn?.focus();
    popConfetti();
  }
  
  function hideResults() {
    resultsOverlay.classList.add("hidden");
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
    if (e.key === "ArrowLeft")  prevBtn.click();
    if (e.key === "ArrowRight") nextBtn.click();
  });
  
  // Preload images
  ITEMS.forEach(it => {
    const im = new Image();
    im.src = it.image;
  });
  
  // Boot
  render(idx);
  
