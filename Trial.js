// ===============================
// Speak Up — Trial.js (clean)
// ===============================

let screens = [];
let currentIndex = 0;

let unitMeta = null;
let introFloatTimers = [];
let introFloats = [];

let floatsStarted = false;     // gate so floats start once per intro
let userInteracted = false;

// Bouncer state + RAF handle
let introFloatRAF = null;
let introBouncers = [];

['click', 'touchstart', 'keydown'].forEach(evt => {
  window.addEventListener(evt, () => { userInteracted = true; }, { passive: true });
});

const audio = new Audio();
audio.preload = "auto";

const els = {
  // Intro / Outro
  introScreen: document.getElementById("introScreen"),
  introText: document.getElementById("introText"),
  introNext: document.getElementById("nextButtonIntro"),
  introWrap: document.querySelector(".intro-video-wrap"),
  introVideo: document.getElementById("introVideo"),
  playOverlay: document.getElementById("introPlayOverlay"),
  skipIntro: document.getElementById("skipIntro"),
  unmuteIntro: document.getElementById("unmuteIntro"),
  introStartAudio: document.getElementById("introStartAudio"),

  // Global footer actions
  lessonActions: document.getElementById("lessonActions"),

  // Word slides
  wordScreen: document.getElementById("wordDisplay"),
  title: document.getElementById("lessonText"),
  word: document.getElementById("wordText"),
  image: document.getElementById("wordImage"),
  prev: document.getElementById("prevButton"),
  next: document.getElementById("nextButton"),
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
  function refs() {
    $screen = document.getElementById("outroScreen");
    $mascot = document.getElementById("outroMascot");
    $placard = document.getElementById("outroMessage");
    $audio = document.getElementById("outroAudio");
  }
  function hide() {
    refs();
    if ($screen) { $screen.style.display = "none"; $screen.classList.remove("is-playing"); }
    if ($audio) { try { $audio.pause(); $audio.currentTime = 0; } catch { } }
  }
  function render({ image, audio: src, text }) {
    refs(); if (!$screen) return;
    if ($mascot && image) { $mascot.src = image; $mascot.style.display = ""; }
    if ($mascot && !image) { $mascot.removeAttribute("src"); $mascot.style.display = "none"; }
    if ($placard) $placard.textContent = text || "";

    $screen.style.display = "";
    $screen.classList.remove("is-playing"); void $screen.offsetWidth;
    $screen.classList.add("is-playing");

    try {
      if ($audio && src) { $audio.src = src; $audio.currentTime = 0; $audio.play().catch(() => { }); }
      else if (window.audio && src) {
        window.audio.pause(); window.audio.muted = false; window.audio.currentTime = 0;
        window.audio.src = src; window.audio.play().catch(() => { });
      }
    } catch { }
  }
  return { render, hide };
})();

