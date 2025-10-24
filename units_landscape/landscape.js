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
    // Fallback single-intro audio (kept for compatibility)
    introAudio: "assets/audio/intro1.mp3",
    // Multi-slide intro sequence (3 slides)
    introSlides: [
      { image: "assets/images/1.webp", audio: "assets/audio/intro1.mp3" },
      { image: "assets/images/2.webp", audio: "assets/audio/intro2.mp3" },
      { image: "assets/images/3.webp",     audio: "assets/audio/intro3.mp3" }
    ],
    outroAudio: "assets/audio/outro_u4.mp3",
    lessonText: "Look. Listen. Repeat.",
    items: [
        { image: "./assets/images/4.webp", audio: "./assets/audio/04_Chapter 1.mp3" },
        { image: "./assets/images/5.webp", audio: "./assets/audio/05_Chapter 1.mp3" },
        { image: "./assets/images/6.webp", audio: "./assets/audio/06_Chapter 1.mp3"},
        { image: "./assets/images/7.webp", audio: "./assets/audio/07_Chapter 1.mp3"},
        { image: "./assets/images/8.webp", audio: "./assets/audio/08_Chapter 1.mp3" },
        { image: "./assets/images/9.webp", audio: "./assets/audio/09_Chapter 1.mp3" },
        { image: "./assets/images/10.webp", audio: "./assets/audio/10_Chapter 1.mp3" },
        { image: "./assets/images/11.webp", audio: "./assets/audio/11_Chapter 1.mp3" },
        { image: "./assets/images/12.webp", audio: "./assets/audio/12_Chapter 1.mp3"},
        { image: "./assets/images/13.webp", audio: "./assets/audio/13_Chapter 1.mp3"},
        { image: "./assets/images/14.webp", audio: "./assets/audio/14_Chapter 1.mp3"},
        { image: "./assets/images/15.webp", audio: "./assets/audio/15_Chapter 1.mp3"},
        { image: "./assets/images/16.webp", audio: "./assets/audio/16_Chapter 1.mp3" },
        { image: "./assets/images/17.webp", audio: "./assets/audio/17_Chapter 1.mp3" },
        { image: "./assets/images/18.webp", audio: "./assets/audio/18_Chapter 1.mp3" },
        { image: "./assets/images/19.webp", audio: "./assets/audio/19_Chapter 1.mp3"},       
        { image: "./assets/images/20.webp", audio: "./assets/audio/20_Chapter 1.mp3" },
        { image: "./assets/images/21.webp", audio: "./assets/audio/21_Chapter 1.mp3"},
        { image: "./assets/images/22.webp", audio: "./assets/audio/22_Chapter 1.mp3"},
        { image: "./assets/images/23.webp", audio: "./assets/audio/23_Chapter 1.mp3"},
        { image: "./assets/images/24.webp", audio: "./assets/audio/24_Chapter 1.mp3" },
        { image: "./assets/images/25.webp", audio: "./assets/audio/25_Chapter 1.mp3"},
        { image: "./assets/images/26.webp", audio: "./assets/audio/26_Chapter 1.mp3" },
        { image: "./assets/images/27.webp", audio: "./assets/audio/27_Chapter 1.mp3"},
        { image: "./assets/images/28.webp", audio: "./assets/audio/28_Chapter 1.mp3"},
        { image: "./assets/images/29.webp", audio: "./assets/audio/29_Chapter 1.mp3" },
        { image: "./assets/images/30.webp", audio: "./assets/audio/30_Chapter 1.mp3"},
        { image: "./assets/images/31.webp", audio: "./assets/audio/31_Chapter 1.mp3" },
        { image: "./assets/images/32.webp", audio: "./assets/audio/32_Chapter 1.mp3" },
        { image: "./assets/images/33.webp", audio: "./assets/audio/33_Chapter 1.mp3" },
        { image: "./assets/images/34.webp", audio: "./assets/audio/34_Chapter 1.mp3"},
        { image: "./assets/images/35.webp", audio: "./assets/audio/35_Chapter 1.mp3" }

      ]
      
  };
  
  // ---------- State ----------
  let currentIndex = 0;
  let userInteracted = false;
  let isMuted = false;
  let introIndex = 0;
  let introStarted = false;
  
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
    introNext:  document.getElementById("introNext"),
    introImage: document.getElementById("introImage"),
  
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
    els.playIntro.addEventListener("click", (e) => { e.stopPropagation(); startIntroSequence(); });
    els.introNext && els.introNext.addEventListener("click", onIntroNext);
    // Allow tapping anywhere on the intro screen to start/advance
    els.introScreen.addEventListener('click', onIntroTap);
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
  // reset intro state
  introIndex = 0;
  introStarted = false;
  renderIntroSlide(introIndex, { showPlay: true });
}

function renderIntroSlide(i, { showPlay = false } = {}) {
  const slides = UNIT_META.introSlides || [];
  const slide = slides[i];
  if (slide && els.introImage) {
    els.introImage.src = slide.image;
    els.introImage.alt = `Intro ${i + 1}`;
  }
  // Keep Play visible; reveal Next after first Play
  if (els.playIntro) els.playIntro.hidden = false;
  if (els.introNext) els.introNext.hidden = showPlay;
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
function startIntroSequence() {
  if (!isLandscape()) return; // guard
  userInteracted = true;
  introStarted = true;
  // show first intro slide (Play hidden, Next shown)
  renderIntroSlide(introIndex, { showPlay: false });
  const slide = (UNIT_META.introSlides || [])[introIndex];
  stopAudio();
  playIfAllowed(slide?.audio || UNIT_META.introAudio);
}

function onIntroNext() {
  const slides = UNIT_META.introSlides || [];
  introIndex++;
  if (introIndex < slides.length) {
    renderIntroSlide(introIndex, { showPlay: false });
    stopAudio();
    playIfAllowed(slides[introIndex]?.audio);
  } else {
    // Finished intros → start unit
    currentIndex = 0;
    showWord(currentIndex);
  }
}

function onIntroTap(e){
  // Ignore taps on explicit controls (buttons already wired)
  if (e.target === els.playIntro || e.target === els.introNext || (e.target.closest && e.target.closest('.intro-controls'))) return;
  if (!introStarted) {
    startIntroSequence();
  } else {
    onIntroNext();
  }
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
  
