/* =========================================================
   Vocab Pack Prototype — vocab-quiz.js
   Generic, data-driven quiz engine for app/vocab/vocab.html.

   Reuses the SAME category word-list data already loaded by
   vocab.js for flashcards (word/image/audio + imageFolder/
   audioFolder/label) — no separate quiz JSON is fetched here.
   family-quiz.json / mybody-quiz.json are no longer read.

   Relies on globals defined in vocab.js (loaded first): showScreen,
   speakWord, quizScreen, quizScoreScreen, restartToCategories.
   ========================================================= */

var QUIZ_CHUNK_SIZE = 8;

var quizAllWords = [];   // full category word list, used as the distractor pool
var quizChunks = [];     // word list split into chunks of QUIZ_CHUNK_SIZE, sequential order
var quizRoundWords = []; // current chunk's words, shuffled fresh each round
var quizChunkIndex = 0;
var quizQuestionIndex = 0;
var quizScore = 0;
var quizAnswered = false;
var quizImageFolder = "";
var quizAudioFolder = "";

var quizQuestionAudio = new Audio();

// Elements (defined in vocab.html, alongside the flashcard screens)
var quizProgressEl = document.getElementById("quizProgressText");
var quizReplayBtn = document.getElementById("quizReplayBtn");
var quizChoicesWrap = document.getElementById("quizChoicesWrap");
var quizScoreTextEl = document.getElementById("quizScoreText");
var quizContinueBtn = document.getElementById("quizContinueBtn");

