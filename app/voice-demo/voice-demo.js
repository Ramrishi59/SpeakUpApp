"use strict";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const questions = [
  {
    type: "Name the picture",
    question: "What is this?",
    cue: "📘",
    ask: "What is this? Say, it is a book.",
    correct: ["it is a book", "it's a book", "its a book", "a book", "book"],
    wrong: {
      "it is a pen": ["it is a pen", "it's a pen", "its a pen", "a pen", "pen"],
      "it is an apple": ["it is an apple", "it's an apple", "its an apple", "an apple", "apple"]
    },
    replies: {
      correct: "Great. It is a book.",
      wrong: "That was a clear answer, but this picture is a book.",
      silence: "I did not hear you. Tap Speak and try again.",
      unclear: "I heard your voice, but I could not match the answer. Try saying, it is a book."
    }
  },
  {
    type: "Choose a color",
    question: "What color is the sun?",
    cue: "☀️",
    ask: "What color is the sun?",
    correct: ["yellow", "it is yellow", "it's yellow", "its yellow", "the sun is yellow"],
    wrong: {
      blue: ["blue", "it is blue", "the sun is blue"],
      green: ["green", "it is green", "the sun is green"]
    },
    replies: {
      correct: "Yes. The sun is yellow.",
      wrong: "Good speaking. The answer here is yellow.",
      silence: "No voice came through. Try once more.",
      unclear: "I heard something, but not the color. Say yellow."
    }
  },
  {
    type: "Say the sentence",
    question: "Say: I am happy",
    cue: "😊",
    ask: "Say this sentence. I am happy.",
    correct: ["i am happy", "i'm happy", "im happy"],
    wrong: {
      "i am sad": ["i am sad", "i'm sad", "im sad"],
      "i am hungry": ["i am hungry", "i'm hungry", "im hungry"]
    },
    replies: {
      correct: "Nice sentence. I am happy.",
      wrong: "You said a sentence, but the target sentence is I am happy.",
      silence: "I did not hear the sentence.",
      unclear: "Try again slowly. I am happy."
    }
  },
  {
    type: "Animal sound",
    question: "What animal says meow?",
    cue: "🐱",
    ask: "What animal says meow?",
    correct: ["cat", "a cat", "the cat", "it is a cat", "it's a cat", "its a cat"],
    wrong: {
      dog: ["dog", "a dog", "the dog"],
      cow: ["cow", "a cow", "the cow"]
    },
    replies: {
      correct: "Correct. A cat says meow.",
      wrong: "That animal makes a different sound. A cat says meow.",
      silence: "Say the animal name after you tap Speak.",
      unclear: "I could not match that animal. Say cat."
    }
  },
  {
    type: "Count and answer",
    question: "How many apples?",
    cue: "🍎🍎",
    ask: "How many apples can you see?",
    correct: ["two", "2", "two apples", "there are two", "there are two apples"],
    wrong: {
      one: ["one", "1", "one apple"],
      three: ["three", "3", "three apples"]
    },
    replies: {
      correct: "Yes. There are two apples.",
      wrong: "Good try. Count again. There are two apples.",
      silence: "I did not hear a number.",
      unclear: "Please say the number. Two."
    }
  }
];