/* ---------- simple FX ---------- */
let stopOutroFX = null;
function runEasyOutroFX(rootEl) {
  const mascot = rootEl?.querySelector('.mascot') || document.getElementById('outroMascot');
  const message = rootEl?.querySelector('.message') || document.getElementById('outroMessage');
  const timers = [];
  [mascot, message].forEach(el => el && el.classList.remove('fx-pop', 'fx-wave-once', 'fx-float', 'fx-cheer', 'fx-shimmer'));
  if (message) message.classList.add('fx-cheer');
  if (mascot) {
    mascot.classList.add('fx-pop');
    timers.push(setTimeout(() => mascot.classList.add('fx-wave-once'), 220));
    timers.push(setTimeout(() => mascot.classList.add('fx-float'), 900));
  }
  return () => {
    timers.forEach(clearTimeout);
    [mascot, message].forEach(el => el && el.classList.remove('fx-pop', 'fx-wave-once', 'fx-float', 'fx-cheer', 'fx-shimmer'));
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
function pickIntroImages(unit, max = 5) {
  const picked = [];
  const seen = new Set();

  // Priority 1: explicit introImages from JSON
  if (Array.isArray(unit?.introImages) && unit.introImages.length) {
    for (const src of unit.introImages) {
      if (!seen.has(src)) { seen.add(src); picked.push(src); }
      if (picked.length >= max) break;
    }
  }

  // Priority 2: first unique slide images
  if (picked.length < max && Array.isArray(unit?.words)) {
    for (const w of unit.words) {
      if (w?.image && !seen.has(w.image)) {
        seen.add(w.image); picked.push(w.image);
        if (picked.length >= max) break;
      }
    }
  }

  return picked.slice(0, max);
}

/* ---------- media helpers ---------- */
function stopAudio() { audio.pause(); audio.currentTime = 0; audio.onended = null; }
function stopVideo() {
  if (!els.introVideo) return;
  els.introVideo.pause();
  els.introVideo.removeAttribute("src");
  els.introVideo.removeAttribute("poster");
  els.introVideo.load();
  if (els.playOverlay) els.playOverlay.style.display = "none";
  if (els.unmuteIntro) els.unmuteIntro.style.display = "none";
}
function enterVideoMode() { document.body.classList.add("video-active"); els.introScreen.classList.add("video-fullscreen"); }
function exitVideoMode() { document.body.classList.remove("video-active"); els.introScreen.classList.remove("video-fullscreen"); }

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

/* ---------- floats: control + preloading ---------- */
function preloadImages(srcs = []) {
  srcs.forEach(src => { const i = new Image(); i.decoding = "async"; i.loading = "eager"; i.src = src; });
}

function startIntroFloat(images) {
  // Ensure a layer exists
  let layer = document.getElementById('introFloatLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'introFloatLayer';
    layer.className = 'intro-float-layer';
    (els.introScreen || document.body).appendChild(layer);
  }

  // Clear any previous floats/timers/raf
  stopIntroFloat(false);

  // Pick images (fallbacks if needed)
  let srcs = Array.isArray(images) ? images.slice() : [];
  if (!srcs.length && unitMeta) {
    try { srcs = pickIntroImages(unitMeta, 5); } catch {}
  }
  if (!srcs.length) {
    const anyImg = document.querySelector('#wordImage, .word-display img, img');
    if (anyImg?.src) srcs = [anyImg.src];
    else srcs = ['Images/Unit1/1.webp']; // hard fallback
  }
  if (!srcs.length) return;
  // console.log('[intro-bounce] start with', srcs.length, 'images', srcs);

  // Measure after layout
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const rect = layer.getBoundingClientRect();
      let W = Math.max(1, rect.width);
      let H = Math.max(1, rect.height);
      if (H < 10) {
        W = Math.max(W, window.innerWidth || 0);
        H = Math.max(H, (window.innerHeight || 0) - 56);
      }

      // Create bouncers (sizes use DISPLAYED size = base * scale)
      introBouncers = srcs.map((src) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = "";
        img.className = 'intro-float';
        img.style.position = 'absolute';
        img.style.willChange = 'transform';
        img.style.zIndex = '4';
        layer.appendChild(img);
        introFloats.push(img);

        // Size and scale (smaller)
        const baseW = Math.round(60 + Math.random() * 60);   // 60–120 px CSS width
        const scale = 0.85 + Math.random() * 0.35;           // 0.85–1.20 visual scale

        img.style.width = baseW + 'px';
        img.style.height = 'auto';

        const dispW = baseW * scale; // used for physics/bounce
        const dispH = baseW * scale; // assume square-ish assets

        // Start fully inside the layer using displayed size
        let x = Math.random() * Math.max(1, W - dispW);
        let y = Math.random() * Math.max(1, H - dispH);

        // Make visible immediately
        img.style.opacity = '1';
        img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

        // Velocity (px/s)
        const speed = 80 + Math.random() * 80; // 80–160
        const ang = Math.random() * Math.PI * 2;
        const vx = Math.cos(ang) * speed;
        const vy = Math.sin(ang) * speed;

        return { img, w: dispW, h: dispH, x, y, vx, vy, scale };
      });

      // Animate (bounce on edges)
      let last = performance.now();
      const PAD = 1; // tiny inset so we never clip outside

      const step = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); // clamp dt to 50ms
        last = now;

        // Re-measure bounds in case of resize/orientation change
        const r = layer.getBoundingClientRect();
        W = Math.max(1, r.width);
        H = Math.max(1, r.height);

        for (const b of introBouncers) {
          // Move
          b.x += b.vx * dt;
          b.y += b.vy * dt;

          // Bounce horizontally
          if (b.x <= PAD)               { b.x = PAD;                 b.vx =  Math.abs(b.vx); }
          if (b.x + b.w >= W - PAD)     { b.x = Math.max(PAD, W - PAD - b.w); b.vx = -Math.abs(b.vx); }

          // Bounce vertically
          if (b.y <= PAD)               { b.y = PAD;                 b.vy =  Math.abs(b.vy); }
          if (b.y + b.h >= H - PAD)     { b.y = Math.max(PAD, H - PAD - b.h); b.vy = -Math.abs(b.vy); }

          // Gentle rotation based on velocity
          const rotDeg = b.vx * 0.02;
          b.img.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) rotate(${rotDeg}deg) scale(${b.scale})`;
        }

        introFloatRAF = requestAnimationFrame(step);
      };

      introFloatRAF = requestAnimationFrame(step);
    });
  });
}


function stopIntroFloat(fadeOut = true) {
  // stop timers
  introFloatTimers.forEach(clearTimeout);
  introFloatTimers = [];

  // stop RAF
  if (introFloatRAF) {
    cancelAnimationFrame(introFloatRAF);
    introFloatRAF = null;
  }

  // fade/remove sprites
  introFloats.forEach(el => {
    if (!el) return;
    if (fadeOut) el.classList.add('is-out');
    setTimeout(() => { try { el.remove(); } catch { } }, fadeOut ? 320 : 0);
  });
  introFloats = [];
  introBouncers = [];
}


function armIntroFloats(images) {
  if (floatsStarted) return;
  floatsStarted = true;
  preloadImages(images);
  startIntroFloat(images);
}
function disarmIntroFloats() {
  floatsStarted = false;
  stopIntroFloat(true);
}

/* ---------- "Tap to start" overlay helpers ---------- */
function showIntroAudioOverlay(show) {
  if (!els.introStartAudio) return;
  els.introStartAudio.hidden = !show;
}

function attachIntroAudioOverlayOnce(src, onDone) {
  if (!els.introStartAudio) return;

  const handler = async () => {
    try {
      audio.pause();
      audio.muted = false;
      audio.currentTime = 0;
      audio.src = src;
      await audio.play();                     // user gesture => allowed
      // start floats immediately on successful tap:
      const pics = pickIntroImages(unitMeta || {}, 5);
      armIntroFloats(pics);
      showIntroAudioOverlay(false);

      audio.onended = onDone;
      audio.onerror = onDone;
      audio.onstalled = onDone;
    } catch {
      showIntroAudioOverlay(false); // hide anyway; hard-cap will still fire
    } finally {
      els.introStartAudio.removeEventListener('click', handler);
      els.introStartAudio.removeEventListener('touchend', handler);
    }
  };

  els.introStartAudio.addEventListener('click', handler, { once: true });
  els.introStartAudio.addEventListener('touchend', handler, { once: true, passive: true });
}

/* ---------- robust intro audio play with watchdog ---------- */
function playIntroAudio({ src, maxMs = 10000, onDone } = {}) {
  // Cleanup previous listeners
  audio.onended = audio.onerror = audio.onstalled = null;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    audio.onended = audio.onerror = audio.onstalled = null;
    if (typeof onDone === 'function') onDone();
  };

  // Safety timer: if nothing fires, proceed anyway
  const timer = setTimeout(finish, maxMs);

  try {
    audio.pause();
    audio.muted = false;
    audio.currentTime = 0;
    audio.src = src;
    audio.load();

    // NEW: kick floats right away (guarded by floatsStarted so it won’t double-start)
    armIntroFloats(pickIntroImages(unitMeta || {}, 5));

    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        // audio actually started → kick off floats now
        const pics = pickIntroImages(unitMeta || {}, 5);
        armIntroFloats(pics);

        audio.onended = finish;
        audio.onerror = finish;
        audio.onstalled = finish;
      }).catch(() => {
        // Autoplay blocked; overlay path will handle the start
      });
    } else {
      // Very old browsers
      audio.onended = finish;
      audio.onerror = finish;
      audio.onstalled = finish;
    }
  } catch {
    // Any sync error: proceed via watchdog
  }
}

/* ---------- fade out intro & reveal UI ---------- */
function fadeOutIntroAndRevealUI({ onDone } = {}) {
  const text = els.introText;
  if (text) {
    text.style.transition = 'opacity 500ms ease';
    text.style.opacity = '0';
  }
  stopIntroFloat(true);
  floatsStarted = false;

  setTimeout(() => {
    if (text) { text.style.opacity = ''; }  // reset
    setFooterVisible(true);
    if (els.introNext) {
      els.introNext.style.display = '';
      const row = els.introNext.closest('.nav-row');
      if (row) {
        row.style.opacity = '0';
        row.style.transition = 'opacity 300ms ease';
        requestAnimationFrame(() => { row.style.opacity = '1'; });
      }
    }
    if (typeof onDone === 'function') onDone();
  }, 520);
}

/* ---------- iOS audio priming gesture (optional safety) ---------- */
let introAudioGestureHandler = null;
function armIntroAudioGestureOnce() {
  if (introAudioGestureHandler) return;
  introAudioGestureHandler = (e) => {
    const startBtn = els.introNext;
    const tappedStart = startBtn && (e.target === startBtn || (e.target.closest && e.target.closest('#nextButtonIntro')));
    if (!tappedStart) { audio.play().catch(() => { }); }
    document.removeEventListener('pointerdown', introAudioGestureHandler, true);
    document.removeEventListener('touchend', introAudioGestureHandler, true);
    document.removeEventListener('click', introAudioGestureHandler, true);
    introAudioGestureHandler = null;
  };
  document.addEventListener('pointerdown', introAudioGestureHandler, true);
  document.addEventListener('touchend', introAudioGestureHandler, true);
  document.addEventListener('click', introAudioGestureHandler, true);
}

/* ---------- core render ---------- */
async function render(i) {
  const item = screens[i];
  if (!item) return;

  // reset screens/media
  els.introScreen.style.display = "none";
  els.wordScreen.style.display = "none";
  exitVideoMode();
  stopAudio();
  disarmIntroFloats();

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
    if (item.audio) { audio.src = item.audio; audio.play().catch(() => { }); }
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
      if (els.skipIntro) els.skipIntro.style.display = "none";
      const bottom = document.querySelector(".intro-bottom-controls");
      if (bottom) bottom.style.display = "none";
      const tryUnmute = () => {
        if (!userInteracted) return;
        try { els.introVideo.muted = false; els.introVideo.removeAttribute('muted'); els.introVideo.volume = 1.0; } catch { }
      };
      els.introVideo.addEventListener('playing', () => setTimeout(tryUnmute, 60), { once: true });
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
        try { els.introVideo.muted = false; await els.introVideo.play(); els.playOverlay.style.display = "none"; if (els.unmuteIntro) els.unmuteIntro.style.display = "none"; } catch { }
      };
    }
    if (els.unmuteIntro) els.unmuteIntro.onclick = () => { els.introVideo.muted = false; els.unmuteIntro.style.display = "none"; };
    if (els.skipIntro) els.skipIntro.onclick = () => showNext();
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

  // 3) floats start only when audio starts (or user taps)
  floatsStarted = false;
  const introPics = pickIntroImages(unitMeta || {}, 5);

  // 4) audio playback & end transition (gated start for floats)
  if (item.audio) {
    // HARD CAP: always end intro by X ms
    const HARD_CAP_MS = 11000; // set a tad longer than your VO
    let hardCapTimer = setTimeout(() => {
      fadeOutIntroAndRevealUI();
    }, HARD_CAP_MS);

    // Try autoplay first
    playIntroAudio({
      src: item.audio,
      maxMs: 10000,
      onDone: () => {
        clearTimeout(hardCapTimer);
        fadeOutIntroAndRevealUI();
      }
    });

    // After a short grace, decide: autoplay worked or show overlay
    setTimeout(() => {
      if (!audio.paused) {
        // Autoplay OK → floats already armed in playIntroAudio()
      } else {
        // Autoplay blocked → show button and start floats only after tap
        showIntroAudioOverlay(true);
        attachIntroAudioOverlayOnce(item.audio, () => {
          clearTimeout(hardCapTimer);
          fadeOutIntroAndRevealUI();
        });
      }
    }, 300);

  } else {
    // No audio → start floats immediately and time out the intro
    armIntroFloats(introPics);
    setTimeout(() => fadeOutIntroAndRevealUI(), 8000);
  }

  // outro flag on intro screen if this was text outro
  const isTextOutro = (i === screens.length - 1);
  els.introScreen.classList.toggle('outro', isTextOutro);
}

/* ---------- nav ---------- */
function showPrev() { if (currentIndex > 0) { currentIndex--; render(currentIndex); } }
function showNext() {
  stopVideo(); exitVideoMode();
  if (currentIndex < screens.length - 1) { currentIndex++; render(currentIndex); }
  else { location.href = 'index.html'; }
}
function startOver() {
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
function getUnitIdFromUrl() { const p = new URLSearchParams(location.search); return p.get("unitId") || "unit1"; }
async function loadUnit(id) { const r = await fetch(`units/${id}.json`, { cache: "no-store" }); if (!r.ok) throw new Error(id); return r.json(); }

(async function () {
  const unit = await loadUnit(getUnitIdFromUrl());
  unitMeta = unit; // keep reference for introImages
  document.body.classList.add(`unit-${unit.id}`);
  const titleEl = document.getElementById("unitTitle");
  if (titleEl && unit.name) titleEl.textContent = unit.name;
  screens = Array.isArray(unit?.words) ? unit.words : [];
  currentIndex = 0;
  render(currentIndex);
})();
