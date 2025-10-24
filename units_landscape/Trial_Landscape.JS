// ======================================================
// Speak Up — Trial (Landscape Only, Unit 3)
// - Landscape gate (CSS + JS)
// - Fixed 16:9 canvas, scaled
// - Single Audio instance
// ======================================================

// ---------- Unit Data (swap/externalize later) ----------
const UNIT_META = {
    id: "unit3",
    title: "Unit 3 — This & That",
    introAudio: "assets/audio/intro1.mp3",
    outroAudio: "./assets/audio/outro.mp3",
    lessonText: "Look. Listen. Repeat.",
    items: [
      { image: "assets/images/1.webp",        audio: "assets/audio/u4_01_pencil.mp3" },
      { image: "assets/images/2.webp",        audio: "assets/audio/u4_02_umbrella.mp3" },
      { image: "assets/images/3.webp",       audio: "assets/audio/u4_03_cat.mp3" },
      { image: "assets/images/4.webp",   audio: "assets/audio/u4_04_orange.mp3" },
      { image: "assets/images/5.webp",      audio: "assets/audio/u4_05_egg.mp3" },
      { image: "assets/images/6.webp",      audio: "assets/audio/u4_06_water_bottle.mp3" },
    ]
  };
  
  // ---------- State ----------
  let currentIndex = 0;
  let userInteracted = false;
  let isMuted = false;
  
  const audio = new Audio();
  audio.preload = "auto";
  
  // ---------- Elements ----------
  const els = {
    // Orientation overlay
    rotateOverlay: document.getElementById("rotateOverlay"),
  
    // Canvas internals
    unitTitle: document.getElementById("unitTitle"),
    progress:  document.getElementById("progress"),
  
    introScreen: document.getElementById("introScreen"),
    wordDisplay: document.getElementById("wordDisplay"),
    outroScreen: document.getElementById("outroScreen"),
  
    playIntro:  document.getElementById("playIntro"),
    introText:  document.getElementById("introText"),
  
    wordImage:  document.getElementById("wordImage"),
  
    prevButton: document.getElementById("prevButton"),
    nextButton: document.getElementById("nextButton"),
    startOver:  document.getElementById("startoverButton"),
  
    replayUnit: document.getElementById("replayUnit"),
  
    // audio state/mute UI removed
  };
  
  // Enable audio on first gesture (mobile policies)
  ['click','touchstart','keydown'].forEach(evt => {
    window.addEventListener(evt, () => { userInteracted = true; }, { passive: true });
  });
  
  // ---------- Orientation gate ----------
  function isLandscape(){
    // Use matchMedia for robustness across platforms
    return window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
  }
  function enforceLandscape(){
    const ok = isLandscape();
    // The CSS already hides/shows overlay; here we also stop audio and block clicks in portrait.
    if (!ok){
      stopAudio();
      disableCanvas(true);
    } else {
      disableCanvas(false);
    }
  }
  function disableCanvas(on){
    // Disable actionable buttons while portrait
    const controls = [els.playIntro, els.prevButton, els.nextButton, els.startOver, els.replayUnit];
    controls.forEach(btn => { if (btn) btn.disabled = !!on; });
  }
  
  // ---------- Init ----------
  function init() {
    els.unitTitle.textContent = UNIT_META.title;
    // lessonText removed in image-only design
  
    setProgress(0, UNIT_META.items.length);
  
    // Wire up controls
    els.playIntro.addEventListener("click", startUnit);
    els.prevButton.addEventListener("click", onPrev);
    els.nextButton.addEventListener("click", onNext);
    els.startOver.addEventListener("click", startOver);
    els.replayUnit.addEventListener("click", startOver);
    // mute toggle removed
  
    // Preload images lightly
    UNIT_META.items.forEach(it => { const i = new Image(); i.src = it.image; });
  
    // Show intro by default
    showIntro();
  
    // Orientation handling
    enforceLandscape();
    window.addEventListener("resize", enforceLandscape);
    // Some iOS rotations only trigger orientationchange
    window.addEventListener("orientationchange", enforceLandscape);
  }
  
  // ---------- Screen helpers ----------
  function showIntro() {
    hideAll();
    els.introScreen.hidden = false;
    stopAudio();
    setProgress(0, UNIT_META.items.length);
  }
  
  function showWord(i) {
    hideAll();
    els.wordDisplay.hidden = false;
  
    const item = UNIT_META.items[i];
    els.wordImage.src = item.image;
    els.wordImage.alt = item.text || 'Lesson image';
  
    setProgress(i + 1, UNIT_META.items.length);
    updateNav(i);
    playIfAllowed(item.audio);
  }
  
  function showOutro() {
    hideAll();
    els.outroScreen.hidden = false;
    stopAudio();
    playIfAllowed(UNIT_META.outroAudio);
  }
  
  function hideAll() {
    els.introScreen.hidden = true;
    els.wordDisplay.hidden = true;
    els.outroScreen.hidden = true;
  }
  
  // ---------- Navigation ----------
  function onPrev() {
    if (!isLandscape()) return; // guard
    if (currentIndex > 0) {
      currentIndex--;
      stopAudio();
      showWord(currentIndex);
    }
  }
  
  function onNext() {
    if (!isLandscape()) return; // guard
    if (currentIndex < UNIT_META.items.length - 1) {
      currentIndex++;
      stopAudio();
      showWord(currentIndex);
    } else {
      stopAudio();
      showOutro();
    }
  }
  
  function updateNav(i) {
    els.prevButton.disabled = (i === 0);
    els.nextButton.textContent = (i === UNIT_META.items.length - 1) ? "Finish ▶" : "Next ▶";
  }
  
  // ---------- Flow ----------
  function startUnit() {
    if (!isLandscape()) return; // guard
    stopAudio();
    playIfAllowed(UNIT_META.introAudio);
    currentIndex = 0;
    showWord(currentIndex);
  }
  
  function startOver() {
    currentIndex = 0;
    showIntro();
  }
  
  // ---------- Audio ----------
  function stopAudio() {
    audio.pause();
    audio.currentTime = 0;
    setAudioState(false);
  }
  
  function playIfAllowed(src) {
    if (!src) { setAudioState(false); return; }
    if (isMuted) { setAudioState(false); return; }
    if (!userInteracted) { setAudioState(false); return; }
    if (!isLandscape()) { setAudioState(false); return; }
  
    audio.src = src;
    audio.play().then(() => setAudioState(true)).catch(() => setAudioState(false));
  }
  
  // mute toggle removed
  
  function setAudioState(playing) {
    // UI removed; no-op
  }
  
  // ---------- UI bits ----------
  function setProgress(now, total) {
    els.progress.textContent = `${now} / ${total}`;
  }
  
  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", init);
  
