/* =========================================================
   Vocab Pack Prototype — vocab.js
   Isolated logic for app/vocab/vocab.html only.
   No connection to Firebase, quizzes, or any other page.

   Data-driven: reads json/categories.json to list categories,
   then loads that category's own JSON file (image/audio folders
   + word list) to drive the same intro -> flashcards -> outro
   flow for whichever category was picked.
   ========================================================= */

var CATEGORIES_URL = "json/categories.json";
var QUIZ_GROUPS_URL = "json/quizGroups.json";
var DASHBOARD_URL = "../dashboard.html";
const CLAP_SFX = "../choosequiz/effects/Clap.mp3";
const prefersReducedVocab = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
let confettiShotVocab = null;
let confettiInitTriedVocab = false;
let lastConfettiAtVocab = 0;

function getConfettiShotVocab() {
  if (confettiShotVocab) return confettiShotVocab;
  if (confettiInitTriedVocab && !window.confetti) return null;
  const canvas = document.getElementById("confettiCanvas");
  if (window.confetti && canvas) {
    confettiShotVocab = window.confetti.create(canvas, { resize: true, useWorker: true });
    confettiInitTriedVocab = true;
  }
  return confettiShotVocab;
}

function popConfettiVocab() {
  if (prefersReducedVocab) return;
  const shot = getConfettiShotVocab();
  if (!shot) return;
  const now = performance.now();
  if (now - lastConfettiAtVocab < 500) return;
  lastConfettiAtVocab = now;
  shot({
    particleCount: 600,
    spread: 70,
    origin: { x: Math.random() * 0.6 + 0.2, y: 0.3 }
  });
}

function playClapVocab() {
  try {
    const clap = new Audio(CLAP_SFX);
    clap.play().catch(() => {});
  } catch (e) {}
}

// The currently loaded category's data (set once a category is picked).
var currentCategory = null;

// Tracks which word is currently showing within the loaded category.
var currentIndex = 0;

// Chapter-group state (e.g. My Home) — set only while inside a chapterGroup;
// null/reset whenever a normal (non-chapter) category is loaded instead.
var currentChapterGroup = null;
var currentChapterIndex = 0;
var currentChapterMetas = [];

// Small leading icon shown before each top-level category's name in the picker.
var CATEGORY_ICONS = {
  family: "Images/icons/Myfamily.webp",
  mybody: "Images/icons/Mybody.webp",
  myhome: "Images/icons/Myhome.webp",
  kitchen: "Images/icons/Kitchen.webp",
  fruitsveg: "Images/icons/Fruits&Vegetables.webp",
  animals: "Images/icons/Animals.webp",
  birds: "Images/icons/Birds.webp",
  insects: "Images/icons/Insects&Smallcreatures.webp"
};

var CHAPTER_ICONS = {
  myhome: "Images/icons/Myhome.webp",
  kitchen: "Images/icons/Kitchen.webp",
  fruitsveg: "Images/icons/Fruits&Vegetables.webp"
};

var INTRO_LINES = {
  family: "Hi Friends! Let's learn some Family Words. Look, Listen and Repeat!",
  mybody: "Hello! Let's learn about our Body Parts. Look, Listen and Repeat.",
  myhome1: "Hello Friends! This is about our Home. Look, Listen and Repeat.",
  myhome2: "Hi! Let's continue! Look, Listen and Repeat.",
  myhome3: "Welcome to the third part of My Home! Look, Listen and Repeat.",
  myhome4: "Let's Continue My Home Part 4. Look, Listen and Repeat.",
  myhome5: "Welcome to My Home Part 5. Look, Listen and Repeat.",
  kitchen1: "Hello, little learners! Let's learn kitchen words. Look, listen and repeat!",
  kitchen2: "Let's learn some more kitchen words. Look, listen and repeat!",
  kitchen3: "Here are more kitchen words. Look, listen and repeat!",
  kitchen4: "Let's keep learning kitchen words. Look, listen and repeat!",
  kitchen5: "Great! Let's learn some more kitchen words. Look, listen and repeat!",
  kitchen6: "These are the last kitchen words. Look, listen and repeat!",
  fruitsveg1: "Hello, Friends! Let's learn Fruits and Vegetables.",
  fruitsveg2: "Let's learn some more fruits and vegetables.",
  fruitsveg3: "Welcome to Part 3!",
  fruitsveg4: "These are the last fruits and vegetables.",
  animals: "Hello, friends! Let's learn about Animals.",
  birds: "Hi, Let's learn about birds.",
  insects: "Let's learn about Insects and Small Creatures."
};

