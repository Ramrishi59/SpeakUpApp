"use strict";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const params = new URLSearchParams(window.location.search);
const activityId = params.get("activity") || "activity1";
const DATA_URL = `json/${activityId}.json`;
const DEFAULT_SCENE = {
  id: "load-error",
  image: "Images/1/title.png",
  audio: null,
  prompt: "Could not load this activity.",
  sceneKind: "title-card",
  done: true
};

let scenes = [];
let fallbackAudios = [];
let outroAudios = [];
let presenter = {};
let fallbackAudioBase = "Audio/fallback/";
let outroAudioBase = "Audio/outro/";
let dataLoaded = false;

const els = {
  heroPanel: document.querySelector(".hero-panel"),
  practicePanel: document.querySelector(".practice-panel"),
  avatar: document.querySelector(".manku-avatar"),
  promptText: document.getElementById("promptText"),
  artCard: document.querySelector(".art-card"),
  sceneImage: document.getElementById("sceneImage"),
  statusText: document.getElementById("statusText"),
  heardText: document.getElementById("heardText"),
  micBtn: document.getElementById("micBtn"),
  replayBtn: document.getElementById("replayBtn"),
  jumpToEndBtn: document.getElementById("jumpToEndBtn")
};

let sceneIndex = 0;
let recognition = null;
let isListening = false;
let silenceTimer = null;
let currentAudio = new Audio();
currentAudio.preload = "auto";
let hasStarted = false;
let acceptingSpeech = false;
let retryTimer = null;
let fitPromptFrame = null;
let retryCount = 0;
const READY_STATUS_TEXT = "Tap the Mic, say something";

function hasPathPrefix(value) {
  return /^(?:https?:|data:|blob:|\.{0,2}\/|Audio\/|Images\/)/i.test(String(value || ""));
}

function resolveAudioSource(src, basePath = "Audio/") {
  if (!src) return null;
  return hasPathPrefix(src) ? src : `${basePath}${src}`;
}

function resolveImageSource(sceneOrImage) {
  const image = typeof sceneOrImage === "object"
    ? (sceneOrImage.imageSrc || sceneOrImage.image)
    : sceneOrImage;

  if (!image) return "Images/1/title.png";
  if (typeof image === "number") return `Images/${image}.webp`;
  if (hasPathPrefix(image) || /\.[a-z0-9]+(?:\?|$)/i.test(image)) return image;
  return `Images/${image}.webp`;
}

function normalizeBasePath(path) {
  if (!path) return "";
  return path.endsWith("/") ? path : `${path}/`;
}

function presenterAudioBase(folderName, configuredBase) {
  if (presenter.id) return `Audio/${folderName}/${presenter.id}/`;
  return normalizeBasePath(configuredBase || `Audio/${folderName}/`);
}

function resolveJsonReference(src) {
  return new URL(src, new URL(DATA_URL, window.location.href)).toString();
}

async function loadAudioList(value, listName) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  const res = await fetch(resolveJsonReference(value), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${listName} ${value}`);

  const json = await res.json();
  if (Array.isArray(json)) return json;
  return Array.isArray(json?.items) ? json.items : [];
}

async function loadActivityData() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}`);

  const json = await res.json();
  scenes = Array.isArray(json) ? json : (json?.scenes || json?.items || []);
  presenter = json?.presenter || {};
  fallbackAudios = await loadAudioList(json?.fallbackAudios, "fallback audios");
  outroAudios = await loadAudioList(json?.outroAudios, "outro audios");
  fallbackAudioBase = presenterAudioBase("fallback", presenter.fallbackAudioBase || json?.fallbackAudioBase);
  outroAudioBase = presenterAudioBase("outro", presenter.outroAudioBase || json?.outroAudioBase);

  if (!scenes.length) {
    throw new Error(`${DATA_URL} does not contain scenes`);
  }

  dataLoaded = true;
}

function applyPresenter() {
  if (!els.avatar || !presenter.avatar) return;
  els.avatar.src = resolveImageSource(presenter.avatar);
  els.avatar.alt = presenter.name || "Presenter";
}

function presenterName() {
  return presenter.name || "Presenter";
}

