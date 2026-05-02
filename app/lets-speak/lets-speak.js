"use strict";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const audioPath = (number) => `Audio/${String(number).padStart(2, "0")}_Chapter 1.mp3`;
const imagePath = (number) => `Images/${number}.webp`;
const assetImagePath = (name) => `Images/${name}`;

const scenes = [
  {
    id: "intro",
    imageSrc: assetImagePath("title.png"),
    image: 1,
    audio: 1,
    prompt: "Hey! I'm Manku! Come on, let's talk together!",
    sceneKind: "title-card",
    next: 1
  },
  {
    id: "hi",
    imageSrc: assetImagePath("title.png"),
    image: 2,
    audio: 2,
    prompt: "Can you say, Hi Manku!",
    sceneKind: "title-card",
    accepted: ["hi manku", "hi manu", "hi", "hello manku", "hello manu", "hello"],
    helpPrompt: "Say: Hi Manku.",
    feedback: {
      image: 1,
      audio: 4,
      sceneKind: "no-card",
      prompt: "Hi! I'm happy to hear you!"
    }
  },
  {
    id: "book",
    image: 1,
    audio: 3,
    prompt: "Look! I have a book. Say, a book..",
    accepted: ["a book", "book", "it is a book", "this is a book"],
    helpPrompt: "Say: a book.",
    feedback: {
      image: 1,
      audio: 4,
      prompt: "Nice! A book!"
    }
  },
  {
    id: "apple",
    image: 2,
    audio: 6,
    prompt: "Oh, here is an apple. You say it!",
    accepted: ["an apple", "apple", "it is an apple", "this is an apple"],
    helpPrompt: "Say: an apple.",
    feedback: {
      image: 2,
      audio: 7,
      prompt: "Very good! An apple!"
    }
  },
  {
    id: "pen-pencil",
    image: 3,
    audio: 8,
    prompt: "Now I have two things... a pen and a pencil. Can you say it?",
    promptAudio: 9,
    accepted: [
      "a pen and a pencil",
      "pen and pencil",
      "a pencil and a pen",
      "pencil and pen",
      "pen and a pencil",
      "a pen and pencil"
    ],
    helpPrompt: "Say: a pen and a pencil.",
    feedback: {
      image: 3,
      audio: 10,
      prompt: "Super talking!"
    }
  },
  {
    id: "orange-egg",
    image: 4,
    audio: 11,
    prompt: "Yummy! I see an orange and an egg. Say it slowly?",
    accepted: [
      "an orange and an egg",
      "orange and egg",
      "an egg and an orange",
      "egg and orange",
      "orange and an egg",
      "an orange and egg"
    ],
    helpPrompt: "Say: an orange and an egg.",
    feedback: {
      image: 4,
      audio: 12,
      prompt: "Excellent speaking!"
    }
  },
  {
    id: "chair-table",
    image: 5,
    audio: 13,
    prompt: "Look in the room... a chair and a table. You try!",
    accepted: [
      "a chair and a table",
      "chair and table",
      "a table and a chair",
      "table and chair",
      "chair and a table",
      "a chair and table",
      "i see a chair and a table"
    ],
    helpPrompt: "Say: a chair and a table.",
    feedback: {
      image: 5,
      audio: 14,
      prompt: "Well done!"
    }
  },
  {
    id: "dolphin-shark",
    image: 6,
    audio: 15,
    prompt: "Wow! In the sea... a dolphin and a shark! Can you say it?",
    accepted: [
      "a dolphin and a shark",
      "dolphin and shark",
      "a shark and a dolphin",
      "shark and dolphin",
      "dolphin and a shark",
      "a dolphin and shark",
      "wow a dolphin and a shark"
    ],
    helpPrompt: "Say: a dolphin and a shark.",
    feedback: {
      image: 6,
      audio: 16,
      prompt: "Great job!"
    }
  },
  {
    id: "umbrella-eraser",
    image: 7,
    audio: 17,
    prompt: "Last one... an umbrella and an eraser. Say it with me!",
    accepted: [
      "an umbrella and an eraser",
      "umbrella and eraser",
      "an eraser and an umbrella",
      "eraser and umbrella",
      "umbrella and an eraser",
      "an umbrella and eraser"
    ],
    helpPrompt: "Say: an umbrella and an eraser.",
    feedback: {
      image: 7,
      audio: 18,
      prompt: "Fantastic talking!"
    }
  },
  {
    id: "outro",
    image: 7,
    audio: null,
    prompt: "You said so many words! I loved talking with you!",
    done: true
  }
];

