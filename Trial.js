let screens = [];
let firstTextIndex = 0;
let currentIndex = 0;

let userInteracted = false;
['click','touchstart','keydown'].forEach(evt => {
  window.addEventListener(evt, () => { userInteracted = true; }, { passive:true });
});

const audio = new Audio();
audio.preload = "auto";

const els = {

  // Intro Start button (replaces start gate)
  introStartBtn: document.getElementById("introStartBtn"),
  // Intro / Outro
  introScreen:  document.getElementById("introScreen"),
  introText:    document.getElementById("introText"),
  introNext:    document.getElementById("nextButtonIntro"),
  introWrap:    document.querySelector(".intro-video-wrap"),
  introVideo:   document.getElementById("introVideo"),
  playOverlay:  document.getElementById("introPlayOverlay"),
  skipIntro:    document.getElementById("skipIntro"),
  unmuteIntro:  document.getElementById("unmuteIntro"),

  // Global footer actions
  lessonActions: document.getElementById("lessonActions"),

  // Word slides
  wordScreen:   document.getElementById("wordDisplay"),
  title:        document.getElementById("lessonText"),
  word:         document.getElementById("wordText"),
  image:        document.getElementById("wordImage"),
  prev:         document.getElementById("prevButton"),
  next:         document.getElementById("nextButton"),
};

/* ---------- unified footer visibility ---------- */
function setFooterVisible(on) {
  const row = document.getElementById('lessonActions');
  if (row) row.style.display = on ? 'grid' : 'none';
  // one toggle to rule the bottom dock (footer + nav)
  document.body.classList.toggle('has-dock', !!on);
}


/* ---------- outro (image + audio) ---------- */
const SpeakUpOutro = (() => {
  let $screen, $mascot, $placard, $audio;
  function refs(){
    $screen  = document.getElementById("outroScreen");
    $mascot  = document.getElementById("outroMascot");
    $placard = document.getElementById("outroMessage");
    $audio   = document.getElementById("outroAudio");
  }
  function hide(){
    refs();
    if ($screen){ $screen.style.display = "none"; $screen.classList.remove("is-playing"); }
    if ($audio){ try{ $audio.pause(); $audio.currentTime = 0; }catch{} }
  }
  function render({ image, audio: src, text }){
    refs(); if (!$screen) return;
    if ($mascot && image) { $mascot.src = image; $mascot.style.display = ""; }
    if ($mascot && !image){ $mascot.removeAttribute("src"); $mascot.style.display = "none"; }
    if ($placard) $placard.textContent = text || "";

    $screen.style.display = "";
    $screen.classList.remove("is-playing"); void $screen.offsetWidth;
    $screen.classList.add("is-playing");

    try{
      if ($audio && src){
        $audio.src = src;
        $audio.currentTime = 0;
        $audio.play().catch(()=>{});
      } else if (audio && src){
        // Fallback to shared audio instance (global const), not window.audio
        audio.pause();
        audio.muted = false;
        audio.currentTime = 0;
        audio.src = src;
        audio.play().catch(()=>{});
      }
    }catch{}
  }
  return { render, hide };
})();

/* ---------- simple FX ---------- */
let stopOutroFX = null;
function runEasyOutroFX(rootEl) {
  const mascot  = rootEl?.querySelector('.mascot') || document.getElementById('outroMascot');
  const message = rootEl?.querySelector('.message') || document.getElementById('outroMessage');
  const timers  = [];
  [mascot, message].forEach(el => el && el.classList.remove('fx-pop','fx-wave-once','fx-float','fx-cheer','fx-shimmer'));
  if (message) message.classList.add('fx-cheer');
  if (mascot) {
    mascot.classList.add('fx-pop');
    timers.push(setTimeout(() => mascot.classList.add('fx-wave-once'), 220));
    timers.push(setTimeout(() => mascot.classList.add('fx-float'), 900));
  }
  return () => {
    timers.forEach(clearTimeout);
    [mascot, message].forEach(el => el && el.classList.remove('fx-pop','fx-wave-once','fx-float','fx-cheer','fx-shimmer'));
  };
}

