"use strict";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const audioPath = (number) => `Audio/${String(number).padStart(2, "0")}_Chapter 1.mp3`;
const imagePath = (number) => `Images/${number}.webp`;

const scenes = [
  {
    id: "intro",
    label: "Intro",
    image: 1,
    audio: 1,
    next: 1
  },
  {
    id: "hi",
    label: "Hello",
    image: 2,
    audio: 2,
    acceptAny: true,
    accepted: ["hi manku", "hi", "hello manku", "hello"],
    feedback: {
      image: 3,
      audio: 3,
      label: "Great"
    }
  },
  {
    id: "book",
    label: "1/7",
    image: 4,
    audio: 4,
    accepted: ["a book", "book"],
    feedback: {
      image: 5,
      audio: 5,
      label: "Nice"
    }
  },
  {
    id: "apple",
    label: "2/7",
    image: 6,
    audio: 6,
    accepted: ["an apple", "apple"],
    feedback: {
      image: 7,
      audio: 7,
      label: "Very good"
    }
  },
  {
    id: "pen-pencil",
    label: "3/7",
    image: 8,
    audio: 8,
    accepted: ["a pen and a pencil", "pen and pencil"],
    feedback: {
      image: 9,
      audio: 9,
      label: "Super"
    }
  },
  {
    id: "orange-egg",
    label: "4/7",
    image: 10,
    audio: 10,
    accepted: ["an orange and an egg", "orange and egg"],
    feedback: {
      image: 11,
      audio: 11,
      label: "Excellent"
    }
  },
  {
    id: "chair-table",
    label: "5/7",
    image: 12,
    audio: 12,
    accepted: ["i see a chair and a table", "a chair and a table", "chair and table"],
    feedback: {
      image: 13,
      audio: 13,
      label: "Well done"
    }
  },
  {
    id: "dolphin-shark",
    label: "6/7",
    image: 14,
    audio: 14,
    accepted: ["wow a dolphin and a shark", "a dolphin and a shark", "dolphin and shark"],
    feedback: {
      image: 15,
      audio: 15,
      label: "Great job"
    }
  },
  {
    id: "umbrella-eraser",
    label: "7/7",
    image: 16,
    audio: 16,
    accepted: ["an umbrella and an eraser", "umbrella and eraser"],
    feedback: {
      image: 17,
      audio: 17,
      label: "Fantastic"
    }
  },
  {
    id: "outro",
    label: "Outro",
    image: 18,
    audio: 18,
    done: true
  }
];

const els = {
  sceneImage: document.getElementById("sceneImage"),
  progressPill: document.getElementById("progressPill"),
  controlTray: document.querySelector(".control-tray"),
  statusText: document.getElementById("statusText"),
  heardText: document.getElementById("heardText"),
  fallbackRow: document.getElementById("fallbackRow"),
  playBtn: document.getElementById("playBtn"),
  micBtn: document.getElementById("micBtn"),
  replayBtn: document.getElementById("replayBtn")
};

let sceneIndex = 0;
let recognition = null;
let isListening = false;
let silenceTimer = null;
let currentAudio = null;
let hasStarted = false;
let acceptingSpeech = false;

function normalizeSpeech(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\band\b/g, "and")
    .replace(/\s+/g, " ")
    .trim();
}

function setState(text, state = "ready") {
  els.statusText.textContent = text;
  els.controlTray.dataset.state = state;
}

function stopAudio() {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio = null;
}

function stopListening() {
  acceptingSpeech = false;
  window.clearTimeout(silenceTimer);
  silenceTimer = null;
  if (!recognition || !isListening) return;

  try {
    recognition.stop();
  } catch (error) {
    // The recognizer can already be stopped by the browser.
  }
}

function showScene(scene) {
  els.sceneImage.src = imagePath(scene.image);
  els.sceneImage.alt = `Let's Speak ${scene.label}`;
  els.progressPill.textContent = scene.label;
  els.heardText.textContent = "Nothing yet";
  els.micBtn.disabled = true;
  renderFallback(scene);
}

function renderFallback(scene) {
  els.fallbackRow.replaceChildren();
  if (scene.done || !scene.accepted) return;

  const labels = scene.acceptAny ? ["Hi Manku"] : scene.accepted.slice(0, 2);
  labels.forEach((label) => {
    const button = document.createElement("button");
    button.className = "phrase-chip";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      els.heardText.textContent = label;
      handleAcceptedAnswer();
    });
    els.fallbackRow.append(button);
  });
}