const els = {
  heroPanel: document.querySelector(".hero-panel"),
  practicePanel: document.querySelector(".practice-panel"),
  promptText: document.getElementById("promptText"),
  artCard: document.querySelector(".art-card"),
  sceneImage: document.getElementById("sceneImage"),
  statusText: document.getElementById("statusText"),
  heardText: document.getElementById("heardText"),
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
let retryTimer = null;
let fitPromptFrame = null;
let retryCount = 0;

function syncAppHeight() {
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
  schedulePromptFit();
}

function fitPromptText() {
  const prompt = els.promptText;
  if (!prompt) return;

  prompt.style.fontSize = "";

  const computed = window.getComputedStyle(prompt);
  let fontSize = parseFloat(computed.fontSize) || 28;
  const minFontSize = 22;

  while (prompt.scrollHeight > prompt.clientHeight + 1 && fontSize > minFontSize) {
    fontSize -= 1;
    prompt.style.fontSize = `${fontSize}px`;
  }
}

function schedulePromptFit() {
  window.cancelAnimationFrame(fitPromptFrame);
  fitPromptFrame = window.requestAnimationFrame(() => {
    fitPromptText();
  });
}

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

function keywordTokens(value) {
  return normalizeSpeech(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !["a", "an", "the", "is", "this", "it", "i"].includes(token));
}

function phraseMatchesTranscript(phrase, transcript) {
  const normalizedPhrase = normalizeSpeech(phrase);
  const normalizedTranscript = normalizeSpeech(transcript);

  if (!normalizedPhrase || !normalizedTranscript) return false;
  if (normalizedTranscript === normalizedPhrase) return true;
  if (normalizedTranscript.includes(normalizedPhrase)) return true;

  const phraseTokens = keywordTokens(normalizedPhrase);
  const transcriptTokens = keywordTokens(normalizedTranscript);
  if (!phraseTokens.length || !transcriptTokens.length) return false;

  return phraseTokens.every((token) => transcriptTokens.includes(token));
}

function sceneSpecificMatch(scene, transcript) {
  const normalizedTranscript = normalizeSpeech(transcript);
  const tokens = keywordTokens(normalizedTranscript);

  if (scene.id === "hi") {
    const hasGreeting = tokens.includes("hi") || tokens.includes("hello") || normalizedTranscript.startsWith("hi ") || normalizedTranscript.startsWith("hello ");
    const hasMankuLikeWord =
      tokens.includes("manku") ||
      tokens.includes("manu") ||
      tokens.includes("manku!") ||
      tokens.includes("mancoo") ||
      tokens.includes("manku?") ||
      tokens.includes("manko") ||
      tokens.includes("monkey") ||
      tokens.includes("mancu") ||
      normalizedTranscript.includes("manku") ||
      normalizedTranscript.includes("manu") ||
      normalizedTranscript.includes("manko") ||
      normalizedTranscript.includes("monkey");

    return hasGreeting || (hasGreeting && hasMankuLikeWord);
  }

  if (scene.id === "book") {
    return (
      tokens.includes("book") ||
      tokens.includes("buck") ||
      normalizedTranscript.includes("a book") ||
      normalizedTranscript.includes("the book") ||
      normalizedTranscript.includes("this is a book") ||
      normalizedTranscript.includes("it is a book")
    );
  }

  return false;
}

function setState(text, state = "ready") {
  els.statusText.textContent = text;
  els.practicePanel.dataset.state = state;
}

function clearRetryTimer() {
  window.clearTimeout(retryTimer);
  retryTimer = null;
}

function stopAudio() {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio = null;
}

function stopListening() {
  window.clearTimeout(silenceTimer);
  silenceTimer = null;
  if (!recognition || !isListening) return;

  try {
    recognition.stop();
  } catch (error) {
    // Browser may already have stopped recognition.
  }
}

function showScene(scene, overridePrompt = scene.prompt) {
  els.heroPanel.dataset.scene = scene.id;
  els.promptText.textContent = overridePrompt;
  els.sceneImage.src = scene.imageSrc || imagePath(scene.image);
  els.sceneImage.alt = overridePrompt;
  els.sceneImage.dataset.sceneKind = scene.sceneKind || "practice";
  els.artCard.dataset.mode = scene.sceneKind === "no-card" ? "hidden" : "image";
  els.heardText.textContent = "Nothing yet";
  els.micBtn.disabled = true;
  schedulePromptFit();
}

function playAudio(number, onDone) {
  if (!number) {
    if (typeof onDone === "function") {
      window.setTimeout(onDone, 50);
    }
    return;
  }

  clearRetryTimer();
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
      setState("Tap the mic", "try");
      els.micBtn.disabled = false;
    });
  }
}

function playCurrentScene() {
  const scene = scenes[sceneIndex];
  hasStarted = true;
  clearRetryTimer();
  acceptingSpeech = false;
  retryCount = 0;
  stopListening();
  showScene(scene);
  playAudio(scene.audio, () => {
    if (scene.promptAudio) {
      playAudio(scene.promptAudio, () => {
        startSceneInteraction(scene);
      });
      return;
    }

    startSceneInteraction(scene);
  });
}