/* ---------- outro detection ---------- */
function isOutroItem(item, index, list) {
  const isLast = index === list.length - 1;
  const hasImg = !!item?.image;
  const hasAud = !!item?.audio;
  const noText = !item?.text || item.text.trim() === "";
  return isLast && hasImg && hasAud && noText;
}

function showOutroFromLegacyItem(item) {
  SpeakUpOutro.render({ image: item.image || "", audio: item.audio || "", text: "" });
  document.body.classList.add('outro-active');
  setFooterVisible(true); // show coins on mascot outro
  stopOutroFX?.();
  stopOutroFX = runEasyOutroFX(document.getElementById('outroScreen'));
}
function leaveOutro() {
  stopOutroFX?.(); stopOutroFX = null;
  SpeakUpOutro.hide();
  document.body.classList.remove('outro-active');
}

/* ---------- media helpers ---------- */
function stopAudio(){ audio.pause(); audio.currentTime = 0; audio.onended = null; }
function stopVideo(){
  if (!els.introVideo) return;
  els.introVideo.pause();
  els.introVideo.removeAttribute("src");
  els.introVideo.removeAttribute("poster");
  els.introVideo.load();
  if (els.playOverlay) els.playOverlay.style.display = "none";
  if (els.unmuteIntro) els.unmuteIntro.style.display = "none";
}
function enterVideoMode(){ document.body.classList.add("video-active"); els.introScreen.classList.add("video-fullscreen"); }
function exitVideoMode(){ document.body.classList.remove("video-active"); els.introScreen.classList.remove("video-fullscreen"); }

/* ---------- intro text animation ---------- */
function showIntroBounce(selector, text, { wordDelay = 100, reset = true } = {}) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return;
  if (reset) el.innerHTML = '';
  const words = String(text || '').trim().split(/\s+/);
  words.forEach((w, i) => {
    const span = document.createElement('span');
    span.className = 'intro-word';
    span.textContent = (i === words.length - 1) ? w : (w + ' ');
    span.style.animationDelay = `${i * wordDelay}ms`;
    el.appendChild(span);
  });
}
function lockIntroWords(container) {
  const spans = container.querySelectorAll('.intro-word');
  if (!spans.length) return;

  const last = spans[spans.length - 1];
  last.addEventListener('animationend', () => {
    spans.forEach(s => {
      s.style.opacity = '1';
      s.style.transform = 'none';
      s.style.animation = 'none';
    });
  }, { once: true });
}

// (Start Gate helpers removed — replaced with intro Start button)


/* ---------- gesture for iOS ---------- */
let introAudioGestureHandler = null;
function armIntroAudioGestureOnce() {
  if (introAudioGestureHandler) return;
  introAudioGestureHandler = (e) => {
    const startBtn = els.introNext;
    const tappedStart = startBtn && (e.target === startBtn || (e.target.closest && e.target.closest('#nextButtonIntro')));
    if (!tappedStart) { audio.play().catch(() => {}); }
    document.removeEventListener('pointerdown', introAudioGestureHandler, true);
    document.removeEventListener('touchend',   introAudioGestureHandler, true);
    document.removeEventListener('click',      introAudioGestureHandler, true);
    introAudioGestureHandler = null;
  };
  document.addEventListener('pointerdown', introAudioGestureHandler, true);
  document.addEventListener('touchend',   introAudioGestureHandler, true);
  document.addEventListener('click',      introAudioGestureHandler, true);
}