function playAudio(number, onDone) {
  stopAudio();
  setState("Manku speaking", "ready");
  els.micBtn.disabled = true;

  currentAudio = new Audio(audioPath(number));
  currentAudio.preload = "auto";
  currentAudio.addEventListener("ended", () => {
    currentAudio = null;
    if (typeof onDone === "function") onDone();
  }, { once: true });
  currentAudio.addEventListener("error", () => {
    currentAudio = null;
    if (typeof onDone === "function") window.setTimeout(onDone, 250);
  }, { once: true });

  const playPromise = currentAudio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      currentAudio = null;
      setState("Tap play", "try");
    });
  }
}

function playCurrentScene() {
  const scene = scenes[sceneIndex];
  hasStarted = true;
  stopListening();
  showScene(scene);
  playAudio(scene.audio, () => {
    if (scene.next !== undefined) {
      sceneIndex = scene.next;
      playCurrentScene();
      return;
    }

    if (scene.done) {
      setState("All done", "correct");
      els.playBtn.disabled = false;
      els.micBtn.disabled = true;
      return;
    }

    startListening();
  });
}

function ensureRecognition() {
  if (!SpeechRecognition) return null;
  if (recognition) return recognition;

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;
  recognition.continuous = false;

  recognition.onstart = () => {
    isListening = true;
    acceptingSpeech = true;
    setState("Listening", "listening");
    els.micBtn.disabled = true;
    window.clearTimeout(silenceTimer);
    silenceTimer = window.setTimeout(() => {
      handleSilence();
    }, 5600);
  };

  recognition.onresult = (event) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    const alternatives = Array.from(event.results?.[0] || []);
    const transcripts = alternatives.map((item) => item.transcript || "").filter(Boolean);
    els.heardText.textContent = transcripts[0] || "Voice heard";
    classifyTranscripts(transcripts);
  };

  recognition.onerror = (event) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    if (event.error === "no-speech") {
      handleSilence();
      return;
    }
    handleTryAgain();
  };

  recognition.onend = () => {
    isListening = false;
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    if (acceptingSpeech && els.controlTray.dataset.state === "listening") {
      els.micBtn.disabled = false;
      setState("Ready", "ready");
    }
  };

  return recognition;
}

function startListening() {
  stopAudio();
  const scene = scenes[sceneIndex];
  if (scene.done) return;

  const recognizer = ensureRecognition();
  if (!recognizer) {
    setState("Tap an answer", "try");
    els.micBtn.disabled = true;
    return;
  }

  if (isListening) return;

  try {
    recognizer.start();
  } catch (error) {
    els.micBtn.disabled = false;
    setState("Ready", "ready");
  }
}

function classifyTranscripts(transcripts) {
  const scene = scenes[sceneIndex];
  if (scene.acceptAny) {
    handleAcceptedAnswer();
    return;
  }

  const accepted = scene.accepted.map(normalizeSpeech);
  const normalizedTranscripts = transcripts.map(normalizeSpeech).filter(Boolean);
  const exactMatch = normalizedTranscripts.some((text) => accepted.includes(text));
  const looseMatch = normalizedTranscripts.some((text) => {
    return accepted.some((phrase) => phrase.length > 3 && text.includes(phrase));
  });

  if (exactMatch || looseMatch) {
    handleAcceptedAnswer();
    return;
  }

  handleTryAgain();
}

function handleSilence() {
  const scene = scenes[sceneIndex];
  stopListening();

  if (scene.acceptAny) {
    els.heardText.textContent = "Voice turn";
    handleAcceptedAnswer();
    return;
  }

  els.heardText.textContent = "Nothing yet";
  handleTryAgain();
}

function handleTryAgain() {
  acceptingSpeech = false;
  setState("Try again", "try");
  els.micBtn.disabled = false;
  window.setTimeout(() => {
    if (scenes[sceneIndex]?.done) return;
    playAudio(scenes[sceneIndex].audio, startListening);
  }, 450);
}

function handleAcceptedAnswer() {
  const scene = scenes[sceneIndex];
  acceptingSpeech = false;
  stopListening();
  setState(scene.feedback.label, "correct");
  els.micBtn.disabled = true;
  els.fallbackRow.replaceChildren();
  els.sceneImage.src = imagePath(scene.feedback.image);
  els.progressPill.textContent = scene.feedback.label;

  playAudio(scene.feedback.audio, () => {
    sceneIndex += 1;
    playCurrentScene();
  });
}

els.playBtn.addEventListener("click", () => {
  if (scenes[sceneIndex]?.done) {
    sceneIndex = 0;
  }
  playCurrentScene();
});

els.micBtn.addEventListener("click", startListening);

els.replayBtn.addEventListener("click", () => {
  if (!hasStarted) {
    playCurrentScene();
    return;
  }
  playCurrentScene();
});

showScene(scenes[0]);
setState(SpeechRecognition ? "Tap play" : "Tap play", "ready");