const els = {
  supportBadge: document.getElementById("supportBadge"),
  mankuBubble: document.getElementById("mankuBubble"),
  questionCounter: document.getElementById("questionCounter"),
  scoreCounter: document.getElementById("scoreCounter"),
  promptType: document.getElementById("promptType"),
  questionText: document.getElementById("questionText"),
  visualCue: document.getElementById("visualCue"),
  listenStatus: document.querySelector(".listen-status"),
  statusText: document.getElementById("statusText"),
  transcriptText: document.getElementById("transcriptText"),
  askBtn: document.getElementById("askBtn"),
  micBtn: document.getElementById("micBtn"),
  repeatBtn: document.getElementById("repeatBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  resetBtn: document.getElementById("resetBtn"),
  answerChips: Array.from(document.querySelectorAll(".answer-chip"))
};

let index = 0;
let score = 0;
let lastReply = "Tap Ask, then answer with your voice.";
let recognition = null;
let silenceTimer = null;
let isListening = false;
const answeredCorrectly = new Set();

function normalizeSpeech(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\bits\b/g, "it is")
    .replace(/\bim\b/g, "i am")
    .replace(/\bi m\b/g, "i am")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(list) {
  return list.map(normalizeSpeech).filter(Boolean);
}

function speak(text) {
  lastReply = text;
  els.mankuBubble.textContent = text;

  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
}

function setStatus(text, state = "ready") {
  els.statusText.textContent = text;
  els.listenStatus.dataset.state = state;
}

function getWrongEntries(question) {
  return Object.entries(question.wrong || {}).map(([label, phrases]) => ({
    label,
    phrases: normalizeList(phrases)
  }));
}

function classifyTranscript(transcript) {
  const question = questions[index];
  const normalized = normalizeSpeech(transcript);

  if (!normalized) {
    return { kind: "silence", normalized };
  }

  const correctPhrases = normalizeList(question.correct);
  if (correctPhrases.includes(normalized)) {
    return { kind: "correct", normalized };
  }

  const wrongMatch = getWrongEntries(question).find((entry) => entry.phrases.includes(normalized));
  if (wrongMatch) {
    return { kind: "wrong", normalized, label: wrongMatch.label };
  }

  const looseCorrect = correctPhrases.find((phrase) => phrase.length > 2 && normalized.includes(phrase));
  if (looseCorrect) {
    return { kind: "correct", normalized };
  }

  const looseWrong = getWrongEntries(question).find((entry) => {
    return entry.phrases.some((phrase) => phrase.length > 2 && normalized.includes(phrase));
  });

  if (looseWrong) {
    return { kind: "wrong", normalized, label: looseWrong.label };
  }

  return { kind: "unclear", normalized };
}

function answerFromClassification(classification) {
  const question = questions[index];
  clearChipStates();

  if (classification.normalized) {
    els.transcriptText.textContent = classification.normalized;
  }

  if (classification.kind === "correct") {
    if (!answeredCorrectly.has(index)) {
      answeredCorrectly.add(index);
      score += 1;
    }
    setStatus("Correct answer", "correct");
    markChip(0, "correct");
    updateScore();
    speak(question.replies.correct);
    return;
  }

  if (classification.kind === "wrong") {
    setStatus(`Known wrong answer: ${classification.label}`, "wrong");
    markChip(findWrongChipIndex(classification.label), "wrong");
    speak(question.replies.wrong);
    return;
  }

  if (classification.kind === "silence") {
    els.transcriptText.textContent = "No speech detected";
    setStatus("Silence", "unclear");
    speak(question.replies.silence);
    return;
  }

  setStatus("Unclear answer", "unclear");
  speak(question.replies.unclear);
}

function findWrongChipIndex(label) {
  const question = questions[index];
  const wrongLabels = Object.keys(question.wrong || {});
  const found = wrongLabels.indexOf(label);
  return found >= 0 ? found + 1 : 1;
}

function clearChipStates() {
  els.answerChips.forEach((chip) => {
    chip.removeAttribute("data-result");
  });
}

function markChip(chipIndex, result) {
  const chip = els.answerChips[chipIndex];
  if (chip) chip.dataset.result = result;
}

function updateScore() {
  els.scoreCounter.textContent = `${score} correct`;
}

function renderQuestion() {
  const question = questions[index];
  clearChipStates();
  window.speechSynthesis?.cancel();

  els.questionCounter.textContent = `${index + 1}/${questions.length}`;
  els.promptType.textContent = question.type;
  els.questionText.textContent = question.question;
  els.visualCue.textContent = question.cue;
  els.transcriptText.textContent = "Nothing yet";
  els.prevBtn.disabled = index === 0;
  els.nextBtn.disabled = index === questions.length - 1;
  els.answerChips[0].textContent = question.correct[0];

  Object.keys(question.wrong || {}).slice(0, 2).forEach((label, wrongIndex) => {
    els.answerChips[wrongIndex + 1].textContent = label;
  });

  setStatus("Ready", "ready");
  speak(question.ask);
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
      answerFromClassification({ kind: "silence", normalized: "" });
    }, 5200);
  };

  recognition.onresult = (event) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    const alternatives = Array.from(event.results?.[0] || []);
    const best = alternatives[0]?.transcript || "";
    els.transcriptText.textContent = best || "No speech detected";
    answerFromClassification(classifyTranscript(best));
  };

  recognition.onerror = (event) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    const isSilence = event.error === "no-speech";
    answerFromClassification({ kind: isSilence ? "silence" : "unclear", normalized: "" });
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
  const recognizer = ensureRecognition();
  if (!recognizer) {
    setStatus("Speech recognition unavailable", "unclear");
    speak("This browser cannot use speech recognition. Try Chrome on Android or desktop Chrome.");
    return;
  }

  if (isListening) {
    setStatus("Listening", "listening");
    return;
  }

  try {
    recognizer.start();
  } catch (error) {
    setStatus("Mic is already starting", "listening");
  }
}

function setSupportState() {
  const canRecognize = Boolean(SpeechRecognition);
  const canSpeak = "speechSynthesis" in window;

  if (canRecognize && canSpeak) {
    els.supportBadge.textContent = "Voice ready";
    els.supportBadge.dataset.state = "on";
    return;
  }

  if (canSpeak) {
    els.supportBadge.textContent = "Tap fallback";
    els.supportBadge.dataset.state = "off";
    els.micBtn.disabled = true;
    return;
  }

  els.supportBadge.textContent = "Limited";
  els.supportBadge.dataset.state = "off";
  els.micBtn.disabled = true;
}

els.askBtn.addEventListener("click", () => speak(questions[index].ask));
els.micBtn.addEventListener("click", startListening);
els.repeatBtn.addEventListener("click", () => speak(lastReply));
els.prevBtn.addEventListener("click", () => {
  if (index > 0) {
    index -= 1;
    renderQuestion();
  }
});
els.nextBtn.addEventListener("click", () => {
  if (index < questions.length - 1) {
    index += 1;
    renderQuestion();
  }
});
els.resetBtn.addEventListener("click", () => {
  index = 0;
  score = 0;
  answeredCorrectly.clear();
  updateScore();
  renderQuestion();
});

els.answerChips.forEach((chip, chipIndex) => {
  chip.addEventListener("click", () => {
    if (chipIndex === 0) {
      answerFromClassification({ kind: "correct", normalized: chip.textContent });
      return;
    }

    answerFromClassification({
      kind: "wrong",
      normalized: chip.textContent,
      label: chip.textContent
    });
  });
});

setSupportState();
updateScore();
renderQuestion();
