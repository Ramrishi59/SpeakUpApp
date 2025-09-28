
let screens = [];
let currentIndex = 0;

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
  introOutroActions: document.getElementById("introOutroActions"),
  startoverIntro:    document.getElementById("startoverIntro"),


  // Word slides
  wordScreen:   document.getElementById("wordDisplay"),
  title:        document.getElementById("lessonText"),
  word:         document.getElementById("wordText"),
  image:        document.getElementById("wordImage"),
  prev:         document.getElementById("prevButton"),
  next:         document.getElementById("nextButton"),
  start:        document.getElementById("startoverButton"),
};

  function getUnitIdFromUrl() {
    const p = new URLSearchParams(location.search);
    return p.get("unitId") || "unit1";
  }
async function loadUnit(id) {
  const r = await fetch(`units/${id}.json`, { cache: "no-store" });
  if (!r.ok) throw new Error(id);
  return r.json();
}

function stopAudio() {
  audio.pause();
  audio.currentTime = 0;
  audio.onended = null;
}
function stopVideo() {
  if (!els.introVideo) return;
  els.introVideo.pause();
  els.introVideo.removeAttribute("src");
  els.introVideo.removeAttribute("poster");
  els.introVideo.load();
  if (els.playOverlay) els.playOverlay.style.display = "none";
  if (els.unmuteIntro) els.unmuteIntro.style.display = "none";
}

function enterVideoMode() {
  document.body.classList.add("video-active");
  els.introScreen.classList.add("video-fullscreen");
}
function exitVideoMode() {
  document.body.classList.remove("video-active");
  els.introScreen.classList.remove("video-fullscreen");
}

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

function lockIntroWords(container, opts = {}) {
  const spans = container.querySelectorAll('.intro-word');
  if (!spans.length) return;

  const wordDelay = opts.wordDelay ?? 100; // must match your showIntroBounce delay
  const duration  = opts.duration  ?? 700; // ms, must match CSS .7s
  const total = (spans.length - 1) * wordDelay + duration + 80;

  setTimeout(() => {
    spans.forEach(s => {
      s.style.opacity = '1';
      s.style.transform = 'none';
      s.style.animation = 'none';
    });
  }, total);
}


// One-time gesture to start intro audio without hijacking the Start button
let introAudioGestureHandler = null;
function armIntroAudioGestureOnce() {
  if (introAudioGestureHandler) return;

  introAudioGestureHandler = (e) => {
    // If they tapped the Start/Next button, don't play (we're about to navigate)
    const startBtn = els.introNext;
    const tappedStart = startBtn && (e.target === startBtn || (e.target.closest && e.target.closest('#nextButtonIntro')));
    if (!tappedStart) {
      audio.play().catch(() => {});
    }
    document.removeEventListener('pointerdown', introAudioGestureHandler, true);
    document.removeEventListener('touchend',   introAudioGestureHandler, true);
    document.removeEventListener('click',      introAudioGestureHandler, true);
    introAudioGestureHandler = null;
  };

  // Capture phase so we run before the Start button's click handler
  document.addEventListener('pointerdown', introAudioGestureHandler, true);
  document.addEventListener('touchend',   introAudioGestureHandler, true);
  document.addEventListener('click',      introAudioGestureHandler, true);
}


