"use strict";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const steps = [
  {
    cue: "📘",
    words: ["It", "is", "a", "book"],
    answer: "it is a book",
    accepted: ["it is a book", "it's a book", "its a book"],
    wrong: ["it is a pen"],
    ask: "Put the words in order and say, it is a book.",
    replies: {
      correct: "Great. You made the sentence. It is a book.",
      wrong: "Good speaking, but use these words to say, it is a book.",
      silence: "I did not hear the sentence.",
      unclear: "Try saying the full sentence slowly. It is a book."
    }
  },
  {
    cue: "🍎",
    words: ["This", "is", "an", "apple"],
    answer: "this is an apple",
    accepted: ["this is an apple", "this is apple"],
    wrong: ["this is a apple", "that is an apple"],
    ask: "Build the sentence and say, this is an apple.",
    replies: {
      correct: "Yes. This is an apple.",
      wrong: "Almost. The sentence is, this is an apple.",
      silence: "No voice came through. Try again.",
      unclear: "I heard something, but not the full sentence."
    }
  },
  {
    cue: "🐱",
    words: ["The", "cat", "is", "small"],
    answer: "the cat is small",
    accepted: ["the cat is small"],
    wrong: ["the dog is small", "cat is small"],
    ask: "Say the sentence. The cat is small.",
    replies: {
      correct: "Correct. The cat is small.",
      wrong: "That was a sentence, but the target is, the cat is small.",
      silence: "I did not hear the sentence. Try again.",
      unclear: "Try again. The cat is small."
    }
  },
  {
    cue: "🚗",
    words: ["That", "is", "a", "car"],
    answer: "that is a car",
    accepted: ["that is a car", "that's a car", "thats a car"],
    wrong: ["this is a car", "that is car"],
    ask: "Put the words together. That is a car.",
    replies: {
      correct: "Nice work. That is a car.",
      wrong: "Good try. Use that, not this. That is a car.",
      silence: "I did not hear you.",
      unclear: "Please say, that is a car."
    }
  },
  {
    cue: "🍎🍎",
    words: ["There", "are", "two", "apples"],
    answer: "there are two apples",
    accepted: ["there are two apples", "there're two apples", "there are 2 apples"],
    wrong: ["there is two apples", "there are three apples"],
    ask: "Say the full sentence. There are two apples.",
    replies: {
      correct: "Excellent. There are two apples.",
      wrong: "Good effort. The sentence is, there are two apples.",
      silence: "I did not hear a sentence.",
      unclear: "Try saying each word. There are two apples."
    }
  }
];

const els = {
  coachBubble: document.getElementById("coachBubble"),
  stepCounter: document.getElementById("stepCounter"),
  scoreCounter: document.getElementById("scoreCounter"),
  promptType: document.getElementById("promptType"),
  resultBadge: document.getElementById("resultBadge"),
  pictureCue: document.getElementById("pictureCue"),
  wordBank: document.getElementById("wordBank"),
  targetHint: document.getElementById("targetHint"),
  listenStatus: document.querySelector(".listen-status"),
  statusText: document.getElementById("statusText"),
  transcriptText: document.getElementById("transcriptText"),
  askBtn: document.getElementById("askBtn"),
  micBtn: document.getElementById("micBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  resetBtn: document.getElementById("resetBtn")
};

let index = 0;
let score = 0;
let recognition = null;
let silenceTimer = null;
let isListening = false;
let shouldAutoListen = false;
let advanceTimer = null;
const credited = new Set();

function normalizeSpeech(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\bits\b/g, "it is")
    .replace(/\bthats\b/g, "that is")
    .replace(/\btherere\b/g, "there are")
    .replace(/\s+/g, " ")
    .trim();
}

