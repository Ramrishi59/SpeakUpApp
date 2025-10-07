let screens = [];
let currentIndex = 0;

let unitMeta = null;
let introFloatTimers = [];
let introFloats = [];


let userInteracted = false;
['click','touchstart','keydown'].forEach(evt => {
  window.addEventListener(evt, () => { userInteracted = true; }, { passive:true });
});

const audio = new Audio();
audio.preload = "auto";

const els = {
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
      if ($audio && src){ $audio.src = src; $audio.currentTime = 0; $audio.play().catch(()=>{}); }
      else if (window.audio && src){
        window.audio.pause(); window.audio.muted = false; window.audio.currentTime = 0;
        window.audio.src = src; window.audio.play().catch(()=>{});
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

/* ---------- intro image chooser ---------- */
function pickIntroImages(unit, max = 5){
  const picked = [];
  const seen = new Set();

  // Priority 1: explicit introImages from JSON
  if (Array.isArray(unit?.introImages) && unit.introImages.length){
    for (const src of unit.introImages){
      if (!seen.has(src)) { seen.add(src); picked.push(src); }
      if (picked.length >= max) break;
    }
  }

  // Priority 2: first unique slide images
  if (picked.length < max && Array.isArray(unit?.words)){
    for (const w of unit.words){
      if (w?.image && !seen.has(w.image)){
        seen.add(w.image); picked.push(w.image);
        if (picked.length >= max) break;
      }
    }
  }

  return picked.slice(0, max);
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

function startIntroFloat(images){
  const layer = document.getElementById('introFloatLayer');
  if (!layer || !images?.length) return;

  stopIntroFloat(false); // clear any leftovers without fade

  // random position helper (viewport)
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

  const spawnOne = (src, idx) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = "";
    img.className = 'intro-float';
    layer.appendChild(img);
    introFloats.push(img);

    // random start edge + drift vector
    const startX = Math.random() * vw * 0.8 + vw * 0.1;    // 10%–90% width
    const startY = Math.random() * vh * 0.3 + vh * 0.55;   // lower half drift up
    const endX   = startX + (Math.random() * vw * 0.2 - vw * 0.1); // slight sideways
    const endY   = startY - (Math.random() * vh * 0.18 + vh * 0.12);

    // random gentle rotation/spin
    const rot  = (Math.random() * 10 - 5).toFixed(1) + 'deg';
    const spin = (Math.random() * 10 + 4).toFixed(1) + 'deg';

    const durMs = Math.round(6000 + Math.random() * 2200); // 6–8.2s
    const delay = Math.round(120 + Math.random() * 480);    // 0.12–0.6s stagger

    img.style.left = `${startX}px`;
    img.style.top  = `${startY}px`;

    // custom props for keyframes
    img.style.setProperty('--x0', '0px');
    img.style.setProperty('--y0', '0px');
    img.style.setProperty('--x1', `${endX - startX}px`);
    img.style.setProperty('--y1', `${endY - startY}px`);
    img.style.setProperty('--rot', rot);
    img.style.setProperty('--spin', spin);

    // enter after a slight delay
    const t1 = setTimeout(() => {
      img.classList.add('is-in');
      img.style.animation = `intro-drift ${durMs}ms ease-in-out forwards`;
      // auto fade-out near the end
      const t2 = setTimeout(() => img.classList.add('is-out'), Math.max(0, durMs - 300));
      introFloatTimers.push(t2);
    }, delay);

    // cleanup once drift ends
    const t3 = setTimeout(() => { try { img.remove(); } catch {} }, delay + durMs + 500);
    introFloatTimers.push(t1, t3);
  };

  // spawn each once
  images.forEach((src, i) => spawnOne(src, i));
}

function stopIntroFloat(fadeOut = true){
  introFloatTimers.forEach(clearTimeout);
  introFloatTimers = [];
  introFloats.forEach(el => {
    if (!el) return;
    if (fadeOut) el.classList.add('is-out');
    setTimeout(() => { try { el.remove(); } catch {} }, fadeOut ? 320 : 0);
  });
  introFloats = [];
}

function fadeOutIntroAndRevealUI({ onDone } = {}){
  // fade out text + floaters
  const text = els.introText;
  if (text){
    text.style.transition = 'opacity 500ms ease';
    text.style.opacity = '0';
  }
  stopIntroFloat(true);

  // after fade, show footer + intro next
  setTimeout(() => {
    if (text){ text.style.opacity = ''; }  // reset for next time
    setFooterVisible(true);
    if (els.introNext){
      els.introNext.style.display = '';
      // soft fade-in for the button row (it sits inside .intro-screen .nav-row)
      const row = els.introNext.closest('.nav-row');
      if (row){
        row.style.opacity = '0';
        row.style.transition = 'opacity 300ms ease';
        requestAnimationFrame(() => { row.style.opacity = '1'; });
      }
    }
    if (typeof onDone === 'function') onDone();
  }, 520);
}

/* ---------- intro floating visuals ---------- */
function startIntroFloat(images){
  const layer = document.getElementById('introFloatLayer');
  if (!layer || !images?.length) return;

  stopIntroFloat(false); // clear leftovers (no fade)

  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

  const spawnOne = (src) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = "";
    img.className = 'intro-float';
    layer.appendChild(img);
    introFloats.push(img);

    const startX = Math.random() * vw * 0.8 + vw * 0.1;   // 10–90% width
    const startY = Math.random() * vh * 0.3 + vh * 0.55;  // lower half drift up
    const endX   = startX + (Math.random() * vw * 0.2 - vw * 0.1);
    const endY   = startY - (Math.random() * vh * 0.18 + vh * 0.12);

    const rot  = (Math.random() * 10 - 5).toFixed(1) + 'deg';
    const spin = (Math.random() * 10 + 4).toFixed(1) + 'deg';

    const durMs = Math.round(6000 + Math.random() * 2200); // 6–8.2s
    const delay = Math.round(120 + Math.random() * 480);    // 0.12–0.6s

    img.style.left = `${startX}px`;
    img.style.top  = `${startY}px`;

    img.style.setProperty('--x0', '0px');
    img.style.setProperty('--y0', '0px');
    img.style.setProperty('--x1', `${endX - startX}px`);
    img.style.setProperty('--y1', `${endY - startY}px`);
    img.style.setProperty('--rot', rot);
    img.style.setProperty('--spin', spin);

    const t1 = setTimeout(() => {
      img.classList.add('is-in');
      img.style.animation = `intro-drift ${durMs}ms ease-in-out forwards`;
      const t2 = setTimeout(() => img.classList.add('is-out'), Math.max(0, durMs - 300));
      introFloatTimers.push(t2);
    }, delay);

    const t3 = setTimeout(() => { try { img.remove(); } catch {} }, delay + durMs + 500);
    introFloatTimers.push(t1, t3);
  };

  images.forEach(spawnOne);
}

function stopIntroFloat(fadeOut = true){
  introFloatTimers.forEach(clearTimeout);
  introFloatTimers = [];
  introFloats.forEach(el => {
    if (!el) return;
    if (fadeOut) el.classList.add('is-out');
    setTimeout(() => { try { el.remove(); } catch {} }, fadeOut ? 320 : 0);
  });
  introFloats = [];
}

/* ---------- fade out intro & reveal UI ---------- */
function fadeOutIntroAndRevealUI({ onDone } = {}){
  const text = els.introText;
  if (text){
    text.style.transition = 'opacity 500ms ease';
    text.style.opacity = '0';
  }
  stopIntroFloat(true);

  setTimeout(() => {
    if (text){ text.style.opacity = ''; }  // reset
    setFooterVisible(true);
    if (els.introNext){
      els.introNext.style.display = '';
      const row = els.introNext.closest('.nav-row');
      if (row){
        row.style.opacity = '0';
        row.style.transition = 'opacity 300ms ease';
        requestAnimationFrame(() => { row.style.opacity = '1'; });
      }
    }
    if (typeof onDone === 'function') onDone();
  }, 520);
}




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
    if (item.audio) { audio.src = item.audio; audio.play().catch(() => {}); }
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

// 1) hide footer + intro-next during the animated intro
setFooterVisible(false);
if (els.introNext) els.introNext.style.display = "none";

// 2) animated text
showIntroBounce(els.introText, item.text || "", { wordDelay: 50, reset: true });
lockIntroWords(els.introText, { wordDelay: 50, duration: 700 });

// 3) floating images
const introPics = pickIntroImages(unitMeta || {}, 5);
startIntroFloat(introPics);

// 4) audio playback & end transition
if (item.audio) {
  try {
    audio.pause(); audio.muted = false; audio.currentTime = 0;
    audio.src = item.audio;
    audio.play().catch(()=>{});
    audio.onended = () => fadeOutIntroAndRevealUI();
  } catch {}
} else {
  // fallback duration if no audio
  setTimeout(() => fadeOutIntroAndRevealUI(), 8000);
}

// Keep your existing outro detection flag (no change to behaviour)
const isTextOutro = (i === screens.length - 1);
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

/* ---------- boot ---------- */
function getUnitIdFromUrl(){ const p = new URLSearchParams(location.search); return p.get("unitId") || "unit1"; }
async function loadUnit(id){ const r = await fetch(`units/${id}.json`, { cache: "no-store" }); if (!r.ok) throw new Error(id); return r.json(); }

(async function(){
  const unit = await loadUnit(getUnitIdFromUrl());
  unitMeta = unit; // NEW: keep reference for introImages
  document.body.classList.add(`unit-${unit.id}`);
  const titleEl = document.getElementById("unitTitle");
  if (titleEl && unit.name) titleEl.textContent = unit.name;
  screens = Array.isArray(unit?.words) ? unit.words : [];
  currentIndex = 0;
  render(currentIndex);
})();

