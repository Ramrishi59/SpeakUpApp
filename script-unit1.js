const screens = [
  {
    id: "screen1",
    image: "Images/family.jpg",
    text: "Hi, everyone! Look at this lovely family. Do you know who they are?",
    audio: "Audio/01_hi_family.mp3",
  },
  {
    id: "screen2",
    image: "Images/mom.jpg",
    text: "This is my Mom. She loves to cook!",
    audio: "Audio/02_mom.mp3",
  },
  {
    id: "screen3",
    image: "Images/dad.jpg",
    text: "And this is my Dad. He tells funny stories.",
    audio: "Audio/03_dad.mp3",
  },
  {
    id: "screen4",
    image: "Images/brother.jpg",
    text: "Meet my Brother. He loves to play football.",
    audio: "Audio/04_brother.mp3",
  },
  {
    id: "screen5",
    image: "Images/sister.png",
    text: "And this is my Sister. She loves to read books.",
    audio: "Audio/05_sister.mp3",
  },
  {
    id: "screen6",
    type: "match",
    text: "Now, let's play a game! Match the picture to the word. (ചിത്രവും വാക്കും യോജിപ്പിക്കുക.)",
    items: [
      { label: "Mom", image: "Images/mom.jpg", audio: "Audio/02_mom.mp3" },
      { label: "Dad", image: "Images/dad.jpg", audio: "Audio/03_dad.mp3" },
      { label: "Brother", image: "Images/brother.jpg", audio: "Audio/04_brother.mp3" },
      { label: "Sister", image: "Images/sister.png", audio: "Audio/05_sister.mp3" }
    ]
  },
  {
    id: "screen7",
    type: "mic",
    text: "Every morning, we say 'Hi!' to our family. Can you say 'Hi'?",
    prompts: ["Hi, Mom!", "Hi, Dad!"]
  },
  {
    id: "screen8",
    type: "roleplay",
    text: "Let's pretend! I'll be the child, you be the Mom or Dad.",
    roleLines: [
      { mine: "Hi, Mom!", yours: "Hi, my dear!" },
      { mine: "Hi, Dad!", yours: "How are you?" }
    ]
  },
];

let currentIndex = 0;
const screenContainer = document.getElementById("screen-container");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");

function renderScreen() {
  const screen = screens[currentIndex];
  screenContainer.innerHTML = ""; // Clear

  if (screen.image) {
    const img = document.createElement("img");
    img.src = screen.image;
    img.className = "lesson-image";
    screenContainer.appendChild(img);
  }

  const text = document.createElement("p");
  text.className = "lesson-text";
  text.textContent = screen.text;
  screenContainer.appendChild(text);

  if (screen.audio) {
    const audio = new Audio(screen.audio);
    setTimeout(() => audio.play(), 500);
    screenContainer.addEventListener("click", () => audio.play());
  }

  if (screen.type === "match") {
    renderMatchScreen(screen);
  }

  if (screen.type === "mic") {
    renderMicScreen(screen);
  }

  if (screen.type === "roleplay") {
    renderRolePlay(screen);
  }

  if (screen.type === "upload") {
    renderUpload();
  }

  prevButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === screens.length - 1;
}

function renderMatchScreen(screen) {
  const instructions = document.createElement("p");
  instructions.className = "instruction";
  instructions.textContent = screen.text;
  screenContainer.appendChild(instructions);

  const matchWrapper = document.createElement("div");
  matchWrapper.className = "match-wrapper";
  screenContainer.appendChild(matchWrapper);

  // Render image cards
  screen.items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "drop-zone";
    card.dataset.label = item.label;

    const img = document.createElement("img");
    img.src = item.image;
    img.className = "match-image";

    const dropArea = document.createElement("div");
    dropArea.className = "drop-area";
    dropArea.textContent = "Drop here";
    dropArea.ondragover = e => e.preventDefault();
    dropArea.ondrop = e => {
      const draggedLabel = e.dataTransfer.getData("text/plain");
      if (draggedLabel === card.dataset.label) {
        dropArea.textContent = draggedLabel;
        dropArea.style.background = "#d4edda";
        dropArea.style.borderColor = "#28a745";
        new Audio(item.audio).play();
      } else {
        dropArea.textContent = "❌ Try again";
        dropArea.style.background = "#f8d7da";
        dropArea.style.borderColor = "#dc3545";
      }
    };

    card.appendChild(img);
    card.appendChild(dropArea);
    matchWrapper.appendChild(card);
  });

  // Render draggable labels
  const labelBox = document.createElement("div");
  labelBox.className = "label-box";
  screen.items
    .sort(() => Math.random() - 0.5)
    .forEach(item => {
      const label = document.createElement("div");
      label.className = "draggable-label";
      label.textContent = item.label;
      label.draggable = true;
      label.ondragstart = e => {
        e.dataTransfer.setData("text/plain", item.label);
      };
      labelBox.appendChild(label);
    });

  screenContainer.appendChild(labelBox);
}  

function renderMicScreen(screen) {
  const instructions = document.createElement("p");
  instructions.textContent = screen.text;
  screenContainer.appendChild(instructions);

  screen.prompts.forEach(prompt => {
    const promptDiv = document.createElement("div");
    promptDiv.className = "mic-prompt";
    promptDiv.innerHTML = `<span>🎤</span> Say: <strong>${prompt}</strong>`;
    screenContainer.appendChild(promptDiv);
  });
}

function renderMicScreen(screen) {
  const instructions = document.createElement("p");
  instructions.textContent = screen.text;
  screenContainer.appendChild(instructions);

  screen.prompts.forEach((prompt, index) => {
    const promptBox = document.createElement("div");
    promptBox.className = "mic-prompt-box";

    const label = document.createElement("p");
    label.innerHTML = `<strong>${prompt}</strong>`;
    promptBox.appendChild(label);

    // Play Sample Button
    const playBtn = document.createElement("button");
    playBtn.textContent = "▶️ Play Sample";
    playBtn.onclick = () => new Audio(`Audio/mic_sample_${index + 1}.mp3`).play();
    promptBox.appendChild(playBtn);

    // Recorder
    let recorder;
    let audioBlob;
    const recordBtn = document.createElement("button");
    const playMyBtn = document.createElement("button");
    playMyBtn.textContent = "🔁 Play My Voice";
    playMyBtn.disabled = true;

    recordBtn.textContent = "🎙️ Record";
    recordBtn.onclick = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        audioBlob = new Blob(chunks, { type: "audio/webm" });
        playMyBtn.disabled = false;
      };
      recorder.start();
      setTimeout(() => {
        recorder.stop();
      }, 3000); // Record 3 seconds
    };

    playMyBtn.onclick = () => {
      if (audioBlob) {
        const audioURL = URL.createObjectURL(audioBlob);
        const tempAudio = new Audio(audioURL);
        tempAudio.play();
      }
    };

    promptBox.appendChild(recordBtn);
    promptBox.appendChild(playMyBtn);
    screenContainer.appendChild(promptBox);
  });
}


function renderUpload() {
  const msg = document.createElement("p");
  msg.textContent = "Upload your family picture or drawing:";
  const input = document.createElement("input");
  input.type = "file";
  screenContainer.appendChild(msg);
  screenContainer.appendChild(input);
}

nextButton.onclick = () => {
  if (currentIndex < screens.length - 1) {
    currentIndex++;
    renderScreen();
  }
};

prevButton.onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderScreen();
  }
};

// Start the lesson
renderScreen();