// Split an array into chunks of a given size (last chunk may be smaller).
function chunkWords(words, size) {
  var chunks = [];
  for (var i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  return chunks;
}

// Shuffle an array in place (Fisher-Yates).
function shuffleQuiz(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

// Resolve a word's image/audio path. Prefers a per-word imageFolder/
// audioFolder (set on merged words for mixed multi-category quizzes,
// where words come from different folders), falling back to the quiz's
// single category folder otherwise — so normal single-category quizzes
// (whose words have no per-word folder fields) behave exactly as before.
function quizImagePath(word) {
  var folder = word.imageFolder || quizImageFolder;
  return folder + "/" + word.image;
}
function quizAudioPath(word) {
  var folder = word.audioFolder || quizAudioFolder;
  return folder + "/" + word.audio;
}

// Entry point, called from vocab.js when "Start quiz" is tapped.
// `category` is the same object vocab.js already loaded for flashcards.
function startVocabQuiz(category) {
  quizAllWords = category.words;
  quizImageFolder = category.imageFolder;
  quizAudioFolder = category.audioFolder;
  quizChunks = chunkWords(quizAllWords, QUIZ_CHUNK_SIZE);
  quizChunkIndex = 0;

  showScreen(quizScreen);
  startQuizChunk();
}

// Reset the per-chunk counters, shuffle this round's question order, and render its first question.
function startQuizChunk() {
  quizQuestionIndex = 0;
  quizScore = 0;
  quizRoundWords = shuffleQuiz(quizChunks[quizChunkIndex].slice());
  renderQuizQuestion();
}

// Pick 2 random distractor words (from the whole category, not just this chunk).
// Dedupes by the FULLY RESOLVED image path (folder + filename), not just the
// bare filename — mixed multi-category quizzes can combine categories whose
// words reuse the same numbered filenames (e.g. both Family and My Body have
// a "1.webp"), so comparing filenames alone would wrongly treat two totally
// different pictures as duplicates and exclude one from the candidate pool.
function pickDistractors(correctWord) {
  var seenImages = {};
  seenImages[quizImagePath(correctWord)] = true;

  var candidates = [];
  for (var i = 0; i < quizAllWords.length; i++) {
    var candidate = quizAllWords[i];
    var candidatePath = quizImagePath(candidate);
    if (!seenImages[candidatePath]) {
      seenImages[candidatePath] = true;
      candidates.push(candidate);
    }
  }

  shuffleQuiz(candidates);
  return candidates.slice(0, 2);
}

// Draw the current question: progress text + 3 shuffled image choices.
function renderQuizQuestion() {
  var word = quizRoundWords[quizQuestionIndex];
  quizAnswered = false;

  quizProgressEl.textContent =
    "Quiz " + (quizChunkIndex + 1) + ": " + (quizQuestionIndex + 1) + " of " + quizRoundWords.length;

  var distractors = pickDistractors(word);
  var choiceWords = [word].concat(distractors);
  var choiceList = choiceWords.map(function (choiceWord) {
    return { image: quizImagePath(choiceWord), isCorrect: choiceWord === word };
  });
  shuffleQuiz(choiceList);

  quizChoicesWrap.innerHTML = "";
  choiceList.forEach(function (choice, i) {
    var btn = document.createElement("button");
    btn.className = "choice-image-btn";

    var img = document.createElement("img");
    img.src = choice.image;
    img.alt = "";
    btn.appendChild(img);

    btn.addEventListener("click", function () {
      onQuizChoose(btn, choice);
    });

    // The 3rd tile sits centered below the top row, so it gets a
    // spanning wrapper for layout only — the click/answer logic is unchanged.
    if (i === 2) {
      var bottomWrap = document.createElement("div");
      bottomWrap.className = "choice-bottom-wrap";
      bottomWrap.appendChild(btn);
      quizChoicesWrap.appendChild(bottomWrap);
    } else {
      quizChoicesWrap.appendChild(btn);
    }
  });

  // The first question of each round waits for a manual tap on the
  // speaker button; every question after that autoplays as usual.
  var isFirstQuestionOfRound = quizQuestionIndex === 0;
  if (!isFirstQuestionOfRound) {
    playQuizQuestionAudio(word);
  }
}

// Play a question's audio, or fall back to speech synthesis (matches vocab.js).
function playQuizQuestionAudio(word) {
  if (!word.audio) {
    speakWord(word.word);
    return;
  }

  quizQuestionAudio.pause();
  quizQuestionAudio.onerror = function () {
    speakWord(word.word);
  };
  quizQuestionAudio.src = quizAudioPath(word);
  quizQuestionAudio.currentTime = 0;
  quizQuestionAudio.play().catch(function () {
    // Autoplay may be blocked before any user interaction;
    // the replay button lets the user trigger it manually.
  });
}

// Replay button: re-play the current question's audio.
function replayQuizQuestion() {
  var word = quizRoundWords[quizQuestionIndex];
  playQuizQuestionAudio(word);
}

// Handle a tap on one of the image choice buttons.
function onQuizChoose(btnEl, choice) {
  if (quizAnswered) return;
  quizAnswered = true;

  if (choice.isCorrect) {
    quizScore = quizScore + 1;
    btnEl.classList.add("correct");
  } else {
    btnEl.classList.add("incorrect");
  }

  var allChoiceBtns = quizChoicesWrap.querySelectorAll(".choice-image-btn");
  allChoiceBtns.forEach(function (b) { b.disabled = true; });

  setTimeout(goToNextQuizQuestion, 700);
}

// Move to the next question in this chunk, or show the chunk's score screen.
function goToNextQuizQuestion() {
  if (quizQuestionIndex < quizRoundWords.length - 1) {
    quizQuestionIndex = quizQuestionIndex + 1;
    renderQuizQuestion();
  } else {
    showQuizScore();
  }
}

// Show the score screen for the chunk just finished.
function showQuizScore() {
  var isLastChunk = quizChunkIndex === quizChunks.length - 1;

  quizScoreTextEl.textContent =
    "Quiz " + (quizChunkIndex + 1) + ": " + quizScore + " out of " + quizRoundWords.length + "!";
  quizContinueBtn.textContent = isLastChunk ? "Back to categories" : "Next quiz";

  showScreen(quizScoreScreen);
}

// "Next quiz" / "Back to categories" button on the score screen.
function onQuizContinue() {
  var isLastChunk = quizChunkIndex === quizChunks.length - 1;

  if (isLastChunk) {
    restartToCategories();
    return;
  }

  quizChunkIndex = quizChunkIndex + 1;
  showScreen(quizScreen);
  startQuizChunk();
}

quizReplayBtn.addEventListener("click", replayQuizQuestion);
quizContinueBtn.addEventListener("click", onQuizContinue);