var OUTRO_LINES = {
  family: "Wonderful! See you in the next one. Bye!",
  mybody: "Excellent! Keep practising!",
  myhome5: "Wonderful! You learned many words about your home today! Bye!",
  kitchen6: "Excellent! You learned lots of kitchen words today. See you next time. Bye!"
};

// Screens
var categoryScreen = document.getElementById("categoryScreen");
var chapterListScreen = document.getElementById("chapterListScreen");
var introScreen = document.getElementById("introScreen");
var flashcardScreen = document.getElementById("flashcardScreen");
var outroScreen = document.getElementById("outroScreen");
var quizScreen = document.getElementById("quizScreen");
var quizScoreScreen = document.getElementById("quizScoreScreen");

// Category picker elements
var categoryListEl = document.getElementById("categoryList");

// Chapter list elements (for chapterGroup categories, e.g. My Home)
var chapterListEl = document.getElementById("chapterListEl");
var chapterListTitle = document.getElementById("chapterListTitle");

// Flashcard elements
var wordImageEl = document.getElementById("wordImage");
var wordTextEl = document.getElementById("wordText");
var progressTextEl = document.getElementById("progressText");
var backBtn = document.getElementById("backBtn");
var nextBtn = document.getElementById("nextBtn");
var playBtn = document.getElementById("playBtn");
var backLink = document.getElementById("backLink");
var backLinkText = document.getElementById("backLinkText");

// Intro / Outro elements
var introImageEl = document.getElementById("introImage");
var introMessageEl = document.getElementById("introMessage");
var introBadgeEl = document.getElementById("introBadge");
var outroImageEl = document.getElementById("outroImage");
var outroBadgeEl = document.getElementById("outroBadge");
var outroMessageEl = document.getElementById("outroMessage");
var startBtn = document.getElementById("startBtn");
var restartBtn = document.getElementById("restartBtn");
var introAudio = document.getElementById("introAudio");
var outroAudio = document.getElementById("outroAudio");

// Show only one screen at a time.
function showScreen(screenToShow) {
  categoryScreen.classList.add("hidden");
  chapterListScreen.classList.add("hidden");
  introScreen.classList.add("hidden");
  flashcardScreen.classList.add("hidden");
  outroScreen.classList.add("hidden");
  quizScreen.classList.add("hidden");
  quizScoreScreen.classList.add("hidden");
  screenToShow.classList.remove("hidden");
  updateBackLink(screenToShow);
}

// Keep the global back link in sync with the current screen.
// Only the text span updates \u2014 the SVG chevron icon in vocab.html stays put.
function updateBackLink(screenToShow) {
  backLinkText.textContent = screenToShow === categoryScreen
    ? "Back to Main Menu"
    : "Back to Categories";
}

// Speak a word aloud using the browser's built-in speech feature.
function speakWord(word) {
  if ("speechSynthesis" in window) {
    var utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-GB";
    window.speechSynthesis.speak(utterance);
  }
}

// Play an <audio> element, falling back to speech synthesis on failure.
function playAudioWithFallback(audioEl, fallbackWord) {
  var playPromise = audioEl.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(function () {
      if (fallbackWord) {
        speakWord(fallbackWord);
      }
    });
  }
}

// Build the full path to an image/audio file inside the current category's folders.
function categoryImagePath(filename) {
  return currentCategory.imageFolder + "/" + filename;
}
function categoryAudioPath(filename) {
  return currentCategory.audioFolder + "/" + filename;
}

