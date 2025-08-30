
let screens = [];
let currentIndex = 0;

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
  return p.get("unitId") || "unit2";
}
async function loadUnit(id) {
  const r = await fetch(`units/${id}.json`, { cache: "no-store" });
  if (!r.ok) throw new Error(id);
  return r.json();
}
function stopAudio() {
  audio.pause();
  audio.currentTime = 0;
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
    els.wordScreen.style.display = "flex";
    // els.title.textContent = "Let’s Learn A / An";
    els.word.textContent = item.text || "";
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
    // ===== VIDEO SPLASH (auto-play muted, with Sound On + Skip) =====
    enterVideoMode();
    if (els.introWrap) els.introWrap.style.display = "block";
    els.introText.style.display = "none";

    if (item.poster) els.introVideo.setAttribute("poster", item.poster);
    els.introVideo.setAttribute("playsinline", "");
    els.introVideo.setAttribute("webkit-playsinline", "");
    els.introVideo.setAttribute("autoplay", "");

    // Try autoplay muted first (required by browsers)
    els.introVideo.muted = true;
    els.introVideo.setAttribute("muted", ""); // iOS requires the attribute present
    els.introVideo.src = item.video;

    try {
      await els.introVideo.play();
      // Autoplay worked (muted). Hide big ▶, show "Sound On" pill.
      if (els.playOverlay) els.playOverlay.style.display = "none";
      if (els.unmuteIntro) els.unmuteIntro.style.display = "inline-flex";
    } catch (e) {
      // Autoplay blocked -> show big ▶ (tap starts WITH sound)
      if (els.playOverlay) els.playOverlay.style.display = "flex";
      if (els.unmuteIntro) els.unmuteIntro.style.display = "none";
    }

    els.introVideo.onended = () => showNext();

    if (els.playOverlay) {
      els.playOverlay.onclick = async () => {
        try {
          els.introVideo.muted = false; // start with sound after user gesture
          await els.introVideo.play();
          els.playOverlay.style.display = "none";
          if (els.unmuteIntro) els.unmuteIntro.style.display = "none";
        } catch (err) {
          // ignore
        }
      };
    }

    if (els.unmuteIntro) {
      els.unmuteIntro.onclick = () => {
        // User gesture -> unmute while playing
        els.introVideo.muted = false;
        els.unmuteIntro.style.display = "none";
      };
    }

    if (els.skipIntro) {
      els.skipIntro.onclick = () => showNext();
    }

    // Hide the standard "NEXT" row while in full video splash
    if (els.introNext) els.introNext.style.display = "none";
    return;
  }

  // ===== TEXT INTRO / OUTRO (no video) =====
  if (els.introWrap) els.introWrap.style.display = "none";
  els.introText.style.display = "";
  els.introText.textContent = item.text || "";
  if (els.introNext) els.introNext.style.display = i === screens.length - 1 ? "none" : "";
  if (item.audio) {
    audio.src = item.audio;
    audio.play().catch(() => {});
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

/* Init */
(async function () {
  const unit = await loadUnit(getUnitIdFromUrl());
  screens = Array.isArray(unit?.words) ? unit.words : [];
  currentIndex = 0;
  render(currentIndex);
})();
