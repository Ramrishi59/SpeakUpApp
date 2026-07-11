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

// The currently loaded category's data (set once a category is picked).
var currentCategory = null;

// Tracks which word is currently showing within the loaded category.
var currentIndex = 0;

// Chapter-group state (e.g. My Home) — set only while inside a chapterGroup;
// null/reset whenever a normal (non-chapter) category is loaded instead.
var currentChapterGroup = null;
var currentChapterIndex = 0;
var currentChapterMetas = [];

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
var chapterBackLink = document.getElementById("chapterBackLink");

// Flashcard elements
var wordImageEl = document.getElementById("wordImage");
var wordTextEl = document.getElementById("wordText");
var progressTextEl = document.getElementById("progressText");
var backBtn = document.getElementById("backBtn");
var nextBtn = document.getElementById("nextBtn");
var playBtn = document.getElementById("playBtn");
var backLink = document.getElementById("backLink");

// Intro / Outro elements
var introImageEl = document.getElementById("introImage");
var introMessageEl = document.getElementById("introMessage");
var outroImageEl = document.getElementById("outroImage");
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
function renderWord() {
  var words = currentCategory.words;
  var current = words[currentIndex];

  wordImageEl.src = categoryImagePath(current.image);
  wordImageEl.alt = current.word;
  wordTextEl.textContent = current.word;
  progressTextEl.textContent = (currentIndex + 1) + " of " + words.length;

  // Disable "Back" on the first word.
  backBtn.disabled = currentIndex === 0;

  // On the last word, "Next" becomes "Finish".
  var isLastWord = currentIndex === words.length - 1;
  nextBtn.textContent = isLastWord ? "Finish" : "Next";
}

// Move to the previous word (if possible).
function goBack() {
  if (currentIndex > 0) {
    currentIndex = currentIndex - 1;
    renderWord();
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
  renderWord();
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
  introMessageEl.textContent = "Let's learn some " + currentCategory.label + " words!";
  introAudio.src = categoryAudioPath(currentCategory.intro.audio);

  showScreen(introScreen);
  introAudio.currentTime = 0;
  playAudioWithFallback(introAudio, null);
}

// Show the outro screen and autoplay its narration.
function showOutro() {
  markCategoryCompleted(currentCategory.id);

  outroImageEl.src = categoryImagePath(currentCategory.outro.image);
  outroAudio.src = categoryAudioPath(currentCategory.outro.audio);

  showScreen(outroScreen);
  outroAudio.currentTime = 0;
  playAudioWithFallback(outroAudio, null);
}

// Start button: move from intro to the first flashcard.
function startFlashcards() {
  currentIndex = 0;
  renderWord();
  showScreen(flashcardScreen);
}

// Restart button on the outro screen: go back to the category picker.
function restartToCategories() {
  currentCategory = null;
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
          });
      });

      return Promise.all(labelPromises).then(function () {
        currentChapterMetas = chapterMetas;
        currentChapterGroup = groupMeta;
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
// completed. Completed chapters are marked "(done)"; locked ones are
// disabled and marked "(locked)".
function renderChapterList() {
  chapterListEl.innerHTML = "";

  var completed = getCompletedChapters(currentChapterGroup.id);

  currentChapterMetas.forEach(function (chapterMeta, index) {
    var isCompleted = completed.indexOf(chapterMeta.id) !== -1;
    var isUnlocked = index === 0 || completed.indexOf(currentChapterMetas[index - 1].id) !== -1;

    var label = chapterMeta.label || chapterMeta.id;
    if (isCompleted) {
      label = label + " (done)";
    } else if (!isUnlocked) {
      label = label + " (locked)";
    }

    var btn = document.createElement("button");
    btn.className = "category-card";
    btn.textContent = label;

    if (isUnlocked) {
      btn.addEventListener("click", function () {
        loadChapterByIndex(index);
      });
    } else {
      btn.disabled = true;
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
        imageFolder: entry.data.imageFolder,
        audioFolder: entry.data.audioFolder
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

// Draw one button per category in the picker screen.
function renderCategoryList(categories) {
  categoryListEl.innerHTML = "";

  categories.forEach(function (categoryMeta) {
    var btn = document.createElement("button");
    btn.className = "category-card";
    btn.textContent = categoryMeta.label || categoryMeta.id;
    btn.addEventListener("click", function () {
      if (categoryMeta.type === "chapterGroup") {
        loadChapterGroup(categoryMeta);
      } else {
        loadCategory(categoryMeta);
      }
    });
    categoryListEl.appendChild(btn);
  });

  renderQuizGroupCards(categories);
}

// One "Quiz" card per group of 2 consecutive categories (in categories.json
// order). A group unlocks only once every category in it has been completed
// (i.e. the user has reached that category's outro screen at least once).
function renderQuizGroupCards(categories) {
  var completed = getCompletedCategories();
  var groups = [];

  for (var i = 0; i + 1 < categories.length; i += 2) {
    groups.push([categories[i], categories[i + 1]]);
  }

  groups.forEach(function (group) {
    var ids = group.map(function (categoryMeta) { return categoryMeta.id; });
    var labels = group.map(function (categoryMeta) { return categoryMeta.label || categoryMeta.id; });
    var isUnlocked = ids.every(function (id) { return completed.indexOf(id) !== -1; });

    var btn = document.createElement("button");
    btn.className = isUnlocked ? "quiz-card unlocked" : "quiz-card locked";
    btn.textContent = "Quiz: " + labels.join(" + ");

    if (isUnlocked) {
      btn.addEventListener("click", function () {
        var mixedCategory = buildMixedCategory(categories, ids);
        startVocabQuiz(mixedCategory);
      });
    } else {
      btn.disabled = true;
    }

    categoryListEl.appendChild(btn);
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
        // inline label and have no single word-list file to fetch here —
        // their chapters are loaded lazily by loadChapterGroup() instead.
        if (entry.type === "chapterGroup") {
          return Promise.resolve();
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
restartBtn.addEventListener("click", restartToCategories);

// "Back to categories" is just a placeholder link for now.
backLink.addEventListener("click", function (event) {
  event.preventDefault();
  // No destination yet — this will be wired up later.
});

// Chapter list's "Back to categories" link: leave the chapter group and
// return to the main category picker.
chapterBackLink.addEventListener("click", function (event) {
  event.preventDefault();
  currentChapterGroup = null;
  showScreen(categoryScreen);
});

// Show the category picker when the page first loads.
loadCategoryList();