/* Core render */
async function render(i) {
  const item = screens[i];
  if (!item) return;

  // Hide both sections first
  els.introScreen.style.display = "none";
  els.wordScreen.style.display = "none";
  exitVideoMode();              // reset video mode unless we enable it again
  stopAudio();                  // never overlap audio with video

  if (item.image) {
    // WORD SLIDE
    stopVideo();
    // els.wordScreen.style.display = "flex";
    els.wordScreen.style.display = "grid";
    // els.title.textContent = "Let’s Learn A / An";
    els.word.innerHTML = (item.text || "").replace(/ (?!.* )/, "&nbsp;");
    els.image.src = item.image;
    els.image.alt = item.text || "Lesson image";
    els.prev.style.display = i === 0 ? "none" : "";
    els.next.style.display = i === screens.length - 1 ? "none" : "";
    if (item.audio) {
      audio.src = item.audio;
      audio.play().catch(() => {});
    }
    return;
  }

  // INTRO / OUTRO
  els.introScreen.style.display = "flex";

  if (item.video) {
    // Detect: last slide => treat as OUTRO
    const isOutro = (i === screens.length - 1);

    enterVideoMode();
    if (els.introWrap) els.introWrap.style.display = "block";
    els.introText.style.display = "none";

    if (item.poster) els.introVideo.setAttribute("poster", item.poster);
    els.introVideo.setAttribute("playsinline", "");
    els.introVideo.setAttribute("webkit-playsinline", "");
    els.introVideo.src = item.video;
    els.introVideo.load();

    // Hide the standard "NEXT" row while in full video splash
    if (els.introNext) els.introNext.style.display = "none";

    if (isOutro) {
      // OUTRO: play and return to dashboard on end
      els.introVideo.setAttribute("autoplay", "");
      els.introVideo.setAttribute("muted", "");
      els.introVideo.muted = true;

      // Hide overlays/controls on outro
      if (els.playOverlay) { els.playOverlay.style.display = "none"; els.playOverlay.onclick = null; }
      if (els.unmuteIntro) els.unmuteIntro.style.display = "none";
      if (els.skipIntro)   els.skipIntro.style.display   = "none";
      const bottom = document.querySelector(".intro-bottom-controls");
      if (bottom) bottom.style.display = "none";

      const tryUnmute = () => {
        if (!userInteracted) return;
        try {
          els.introVideo.muted = false;
          els.introVideo.removeAttribute('muted');
          els.introVideo.volume = 1.0;
        } catch {}
      };
      els.introVideo.addEventListener('playing', () => setTimeout(tryUnmute, 60), { once:true });

      els.introVideo.onended = () => {
        stopAudio(); stopVideo(); exitVideoMode();
        location.href = 'index.html';
      };
      return; // don't run intro behavior below
    }

    // INTRO: show Play overlay; start with sound on tap
    els.introVideo.removeAttribute("autoplay");
    els.introVideo.removeAttribute("muted");
    els.introVideo.muted = false;

    if (els.playOverlay) els.playOverlay.style.display = "flex";
    if (els.unmuteIntro) els.unmuteIntro.style.display = "none";

    els.introVideo.onended = () => showNext();

    if (els.playOverlay) {
      els.playOverlay.onclick = async () => {
        userInteracted = true;
        try {
          els.introVideo.muted = false;
          await els.introVideo.play();
          els.playOverlay.style.display = "none";
          if (els.unmuteIntro) els.unmuteIntro.style.display = "none";
        } catch (err) { /* ignore */ }
      };
    }

    if (els.unmuteIntro) {
      els.unmuteIntro.onclick = () => {
        els.introVideo.muted = false;
        els.unmuteIntro.style.display = "none";
      };
    }

    if (els.skipIntro) {
      els.skipIntro.onclick = () => showNext();
    }

    return;
  }
  

  // ===== TEXT INTRO / OUTRO (no video) =====
  if (els.introWrap) els.introWrap.style.display = "none";
  els.introText.style.display = "";
  // Kick off audio first for snappier sync
  if (item.audio) {
    try {
      audio.pause();
      audio.muted = false;   // make sure it isn't muted from any video
      audio.currentTime = 0;
      audio.src = item.audio;  // starts the network request immediately
      audio.play().catch(()=>{}); // if iOS blocks, it’ll still start once they interact
    } catch {}
  }


  showIntroBounce(els.introText, item.text || "", { wordDelay: 50, reset: true });
  lockIntroWords(els.introText, { wordDelay: 50, duration: 500 });
  // els.introText.textContent = item.text || "";
  const isOutro = (i === screens.length - 1);

  // --- Play audio for text intro/outro without breaking Start button UX ---
if (item.audio) {
  try {
    audio.pause();
    audio.muted = false;   // ensure not muted from any video intro
    audio.currentTime = 0;
    audio.src = item.audio;

    const isIntroText = (i === 0);

    if (isIntroText) {
      // Try immediate autoplay (may be blocked on iOS)
      audio.play().catch(() => {});
      // If blocked, arm a one-time gesture that ignores taps on the Start button
      armIntroAudioGestureOnce();
    } else {
      // Outro can autoplay safely after prior gestures
      audio.play().catch(() => {});
    }
  } catch { /* no-op */ }
}

  if (els.introNext) els.introNext.style.display = isOutro ? "none" : "";
  if (els.introOutroActions) els.introOutroActions.style.display = isOutro ? "" : "none";
  
  // Mark the intro screen so CSS can style differently on outro
  if (isOutro) {
    els.introScreen.classList.add('outro');
  } else {
    els.introScreen.classList.remove('outro');
  }  
}

/* Nav */
function showPrev() {
  if (currentIndex > 0) {
    currentIndex--;
    render(currentIndex);
  }
}
function showNext() {
  stopVideo();
  exitVideoMode();
  if (currentIndex < screens.length - 1) {
    currentIndex++;
    render(currentIndex);
  } else {
    // At the end of the lesson (after outro)
    location.href = 'index.html';
  }
}
function startOver() {
  currentIndex = 0;
  stopAudio();
  stopVideo();
  exitVideoMode();
  render(currentIndex);
}

/* Events */
els.prev?.addEventListener("click", showPrev);
els.next?.addEventListener("click", showNext);
els.introNext?.addEventListener("click", showNext);
els.start?.addEventListener("click", startOver);
els.startoverIntro?.addEventListener("click", startOver);


/* Init */
(async function () {
  const unit = await loadUnit(getUnitIdFromUrl());
  document.body.classList.add(`unit-${unit.id}`); // e.g., unit-unit3


  // NEW: set the unit title from JSON
  const titleEl = document.getElementById("unitTitle");
  if (titleEl && unit.name) {
    titleEl.textContent = unit.name;
  }

  screens = Array.isArray(unit?.words) ? unit.words : [];
  currentIndex = 0;
  render(currentIndex);
})();