function getOutroSceneIndex() {
  return scenes.findIndex((scene) => scene.done);
}

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

  if (scene.id === "hi-reena") {
    const hasGreeting =
      tokens.includes("hi") ||
      tokens.includes("hello") ||
      tokens.includes("hey") ||
      tokens.includes("hay") ||
      tokens.includes("high") ||
      normalizedTranscript.startsWith("hi ") ||
      normalizedTranscript.startsWith("hello ") ||
      normalizedTranscript.startsWith("hey ") ||
      normalizedTranscript.startsWith("hay ") ||
      normalizedTranscript.startsWith("high ");
    const hasReenaLikeWord =
      tokens.includes("reena") ||
      tokens.includes("rina") ||
      tokens.includes("rena") ||
      tokens.includes("arena") ||
      tokens.includes("ree na") ||
      normalizedTranscript.includes("reena") ||
      normalizedTranscript.includes("rina") ||
      normalizedTranscript.includes("rena") ||
      normalizedTranscript.includes("arena");

    return hasGreeting || hasReenaLikeWord;
  }

  if (scene.id === "hi") {
    const hasGreeting =
      tokens.includes("hi") ||
      tokens.includes("hello") ||
      tokens.includes("hey") ||
      tokens.includes("hay") ||
      tokens.includes("high") ||
      normalizedTranscript.startsWith("hi ") ||
      normalizedTranscript.startsWith("hello ") ||
      normalizedTranscript.startsWith("hey ") ||
      normalizedTranscript.startsWith("hay ") ||
      normalizedTranscript.startsWith("high ");
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

    return hasGreeting || hasMankuLikeWord;
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

function setHeardText(text) {
  if (els.heardText) {
    els.heardText.textContent = text;
  }
}

function clearRetryTimer() {
  window.clearTimeout(retryTimer);
  retryTimer = null;
}

function stopAudio() {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio.onended = null;
  currentAudio.onerror = null;
  currentAudio.onstalled = null;
  currentAudio.onabort = null;
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
  els.sceneImage.src = resolveImageSource(scene);
  els.sceneImage.alt = overridePrompt;
  els.sceneImage.dataset.sceneKind = scene.sceneKind || "practice";
  els.artCard.dataset.mode = scene.sceneKind === "no-card" ? "hidden" : "image";
  setHeardText("Nothing yet");
  els.micBtn.disabled = true;
  schedulePromptFit();
}

function playAudioSource(src, onDone) {
  if (!src) {
    if (typeof onDone === "function") {
      window.setTimeout(onDone, 50);
    }
    return;
  }

  clearRetryTimer();
  stopAudio();
  setState(`${presenterName()} speaking`, "ready");
  els.micBtn.disabled = true;

  let finished = false;
  const finish = (delay = 0) => {
    if (finished) return;
    finished = true;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.onstalled = null;
    currentAudio.onabort = null;
    if (typeof onDone === "function") {
      window.setTimeout(onDone, delay);
    }
  };

  currentAudio.onended = () => finish();
  currentAudio.onerror = () => finish(250);
  currentAudio.onstalled = () => finish(250);
  currentAudio.onabort = () => finish(250);
  currentAudio.src = src;
  currentAudio.load();

  const playPromise = currentAudio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      finish(250);
    });
  }
}

function playAudio(fileName, onDone) {
  playAudioSource(resolveAudioSource(fileName), onDone);
}

function playRandomFallbackAudio(onDone) {
  const fallback = fallbackAudios[Math.floor(Math.random() * fallbackAudios.length)];
  if (!fallback) {
    if (typeof onDone === "function") {
      window.setTimeout(onDone, 50);
    }
    return;
  }

  els.promptText.textContent = fallback.prompt;
  els.sceneImage.alt = fallback.prompt;
  schedulePromptFit();
  playAudioSource(resolveAudioSource(fallback.audio || fallback.fileName, fallbackAudioBase), onDone);
}