/* ---------- core render ---------- */
async function render(i) {
  const item = screens[i];
  if (!item) return;

  // Mark last slide to allow CSS exceptions (e.g., smaller word text on outro/last)
  document.body.classList.toggle('last-slide', i === screens.length - 1);

  // Mark intro mascot slides: image-only items before the first text/video
  const isIntroMascot = !!(item?.image && !item?.text && !item?.video && i < firstTextIndex);
  document.body.classList.toggle('intro-mascot', isIntroMascot);

  // reset screens/media
  els.introScreen.style.display = "none";
  els.wordScreen.style.display  = "none";
  exitVideoMode();
  stopAudio();

  // footer rule: show on every NON-VIDEO screen (text intros, slides, mascot outro)
  const isMascotOutro = isOutroItem(item, i, screens);
  const isVideo = !!item.video;
  setFooterVisible(!isVideo);

  // mascot outro (image+audio, no text, last)
  if (isMascotOutro) {
    stopVideo(); stopAudio();
    showOutroFromLegacyItem(item);
    setFooterVisible(true);
    return;
  }

  // word/image slide
  if (item.image && !item.video) {
    leaveOutro();
    els.wordScreen.style.display = "grid";
    els.word.innerHTML = (item.text || "").replace(/ (?!.* )/, "&nbsp;");
    els.image.src = item.image;
    els.image.alt = item.text || "Lesson image";
    els.prev.style.display = i === 0 ? "none" : "";
    els.next.style.display = i === screens.length - 1 ? "none" : "";
    if (item.audio) {
      audio.pause(); audio.currentTime = 0; audio.src = item.audio;
      if (userInteracted) { audio.play().catch(() => {}); }
    }
    // Show Start button on image-only intro slides before the first text/video
    showStartButton(!userInteracted && (!!item?.image && !item?.text && !item?.video && i < firstTextIndex));
    return;
  }

  // video (intro or video-outro) — footer already OFF above
  if (item.video) {
    leaveOutro();
    els.introScreen.style.display = "flex";
    enterVideoMode();
    if (els.introWrap) els.introWrap.style.display = "block";
    els.introText.style.display = "none";

    if (item.poster) els.introVideo.setAttribute("poster", item.poster);
    els.introVideo.setAttribute("playsinline", "");
    els.introVideo.setAttribute("webkit-playsinline", "");
    els.introVideo.src = item.video;
    els.introVideo.load();

    if (els.introNext) els.introNext.style.display = "none";
    const isOutro = (i === screens.length - 1);

    if (isOutro) {
      els.introVideo.setAttribute("autoplay", "");
      els.introVideo.setAttribute("muted", "");
      els.introVideo.muted = true;
      if (els.playOverlay) { els.playOverlay.style.display = "none"; els.playOverlay.onclick = null; }
      if (els.unmuteIntro) els.unmuteIntro.style.display = "none";
      if (els.skipIntro)   els.skipIntro.style.display   = "none";
      const bottom = document.querySelector(".intro-bottom-controls");
      if (bottom) bottom.style.display = "none";
      const tryUnmute = () => {
        if (!userInteracted) return;
        try { els.introVideo.muted = false; els.introVideo.removeAttribute('muted'); els.introVideo.volume = 1.0; } catch {}
      };
      els.introVideo.addEventListener('playing', () => setTimeout(tryUnmute, 60), { once:true });
      els.introVideo.onended = () => { stopAudio(); stopVideo(); exitVideoMode(); location.href = 'index.html'; };
      return;
    }

    // normal video intro
    if (els.playOverlay) els.playOverlay.style.display = "flex";
    if (els.unmuteIntro) els.unmuteIntro.style.display = "none";
    els.introVideo.onended = () => showNext();
    if (els.playOverlay) {
      els.playOverlay.onclick = async () => {
        userInteracted = true;
        try { els.introVideo.muted = false; await els.introVideo.play(); els.playOverlay.style.display = "none"; if (els.unmuteIntro) els.unmuteIntro.style.display = "none"; } catch {}
      };
    }
    if (els.unmuteIntro) els.unmuteIntro.onclick = () => { els.introVideo.muted = false; els.unmuteIntro.style.display = "none"; };
    if (els.skipIntro)   els.skipIntro.onclick   = () => showNext();
    return;
  }

  // TEXT intro / TEXT outro (no image, no video)
  leaveOutro();
  els.introScreen.style.display = "flex";
  if (els.introWrap) els.introWrap.style.display = "none";
  els.introText.style.display = "";
  setFooterVisible(true); // always show on text intros

  if (item.audio) {
    try {
      audio.pause(); audio.muted = false; audio.currentTime = 0; audio.src = item.audio;
      if (userInteracted) { audio.play().catch(()=>{}); }
    } catch {}
  }
  // Show Start button (custom coin preferred) on text intros to prime audio
  showStartButton(!userInteracted && item?.text && !item?.video);
  showIntroBounce(els.introText, item.text || "", { wordDelay: 50, reset: true });
  lockIntroWords(els.introText, { wordDelay: 50, duration: 700 });

  const isTextOutro = (i === screens.length - 1);
  if (els.introNext) els.introNext.style.display = isTextOutro ? "none" : "";
  els.introScreen.classList.toggle('outro', isTextOutro);
}