function getActiveToneClass() {
  if (currentChapterGroup && currentChapterGroup.toneClass) {
    return currentChapterGroup.toneClass;
  }
  return currentCategory && currentCategory.toneClass ? currentCategory.toneClass : "tone-a";
}

function getActiveCategoryLabel() {
  if (currentChapterGroup) {
    return currentChapterGroup.label || currentChapterGroup.id;
  }
  return currentCategory && currentCategory.label ? currentCategory.label : "Vocabulary";
}

function setStageTone(stageEl) {
  stageEl.classList.remove("tone-a", "tone-b", "tone-c");
  stageEl.classList.add(getActiveToneClass());
}

function getIntroLine() {
  var id = currentCategory.id;
  return INTRO_LINES[id] || ("Let's learn some new words about " + getActiveCategoryLabel() + " together!");
}

// Category completion tracking (localStorage)
var COMPLETED_CATEGORIES_KEY = "speakup_vocab_completed";

// Reads the completed-category-id list from localStorage.
// Always returns an array, even if the key is missing or holds bad JSON.
function getCompletedCategories() {
  try {
    var parsed = JSON.parse(localStorage.getItem(COMPLETED_CATEGORIES_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

// Adds a category id to the completed list (if not already there) and persists it.
function markCategoryCompleted(categoryId) {
  var completed = getCompletedCategories();
  if (completed.indexOf(categoryId) === -1) {
    completed.push(categoryId);
    localStorage.setItem(COMPLETED_CATEGORIES_KEY, JSON.stringify(completed));

    // A newly-completed category/chapterGroup may unlock a quiz tile.
    // The category picker's tiles were already built once at page load
    // (loadCategoryList() only runs there), so without this the newly
    // unlocked "Quiz" card would stay disabled until the page is fully
    // reloaded. Re-running it here rebuilds the (currently hidden)
    // picker DOM in the background, so it's already correct by the time
    // the user navigates back to it.
    loadCategoryList();
  }
}

// Chapter completion tracking (localStorage) — for chapterGroup categories
// like My Home. Stores an OBJECT keyed by group id, each value an array of
// completed chapter ids, e.g. { "myhome": ["myhome1", "myhome2"] }.
var CHAPTERS_COMPLETED_KEY = "speakup_vocab_chapters_completed";

// Reads the completed-chapter-id list for one group. Always returns an
// array, even if the key/group is missing or holds bad JSON.
function getCompletedChapters(groupId) {
  try {
    var parsed = JSON.parse(localStorage.getItem(CHAPTERS_COMPLETED_KEY));
    if (!parsed || typeof parsed !== "object") return [];
    return Array.isArray(parsed[groupId]) ? parsed[groupId] : [];
  } catch (err) {
    return [];
  }
}

// Adds a chapter id to its group's completed list (if not already there) and persists it.
function markChapterCompleted(groupId, chapterId) {
  var all;
  try {
    all = JSON.parse(localStorage.getItem(CHAPTERS_COMPLETED_KEY));
    if (!all || typeof all !== "object") all = {};
  } catch (err) {
    all = {};
  }

  var completed = Array.isArray(all[groupId]) ? all[groupId] : [];
  if (completed.indexOf(chapterId) === -1) {
    completed.push(chapterId);
    all[groupId] = completed;
    localStorage.setItem(CHAPTERS_COMPLETED_KEY, JSON.stringify(all));
  }
}

// Draw the current word onto the page and update button states.
// direction: "next", "back", or omitted (no animation, e.g. first load).
function renderWord(direction) {
  var words = currentCategory.words;
  var current = words[currentIndex];
  var newImagePath = categoryImagePath(current.image);

  wordTextEl.textContent = current.word;
  progressTextEl.textContent = (currentIndex + 1) + " of " + words.length;

  // Disable "Back" on the first word.
  backBtn.disabled = currentIndex === 0;

  // On the last word, "Next" becomes "Finish".
  var isLastWord = currentIndex === words.length - 1;
  nextBtn.textContent = isLastWord ? "Finish" : "Next";

  function applyImage() {
    wordImageEl.src = newImagePath;
    wordImageEl.alt = current.word;
    wordImageEl.classList.remove("slide-in-next", "slide-in-back");
    if (direction === "next" || direction === "back") {
      void wordImageEl.offsetWidth;
      wordImageEl.classList.add(direction === "next" ? "slide-in-next" : "slide-in-back");
    }
  }

  if (direction === "next" || direction === "back") {
    var preloadImg = new Image();
    preloadImg.onload = applyImage;
    preloadImg.onerror = applyImage;
    preloadImg.src = newImagePath;
  } else {
    applyImage();
  }
}

// Move to the previous word (if possible).
function goBack() {
  if (currentIndex > 0) {
    currentIndex = currentIndex - 1;
    renderWord("back");
  }
}

// Move to the next word, or show the outro screen on the last word.
function goNext() {
  var isLastWord = currentIndex === currentCategory.words.length - 1;

  if (isLastWord) {
    if (currentChapterGroup && !currentCategory.outro) {
      // Mid-group chapter (no outro field): skip the outro screen
      // entirely and go straight into the next chapter's intro.
      markChapterCompleted(currentChapterGroup.id, currentCategory.id);
      if (currentChapterIndex + 1 < currentChapterMetas.length) {
        loadChapterByIndex(currentChapterIndex + 1);
      }
      return;
    }

    if (currentChapterGroup && currentCategory.outro) {
      // Final chapter of the group: mark the chapter AND the whole group
      // completed. The group-level mark reuses the existing top-level
      // completion tracking, so it plugs straight into the existing
      // Quiz-group-of-2 unlock logic with no changes needed there.
      markChapterCompleted(currentChapterGroup.id, currentCategory.id);
      markCategoryCompleted(currentChapterGroup.id);
      showOutro();
      return;
    }

    // Normal single category (Family / My Body) — unchanged.
    showOutro();
    return;
  }

  currentIndex = currentIndex + 1;
  renderWord("next");
}

// Play the current word's audio, or fall back to speech synthesis.
function playCurrentWord() {
  var current = currentCategory.words[currentIndex];

  if (current.audio) {
    var audio = new Audio(categoryAudioPath(current.audio));
    audio.addEventListener("error", function () {
      speakWord(current.word);
    });
    playAudioWithFallback(audio, current.word);
    return;
  }

  // No audio file at all, so use the browser's built-in speech feature.
  speakWord(current.word);
}

// Show the intro screen and autoplay its narration.
function showIntro() {
  introImageEl.src = categoryImagePath(currentCategory.intro.image);
  introBadgeEl.textContent = getActiveCategoryLabel();
  introMessageEl.textContent = getIntroLine();
  setStageTone(introScreen);
  introAudio.src = categoryAudioPath(currentCategory.intro.audio);

  showScreen(introScreen);
  introAudio.currentTime = 0;
  playAudioWithFallback(introAudio, null);
}

// Show the outro screen and autoplay its narration.
function showOutro() {
  markCategoryCompleted(currentCategory.id);

  outroImageEl.src = categoryImagePath(currentCategory.outro.image);
  outroBadgeEl.textContent = getActiveCategoryLabel();
  setStageTone(outroScreen);
  outroAudio.src = categoryAudioPath(currentCategory.outro.audio);

  showScreen(outroScreen);
  outroAudio.currentTime = 0;
  playAudioWithFallback(outroAudio, null);

  // NEW: celebration effects
  popConfettiVocab();
  playClapVocab();
  var wordCount;
  if (currentChapterGroup && currentChapterMetas && currentChapterMetas.length > 0) {
    // Multi-chapter category: sum the word counts of every chapter in the group.
    wordCount = currentChapterMetas.reduce(function (sum, meta) {
      return sum + (meta.wordCount || 0);
    }, 0);
  } else {
    // Single-chapter category (e.g. Family, My Body): just this category's words.
    wordCount = currentCategory.words ? currentCategory.words.length : 0;
  }
  const countEl = document.getElementById("outroWordCount");
  if (countEl) {
    countEl.innerHTML = "\u2728 You learned <span style=\"font-size:1.3em;\">" + wordCount + "</span> words today! \u2728";
  }
}

// Start button: move from intro to the first flashcard.
function startFlashcards() {
  currentIndex = 0;
  renderWord();
  showScreen(flashcardScreen);
}

// Restart button on the outro screen: replay the current learning path.
function restartCurrentPath() {
  if (currentChapterGroup) {
    loadChapterByIndex(0);
    return;
  }

  currentIndex = 0;
  showIntro();
}

// Quiz score screen's "Back to categories" button (called from
// vocab-quiz.js): leave the quiz entirely and reload the category
// picker fresh, so any newly-unlocked quiz tiles reflect the
// completion state that just changed.
function goToCategoryPicker() {
  currentCategory = null;
  currentChapterGroup = null;
  loadCategoryList();
  showScreen(categoryScreen);
}

// Fetch a category's word-list JSON, then show its intro screen.
function loadCategory(categoryMeta) {
  // Defensive reset: a prior visit to a chapterGroup (e.g. My Home) could
  // leave currentChapterGroup set. Without clearing it here, goNext() would
  // wrongly treat this normal category's last word as a chapter-group
  // ending instead of calling showOutro() the usual way.
  currentChapterGroup = null;

  fetch(categoryMeta.file)
    .then(function (res) { return res.json(); })
    .then(function (categoryData) {
      currentCategory = categoryData;
      currentCategory.id = categoryMeta.id;
      currentCategory.toneClass = categoryMeta.toneClass;
      showIntro();
    })
    .catch(function (err) {
      console.error("vocab: failed to load " + categoryMeta.file, err);
    });
}

// Fetch a chapterGroup's chapter list (id + file per chapter), plus each
// chapter's own label (same pattern loadCategoryList() uses for top-level
// categories), then show the chapter list screen.
function loadChapterGroup(groupMeta) {
  fetch(groupMeta.chaptersFile)
    .then(function (res) { return res.json(); })
    .then(function (chapterMetas) {
      var labelPromises = chapterMetas.map(function (chapterMeta) {
        return fetch(chapterMeta.file)
          .then(function (res) { return res.json(); })
          .then(function (data) {
            chapterMeta.label = data.label;
            chapterMeta.wordCount = data.words ? data.words.length : 0;
          });
      });

      return Promise.all(labelPromises).then(function () {
        currentChapterMetas = chapterMetas;
        currentChapterGroup = groupMeta;
        chapterListTitle.textContent = groupMeta.label || groupMeta.id;
        chapterListTitle.classList.remove("tone-a", "tone-b", "tone-c");
        chapterListTitle.classList.add(groupMeta.toneClass || "tone-c");
        renderChapterList();
        showScreen(chapterListScreen);
      });
    })
    .catch(function (err) {
      console.error("vocab: failed to load " + groupMeta.chaptersFile, err);
    });
}

// Draw one button per chapter in the chapter list screen. A chapter is
// unlocked if it's the first one, or the previous chapter has been
// completed. Locked ones are disabled and rendered without a chevron.
function renderChapterList() {
  chapterListEl.innerHTML = "";

  var completed = getCompletedChapters(currentChapterGroup.id);
  var totalChapters = currentChapterMetas.length;
  var toneClass = currentChapterGroup.toneClass || "tone-c";
  var icon = CHAPTER_ICONS[currentChapterGroup.id] || CATEGORY_ICONS[currentChapterGroup.id] || "📘";

  currentChapterMetas.forEach(function (chapterMeta, index) {
    var isUnlocked = index === 0 || completed.indexOf(currentChapterMetas[index - 1].id) !== -1;

    var label = chapterMeta.label || chapterMeta.id;
    var wordCount = chapterMeta.wordCount || 0;
    var subtitle = "Chapter " + (index + 1) + " of " + totalChapters + " · " + wordCount + " words";
    var btn = buildTileButton(isUnlocked ? toneClass : "chapter-locked", isUnlocked ? icon : "🔒", label, subtitle);

    if (isUnlocked) {
      btn.addEventListener("click", function () {
        loadChapterByIndex(index);
      });
    } else {
      btn.disabled = true;
      var chevron = btn.querySelector(".category-tile-chevron");
      if (chevron) {
        chevron.remove();
      }
    }

    chapterListEl.appendChild(btn);
  });
}

// Fetch one chapter's word-list JSON (same way loadCategory() does), then
// show its intro screen.
function loadChapterByIndex(index) {
  currentChapterIndex = index;
  var chapterMeta = currentChapterMetas[index];

  fetch(chapterMeta.file)
    .then(function (res) { return res.json(); })
    .then(function (categoryData) {
      currentCategory = categoryData;
      currentCategory.id = chapterMeta.id;
      currentCategory.toneClass = currentChapterGroup ? currentChapterGroup.toneClass : "tone-c";
      showIntro();
    })
    .catch(function (err) {
      console.error("vocab: failed to load " + chapterMeta.file, err);
    });
}

// Shuffle an array in place (Fisher-Yates). Local to vocab.js so
// buildMixedCategory() doesn't depend on vocab-quiz.js's own shuffleQuiz.
function shuffleWords(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

// Build a single merged "pseudo-category" combining words from 2+ real
// categories (used for the unlocked "Quiz" cards that mix categories
// together). `categoryEntries` must already have `.data` populated
// (loadCategoryList does this). Each merged word carries its OWN source
// category's imageFolder/audioFolder, since the two categories can use
// different asset folders — vocab-quiz.js resolves paths per-word when
// present, falling back to a single category's folder otherwise.
// The merged words[] is shuffled before returning, so chunkWords() in
// vocab-quiz.js (unchanged) splits a randomized order into rounds instead
// of one category's words filling round 1, the other's filling round 2.
function buildMixedCategory(categoryEntries, ids) {
  var matchingEntries = ids.map(function (id) {
    return categoryEntries.filter(function (entry) { return entry.id === id; })[0];
  });

  var mergedWords = [];
  matchingEntries.forEach(function (entry) {
    entry.data.words.forEach(function (word) {
      mergedWords.push({
        word: word.word,
        image: word.image,
        audio: word.audio,
        // A chapterGroup's words already carry their OWN chapter's folder
        // (set by loadCategoryList()) — prefer that per-word folder, and
        // fall back to the entry's single folder for normal categories.
        imageFolder: word.imageFolder || entry.data.imageFolder,
        audioFolder: word.audioFolder || entry.data.audioFolder
      });
    });
  });

  var labels = matchingEntries.map(function (entry) { return entry.label; });

  shuffleWords(mergedWords);

  return {
    id: ids.join("_"),
    label: labels.join(" + "),
    words: mergedWords
  };
}

// Background/text tone cycled across category tiles, in categories.json order.
// A 4th category (and beyond) wraps back around to tone-a, tone-b, etc.
var CATEGORY_TONE_CLASSES = ["tone-a", "tone-b", "tone-c"];

// Builds one picker row: icon box (its own element, swappable for an <img>
// later) + title/subtitle text + trailing chevron. Shared by category and
// quiz cards so both stay visually identical in structure and sizing.
function buildTileButton(toneClass, icon, title, subtitle) {
  var btn = document.createElement("button");
  btn.className = "category-tile " + toneClass;

  var iconBox = document.createElement("div");
  iconBox.className = "category-icon-box";

  var isImageIcon = typeof icon === "string" && icon.indexOf("Images/icons/") === 0;
  if (isImageIcon) {
    var iconImg = document.createElement("img");
    iconImg.className = "category-icon category-icon-image";
    iconImg.src = icon;
    iconImg.alt = "";
    iconBox.appendChild(iconImg);
  } else {
    var iconSpan = document.createElement("span");
    iconSpan.className = "category-icon";
    iconSpan.textContent = icon;
    iconBox.appendChild(iconSpan);
  }

  btn.appendChild(iconBox);

  var textWrap = document.createElement("div");
  textWrap.className = "category-tile-text";

  var titleEl = document.createElement("p");
  titleEl.className = "category-tile-title";
  titleEl.textContent = title;
  textWrap.appendChild(titleEl);

  var subtitleEl = document.createElement("p");
  subtitleEl.className = "category-tile-subtitle";
  subtitleEl.textContent = subtitle;
  textWrap.appendChild(subtitleEl);

  btn.appendChild(textWrap);

  var chevron = document.createElement("span");
  chevron.className = "category-tile-chevron";
  chevron.textContent = "›";
  btn.appendChild(chevron);

  return btn;
}

// Draw one tile per category in the picker screen.
function renderCategoryList(categories) {
  categoryListEl.innerHTML = "";

  loadQuizGroups().then(function (quizGroups) {
    var completed = getCompletedCategories();

    // Map each category id to the LAST index it appears at, so we know
    // exactly where each quiz group "completes" in the tile order.
    var lastIndexById = {};
    categories.forEach(function (categoryMeta, index) {
      lastIndexById[categoryMeta.id] = index;
    });

    // For each category tile index, collect any quiz groups whose last
    // category is that tile (usually 0 or 1 group per tile).
    var quizGroupsByTileIndex = {};
    quizGroups.forEach(function (quizGroup) {
      var ids = quizGroup.categoryIds;
      var lastCategoryId = ids[ids.length - 1];
      var tileIndex = lastIndexById[lastCategoryId];
      if (tileIndex === undefined) return;
      if (!quizGroupsByTileIndex[tileIndex]) quizGroupsByTileIndex[tileIndex] = [];
      quizGroupsByTileIndex[tileIndex].push(quizGroup);
    });

    categories.forEach(function (categoryMeta, index) {
      var icon = CATEGORY_ICONS[categoryMeta.id] || "❓";
      var label = categoryMeta.label || categoryMeta.id;
      var wordCount = categoryMeta.data && categoryMeta.data.words ? categoryMeta.data.words.length : 0;
      var toneClass = CATEGORY_TONE_CLASSES[index % CATEGORY_TONE_CLASSES.length];
      categoryMeta.toneClass = toneClass;

      var btn = buildTileButton(toneClass, icon, label, wordCount + " words");

      btn.addEventListener("click", function () {
        if (categoryMeta.type === "chapterGroup") {
          loadChapterGroup(categoryMeta);
        } else {
          loadCategory(categoryMeta);
        }
      });
      categoryListEl.appendChild(btn);

      // Insert any quiz card(s) that "complete" right after this tile.
      var groupsHere = quizGroupsByTileIndex[index];
      if (groupsHere) {
        groupsHere.forEach(function (quizGroup) {
          var quizBtn = buildQuizGroupCard(quizGroup, categories, completed);
          if (quizBtn) categoryListEl.appendChild(quizBtn);
        });
      }
    });
  });
}

// Build a single quiz card button for one quiz group, or return null if the
// group references an unknown category (skipped, same as before).
function buildQuizGroupCard(quizGroup, categories, completed) {
  var ids = quizGroup.categoryIds;
  var matchedCategories = ids.map(function (categoryId) {
    return categories.filter(function (categoryMeta) { return categoryMeta.id === categoryId; })[0];
  });

  var hasUnmatched = matchedCategories.some(function (categoryMeta) { return !categoryMeta; });
  if (hasUnmatched) {
    console.warn(
      "vocab: quiz group \"" + quizGroup.groupId + "\" references an unknown category id, skipping",
      ids
    );
    return null;
  }

  var labels = matchedCategories.map(function (categoryMeta) { return categoryMeta.label || categoryMeta.id; });
  var isUnlocked = ids.every(function (id) { return completed.indexOf(id) !== -1; });

  var questionCount = matchedCategories.reduce(function (total, categoryMeta) {
    return total + (categoryMeta.data && categoryMeta.data.words ? categoryMeta.data.words.length : 0);
  }, 0);

  var btn = buildTileButton("tone-quiz challenge-card", "Images/icons/Trophy.webp", "Quiz: " + labels.join(" + "), questionCount + " questions");

  if (isUnlocked) {
    btn.addEventListener("click", function () {
      var mixedCategory = buildMixedCategory(categories, ids);
      startVocabQuiz(mixedCategory);
    });
  } else {
    btn.disabled = true;
  }

  return btn;
}

// Fetch quizGroups.json and return it as a promise (does not render anything).
function loadQuizGroups() {
  return fetch(QUIZ_GROUPS_URL)
    .then(function (res) { return res.json(); })
    .catch(function (err) {
      console.error("vocab: failed to load " + QUIZ_GROUPS_URL, err);
      return [];
    });
}

// Fetch the category list and render the picker, filling in each
// category's display label from its own word-list file.
function loadCategoryList() {
  fetch(CATEGORIES_URL)
    .then(function (res) { return res.json(); })
    .then(function (categoryEntries) {
      var labelPromises = categoryEntries.map(function (entry) {
        // chapterGroup entries (e.g. My Home) already carry their own
        // inline label from categories.json, but have no single word-list
        // file — fetch the chapter list, then each chapter's own words
        // file, and flatten everything into one entry.data.words array so
        // buildMixedCategory() can quiz the whole group like any other
        // category. Each word is tagged with its OWN chapter's
        // imageFolder/audioFolder, since chapters use different folders.
        // Chapter order is kept as-is here; buildMixedCategory() shuffles
        // later when the quiz is actually built.
        if (entry.type === "chapterGroup") {
          return fetch(entry.chaptersFile)
            .then(function (res) { return res.json(); })
            .then(function (chapterMetas) {
              var chapterPromises = chapterMetas.map(function (chapterMeta) {
                return fetch(chapterMeta.file)
                  .then(function (res) { return res.json(); })
                  .then(function (chapterData) {
                    return chapterData.words.map(function (word) {
                      return {
                        word: word.word,
                        image: word.image,
                        audio: word.audio,
                        imageFolder: chapterData.imageFolder,
                        audioFolder: chapterData.audioFolder
                      };
                    });
                  });
              });

              return Promise.all(chapterPromises).then(function (wordsPerChapter) {
                var allWords = [];
                wordsPerChapter.forEach(function (chapterWords) {
                  allWords = allWords.concat(chapterWords);
                });

                entry.data = {
                  label: entry.label,
                  words: allWords
                };
              });
            });
        }

        return fetch(entry.file)
          .then(function (res) { return res.json(); })
          .then(function (data) {
            entry.label = data.label;
            // Keep the full parsed category (imageFolder/audioFolder/words)
            // in memory so mixed quizzes can be built without re-fetching.
            entry.data = data;
          });
      });
      return Promise.all(labelPromises).then(function () {
        renderCategoryList(categoryEntries);
      });
    })
    .catch(function (err) {
      console.error("vocab: failed to load " + CATEGORIES_URL, err);
    });
}

// Wire up the buttons.
backBtn.addEventListener("click", goBack);
nextBtn.addEventListener("click", goNext);
playBtn.addEventListener("click", playCurrentWord);
startBtn.addEventListener("click", startFlashcards);
restartBtn.addEventListener("click", restartCurrentPath);

backLink.addEventListener("click", function (event) {
  event.preventDefault();
  if (!categoryScreen.classList.contains("hidden")) {
    window.location.href = DASHBOARD_URL;
    return;
  }

  currentChapterGroup = null;
  showScreen(categoryScreen);
});

// Show the category picker when the page first loads —
// but wait for the paid/trial access check first (access-guard.js).
(async function initVocabAccess() {
  if (window.SUAccessReady) {
    const hasAccess = await window.SUAccessReady;
    if (!hasAccess) return; // access-guard.js already replaced the page with a locked screen
  }
  showScreen(categoryScreen);
  loadCategoryList();
})();