function startSceneInteraction(scene) {
  if (scene.next !== undefined) {
    sceneIndex = scene.next;
    playCurrentScene();
    return;
  }

  if (scene.done) {
    setState("Replay anytime", "correct");
    els.micBtn.disabled = true;
    return;
  }

  startListening();
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
    acceptingSpeech = true;
    setState("Listening", "listening");
    els.micBtn.disabled = true;
    silenceTimer = window.setTimeout(handleSilence, 5600);
  };

  recognition.onresult = (event) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    const best = Array.from(event.results?.[0] || [])[0]?.transcript || "";
    els.heardText.textContent = best || "Voice heard";
    classifyTranscripts(best ? [best] : []);
  };

  recognition.onerror = (event) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    if (event.error === "not-allowed" || event.error === "audio-capture") {
      acceptingSpeech = false;
      els.micBtn.disabled = false;
      setState("Mic permission needed", "try");
      return;
    }
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
    if (acceptingSpeech && els.practicePanel.dataset.state === "listening") {
      els.micBtn.disabled = false;
      setState("Tap the mic", "ready");
    }
  };

  return recognition;
}

function startListening() {
  stopAudio();
  clearRetryTimer();
  const scene = scenes[sceneIndex];
  if (scene.done) return;

  const recognizer = ensureRecognition();
  if (!recognizer) {
    setState("Speech recognition unavailable", "try");
    els.micBtn.disabled = true;
    return;
  }

  if (isListening) return;

  try {
    recognizer.start();
  } catch (error) {
    els.micBtn.disabled = false;
    setState("Tap the mic", "ready");
  }
}

function classifyTranscripts(transcripts) {
  const scene = scenes[sceneIndex];
  if (!transcripts.length) {
    handleTryAgain();
    return;
  }

  const sceneMatched = transcripts.some((transcript) => sceneSpecificMatch(scene, transcript));
  if (sceneMatched) {
    handleAcceptedAnswer();
    return;
  }

  const matched = transcripts.some((transcript) => {
    return scene.accepted.some((phrase) => phraseMatchesTranscript(phrase, transcript));
  });

  if (matched) {
    handleAcceptedAnswer();
    return;
  }

  handleTryAgain();
}

function handleSilence() {
  acceptingSpeech = false;
  stopListening();

  els.heardText.textContent = "Nothing yet";
  handleTryAgain();
}

function handleTryAgain() {
  retryCount += 1;
  if (retryCount >= 3) {
    handleAdvanceAfterRetries();
    return;
  }

  acceptingSpeech = false;
  setState(retryCount === 1 ? "Say it again" : "One more time", "try");
  els.micBtn.disabled = false;
  clearRetryTimer();
  retryTimer = window.setTimeout(() => {
    if (scenes[sceneIndex]?.done) return;
    const scene = scenes[sceneIndex];
    els.promptText.textContent = scene.helpPrompt || scene.prompt;
    playAudio(scene.audio, () => {
      if (scene.promptAudio) {
        playAudio(scene.promptAudio, startListening);
        return;
      }

      startListening();
    });
  }, 450);
}

function handleAdvanceAfterRetries() {
  const scene = scenes[sceneIndex];

  acceptingSpeech = false;
  clearRetryTimer();
  stopListening();
  stopAudio();
  els.micBtn.disabled = true;
  setState("Right!", "correct");
  els.heardText.textContent = "Moving on";
  els.promptText.textContent = scene.prompt;
  els.sceneImage.src = scene.imageSrc || imagePath(scene.image);
  els.sceneImage.alt = scene.prompt;
  els.sceneImage.dataset.sceneKind = scene.sceneKind || "practice";
  els.artCard.dataset.mode = scene.sceneKind === "no-card" ? "hidden" : "image";
  schedulePromptFit();

  window.setTimeout(() => {
    sceneIndex += 1;
    playCurrentScene();
  }, 850);
}

function handleAcceptedAnswer() {
  const scene = scenes[sceneIndex];
  const feedback = scene.feedback || {};
  acceptingSpeech = false;
  clearRetryTimer();
  stopListening();
  retryCount = 0;
  setState("Great job!", "correct");
  els.micBtn.disabled = true;
  els.promptText.textContent = feedback.prompt || scene.prompt;
  els.sceneImage.src = imagePath(feedback.image || scene.image);
  els.sceneImage.alt = feedback.prompt || scene.prompt;
  els.sceneImage.dataset.sceneKind = feedback.sceneKind || "practice";
  els.artCard.dataset.mode = feedback.sceneKind === "no-card" ? "hidden" : "image";
  schedulePromptFit();

  window.setTimeout(() => {
    playAudio(feedback.audio, () => {
      sceneIndex += 1;
      playCurrentScene();
    });
  }, 420);
}

els.micBtn.addEventListener("click", () => {
  if (!hasStarted || scenes[sceneIndex]?.done) {
    sceneIndex = scenes[sceneIndex]?.done ? 0 : sceneIndex;
    playCurrentScene();
    return;
  }

  startListening();
});

els.replayBtn.addEventListener("click", () => {
  clearRetryTimer();
  acceptingSpeech = false;
  stopListening();
  if (!hasStarted) {
    playCurrentScene();
    return;
  }

  if (scenes[sceneIndex]?.done) {
    sceneIndex = 0;
  }
  playCurrentScene();
});

syncAppHeight();
window.addEventListener("resize", syncAppHeight);
window.addEventListener("orientationchange", syncAppHeight);

showScene(scenes[0]);
setState(SpeechRecognition ? "Tap the mic" : "Speech recognition unavailable", "ready");
els.micBtn.disabled = false;