function speak(text, onDone) {
  els.coachBubble.textContent = text;
  if (!("speechSynthesis" in window)) {
    if (typeof onDone === "function") {
      window.setTimeout(onDone, 250);
    }
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  utterance.pitch = 1.05;
  utterance.onend = () => {
    if (typeof onDone === "function") onDone();
  };
  utterance.onerror = () => {
    if (typeof onDone === "function") onDone();
  };
  window.speechSynthesis.speak(utterance);
}

function setStatus(text, state = "ready") {
  els.statusText.textContent = text;
  els.listenStatus.dataset.state = state;
}

function updateScore() {
  els.scoreCounter.textContent = `${score} correct`;
}

function scheduleNextStep() {
  window.clearTimeout(advanceTimer);
  if (index >= steps.length - 1) return;

  advanceTimer = window.setTimeout(() => {
    index += 1;
    renderStep();
  }, 650);
}

function setResultBadge(text, state) {
  if (!els.resultBadge) return;
  if (!state) {
    els.resultBadge.classList.add("hidden");
    els.resultBadge.removeAttribute("data-state");
    els.resultBadge.textContent = "";
    return;
  }
  els.resultBadge.textContent = text;
  els.resultBadge.dataset.state = state;
  els.resultBadge.classList.remove("hidden");
}

function acceptedPhrases(step) {
  return [step.answer, ...(step.accepted || [])].map(normalizeSpeech);
}

function classify(transcript) {
  const step = steps[index];
  const normalized = normalizeSpeech(transcript);
  if (!normalized) return { kind: "silence", normalized };

  if (acceptedPhrases(step).includes(normalized)) {
    return { kind: "correct", normalized };
  }

  const wrongPhrases = (step.wrong || []).map(normalizeSpeech);
  if (wrongPhrases.includes(normalized)) {
    return { kind: "wrong", normalized };
  }

  if (acceptedPhrases(step).some((phrase) => phrase.length > 4 && normalized.includes(phrase))) {
    return { kind: "correct", normalized };
  }

  if (wrongPhrases.some((phrase) => phrase.length > 4 && normalized.includes(phrase))) {
    return { kind: "wrong", normalized };
  }

  return { kind: "unclear", normalized };
}

function handleClassification(result) {
  const step = steps[index];

  if (result.normalized) {
    els.transcriptText.textContent = result.normalized;
  }

  if (result.kind === "correct") {
    if (!credited.has(index)) {
      credited.add(index);
      score += 1;
    }
    setResultBadge("Correct!", "correct");
    updateScore();
    setStatus("Sentence correct", "correct");
    speak(step.replies.correct, scheduleNextStep);
    return;
  }

  if (result.kind === "wrong") {
    setResultBadge("Try again", "wrong");
    setStatus("Known wrong sentence", "wrong");
    speak(step.replies.wrong);
    return;
  }

  if (result.kind === "silence") {
    els.transcriptText.textContent = "No speech detected";
    setResultBadge("Try again", "wrong");
    setStatus("Silence", "unclear");
    speak(step.replies.silence);
    return;
  }

  setResultBadge("Try again", "wrong");
  setStatus("Unclear sentence", "unclear");
  speak(step.replies.unclear);
}

function renderStep() {
  const step = steps[index];
  shouldAutoListen = true;
  setResultBadge("", null);
  window.speechSynthesis?.cancel();

  els.stepCounter.textContent = `${index + 1}/${steps.length}`;
  els.pictureCue.textContent = step.cue;
  els.wordBank.innerHTML = step.words
    .map((word) => `<span class="word-tile">${word}</span>`)
    .join("");
  els.targetHint.textContent = "Say the full sentence.";
  els.transcriptText.textContent = "Nothing yet";
  els.prevBtn.disabled = index === 0;
  els.nextBtn.disabled = index === steps.length - 1;
  setStatus("Ready", "ready");
  speak(step.ask, () => {
    if (shouldAutoListen) startListening();
  });
}

function ensureRecognition() {
  if (!SpeechRecognition) return null;
  if (recognition) return recognition;

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 3;
  recognition.continuous = false;

  recognition.onstart = () => {
    isListening = true;
    window.speechSynthesis?.cancel();
    setStatus("Listening", "listening");
    els.micBtn.disabled = true;
    silenceTimer = window.setTimeout(() => {
      try {
        recognition.stop();
      } catch (error) {
        // Recognition may already have stopped.
      }
      handleClassification({ kind: "silence", normalized: "" });
    }, 5600);
  };

  recognition.onresult = (event) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    const best = Array.from(event.results?.[0] || [])[0]?.transcript || "";
    els.transcriptText.textContent = best || "No speech detected";
    handleClassification(classify(best));
  };

  recognition.onerror = (event) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    handleClassification({ kind: event.error === "no-speech" ? "silence" : "unclear", normalized: "" });
  };

  recognition.onend = () => {
    isListening = false;
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    els.micBtn.disabled = !SpeechRecognition;
    if (els.listenStatus.dataset.state === "listening") {
      setStatus("Ready", "ready");
    }
  };

  return recognition;
}

function startListening() {
  shouldAutoListen = false;
  const recognizer = ensureRecognition();
  if (!recognizer) {
    setStatus("Speech recognition unavailable", "unclear");
    speak("This browser cannot use speech recognition. Try Chrome on Android or desktop Chrome.");
    return;
  }

  if (isListening) return;

  try {
    recognizer.start();
  } catch (error) {
    setStatus("Mic is already starting", "listening");
  }
}

function setSupportState() {
  if (SpeechRecognition) return;
  els.micBtn.disabled = true;
  setStatus("Speech recognition unavailable", "unclear");
}

els.askBtn.addEventListener("click", () => {
  shouldAutoListen = true;
  setResultBadge("", null);
  els.transcriptText.textContent = "Nothing yet";
  speak(steps[index].ask, () => {
    if (shouldAutoListen) startListening();
  });
});
els.micBtn.addEventListener("click", startListening);
els.prevBtn.addEventListener("click", () => {
  if (index > 0) {
    window.clearTimeout(advanceTimer);
    index -= 1;
    renderStep();
  }
});
els.nextBtn.addEventListener("click", () => {
  if (index < steps.length - 1) {
    window.clearTimeout(advanceTimer);
    index += 1;
    renderStep();
  }
});
els.resetBtn.addEventListener("click", () => {
  window.clearTimeout(advanceTimer);
  index = 0;
  score = 0;
  credited.clear();
  updateScore();
  renderStep();
});

setSupportState();
updateScore();
renderStep();