function playRandomOutroAudio(onDone) {
  const outro = outroAudios[Math.floor(Math.random() * outroAudios.length)];
  if (!outro) {
    if (typeof onDone === "function") {
      window.setTimeout(onDone, 50);
    }
    return;
  }

  els.promptText.textContent = outro.prompt;
  els.sceneImage.alt = outro.prompt;
  schedulePromptFit();
  playAudioSource(resolveAudioSource(outro.audio || outro.fileName, outroAudioBase), onDone);
}

function playCurrentScene() {
  if (!dataLoaded || !scenes.length) return;
  const scene = scenes[sceneIndex];
  if (!scene) return;
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
    setHeardText("");
    playRandomOutroAudio(() => {
      setState("Replay anytime", "correct");
      els.micBtn.disabled = true;
    });
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
    setState(`${presenterName()} listening`, "listening");
    els.micBtn.disabled = true;
    silenceTimer = window.setTimeout(handleSilence, 5600);
  };

  recognition.onresult = (event) => {
    window.clearTimeout(silenceTimer);
    silenceTimer = null;
    const transcripts = Array.from(event.results?.[0] || [])
      .map((result) => result?.transcript || "")
      .filter(Boolean);
    const best = transcripts[0] || "";
    setHeardText(best || "Voice heard");
    classifyTranscripts(transcripts);
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
      setState(READY_STATUS_TEXT, "ready");
    }
  };

  return recognition;
}

function startListening() {
  if (!dataLoaded || !scenes.length) return;
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
    setState(READY_STATUS_TEXT, "ready");
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
    return Array.isArray(scene.accepted) && scene.accepted.some((phrase) => phraseMatchesTranscript(phrase, transcript));
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

  setHeardText("Nothing yet");
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
    schedulePromptFit();
    playAudio(scene.retryAudio, startListening);
  }, 450);
}

function handleAdvanceAfterRetries() {
  const scene = scenes[sceneIndex];

  acceptingSpeech = false;
  clearRetryTimer();
  stopListening();
  stopAudio();
  els.micBtn.disabled = true;
  setState("Let's move on", "try");
  setHeardText("");
  els.sceneImage.src = resolveImageSource(scene);
  els.sceneImage.alt = "";
  els.sceneImage.dataset.sceneKind = scene.sceneKind || "practice";
  els.artCard.dataset.mode = scene.sceneKind === "no-card" ? "hidden" : "image";

  window.setTimeout(() => {
    playRandomFallbackAudio(() => {
      sceneIndex += 1;
      playCurrentScene();
    });
  }, 350);
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
  els.sceneImage.src = resolveImageSource(feedback.image || scene.image);
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

function jumpToOutroScene() {
  const outroSceneIndex = getOutroSceneIndex();
  if (outroSceneIndex < 0) return;

  clearRetryTimer();
  acceptingSpeech = false;
  retryCount = 0;
  stopListening();
  stopAudio();
  sceneIndex = outroSceneIndex;
  hasStarted = true;
  playCurrentScene();
}

els.micBtn.addEventListener("click", () => {
  if (!dataLoaded) return;
  if (!hasStarted || scenes[sceneIndex]?.done) {
    sceneIndex = scenes[sceneIndex]?.done ? 0 : sceneIndex;
    playCurrentScene();
    return;
  }

  startListening();
});

els.replayBtn.addEventListener("click", () => {
  if (!dataLoaded) return;
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

if (els.jumpToEndBtn) {
  els.jumpToEndBtn.addEventListener("click", jumpToOutroScene);
}

syncAppHeight();
window.addEventListener("resize", syncAppHeight);
window.addEventListener("orientationchange", syncAppHeight);

setState("Loading activity", "ready");
els.micBtn.disabled = true;

loadActivityData()
  .catch((error) => {
    console.error(error);
    scenes = [DEFAULT_SCENE];
    fallbackAudios = [];
    outroAudios = [];
    fallbackAudioBase = "Audio/fallback/";
    outroAudioBase = "Audio/outro/";
    dataLoaded = true;
  })
  .then(() => {
    sceneIndex = 0;
    applyPresenter();
    showScene(scenes[0]);
    setState(SpeechRecognition ? READY_STATUS_TEXT : "Speech recognition unavailable", "ready");
    els.micBtn.disabled = false;
  });