/* ---------- nav ---------- */
function showPrev(){ if (currentIndex > 0){ currentIndex--; render(currentIndex); } }
function showNext(){
  stopVideo(); exitVideoMode();
  if (currentIndex < screens.length - 1){ currentIndex++; render(currentIndex); }
  else { location.href = 'index.html'; }
}
function startOver(){
  currentIndex = 0;
  stopAudio(); stopVideo(); exitVideoMode();
  render(currentIndex);
}

/* ---------- events ---------- */
els.prev?.addEventListener("click", showPrev);
els.next?.addEventListener("click", showNext);
els.introNext?.addEventListener("click", showNext);
document.getElementById('startoverGlobal')?.addEventListener('click', startOver);
// Unified Start button logic (custom coin preferred)
function handleIntroStartClick(){
  userInteracted = true;
  try{
    const item = screens[currentIndex];
    if (item?.audio){ audio.pause(); audio.muted = false; audio.currentTime = 0; audio.src = item.audio; audio.play().catch(()=>{}); }
  }catch{}
  // hide both variants
  const custom = document.getElementById('introStartCustom');
  if (custom) custom.style.display = 'none';
  if (els.introStartBtn) els.introStartBtn.style.display = 'none';
}
function showStartButton(show){
  const custom = document.getElementById('introStartCustom');
  const fallback = els.introStartBtn;
  // hide both first
  if (custom) custom.style.display = 'none';
  if (fallback) fallback.style.display = 'none';
  if (!show) return;
  // prefer custom coin if present
  if (custom) custom.style.display = '';
  else if (fallback) fallback.style.display = '';
}
// Bind clicks for both variants
els.introStartBtn?.addEventListener('click', handleIntroStartClick);
document.getElementById('introStartCustom')?.addEventListener('click', handleIntroStartClick);

/* ---------- boot ---------- */
function getUnitIdFromUrl(){ const p = new URLSearchParams(location.search); return p.get("unitId") || "unit1"; }
async function loadUnit(id){ const r = await fetch(`units/${id}.json`, { cache: "no-store" }); if (!r.ok) throw new Error(id); return r.json(); }

(async function(){
  const unit = await loadUnit(getUnitIdFromUrl());
  document.body.classList.add(`unit-${unit.id}`);

  const titleEl = document.getElementById("unitTitle");
  if (titleEl && unit.name) titleEl.textContent = unit.name;

  screens = Array.isArray(unit?.words) ? unit.words : [];

  // find first non-intro index
  (function findFirstText(){
    firstTextIndex = screens.findIndex(it => it?.text || it?.video);
    if (firstTextIndex < 0) firstTextIndex = screens.length;
  })();

  currentIndex = 0;

  // Render immediately; intro Start button will prime audio if needed
  render(currentIndex);
})();
