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
    {
      id: "screen9",
      type: "upload",
      text: "You did so well! Now, can you draw your family? Or maybe take a picture and upload it here!"
    }
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
  
    screen.items.forEach(item => {
      const card = document.createElement("div");
      card.className = "match-card";
  
      const img = document.createElement("img");
      img.src = item.image;
      img.className = "match-image";
      img.onclick = () => new Audio(item.audio).play();
  
      const label = document.createElement("p");
      label.textContent = item.label;
      label.className = "match-label";
  
      card.appendChild(img);
      card.appendChild(label);
      screenContainer.appendChild(card);
    });
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
  
  function renderRolePlay(screen) {
    const instructions = document.createElement("p");
    instructions.textContent = screen.text;
    screenContainer.appendChild(instructions);
  
    screen.roleLines.forEach(line => {
      const block = document.createElement("div");
      block.className = "roleplay-block";
      block.innerHTML = `<p>👦 Me: "${line.mine}"</p><p>🧑 You: "${line.yours}"</p>`;
      screenContainer.appendChild(block);
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
  