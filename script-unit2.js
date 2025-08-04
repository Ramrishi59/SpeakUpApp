// ✅ script-unit2.js
const screens = [
    {
      id: "screen1",
      image: "Images/toys.jpg",
      text: "Wow, look at all these toys! Do you have favorite toys too?",
      audio: "Audio/01_intro_toys.mp3",
    },
    {
      id: "screen2",
      image: "Images/ball.png",
      text: "This is a ball. A big, round ball!",
      audio: "Audio/02_ball.mp3",
      highlightWord: "ball"
    },
    {
      id: "screen3",
      image: "Images/car.jpg",
      text: "Look, a car! Vroom, vroom!",
      audio: "Audio/03_car.mp3",
      highlightWord: "car"
    },
    {
      id: "screen4",
      image: "Images/doll.png",
      text: "Here is a pretty doll.",
      audio: "Audio/04_doll.mp3",
      highlightWord: "doll"
    },
    {
      id: "screen5",
      image: "Images/robot.png",
      text: "And this is a clever robot!",
      audio: "Audio/05_robot.mp3",
      highlightWord: "robot"
    },
    {
      id: "screen6",
      type: "mic",
      text: "What is this? Click on the toy and say its name! (ഇത് എന്താണ്? കളിപ്പാട്ടത്തിൽ ക്ലിക്ക് ചെയ്ത് പേര് പറയുക.)",
      toys: [
        { name: "ball", image: "Images/ball.png", expected: "It's a ball." },
        { name: "car", image: "Images/car.jpg", expected: "It's a car." },
        { name: "doll", image: "Images/doll.png", expected: "It's a doll." },
        { name: "robot", image: "Images/robot.png", expected: "It's a robot." }
      ]
    },
    {
      id: "screen7",
      type: "sentence-builder",
      text: "I like my new...",
      options: ["ball", "car", "doll", "robot"],
      sentenceTemplate: "I like my new [toy].",
      audioPrefix: "Audio/like_"
    },
    {
      id: "screen8",
      type: "roleplay",
      text: "Let's ask your friend about their favorite toy!",
      roleLines: [
        { mine: "What is your favorite toy?", yours: "I like my [toy]." }
      ]
    }
  ];
  
  let currentIndex = 0;
  const screenContainer = document.getElementById("screen-container");
  const prevButton = document.getElementById("prevButton");
  const nextButton = document.getElementById("nextButton");
  
  function renderScreen() {
    const screen = screens[currentIndex];
    screenContainer.innerHTML = "";
  
    if (screen.image) {
      const img = document.createElement("img");
      img.src = screen.image;
      img.className = "lesson-image";
      screenContainer.appendChild(img);
    }
  
// Only render text if it's NOT a special mic screen with toys
if (!(screen.type === "mic" && screen.toys)) {
  const textPara = document.createElement("p");
  textPara.className = "lesson-text";

  if (screen.highlightWord) {
    const word = screen.highlightWord;
    const wordAudio = `Audio/${word}_word.mp3`;
    const regex = new RegExp(`\\b${word}\\b`);
    const modifiedText = screen.text.replace(
      regex,
      `<span class="highlight-word" data-audio="${wordAudio}">${word}</span>`
    );
    textPara.innerHTML = modifiedText;
    textPara.querySelectorAll(".highlight-word").forEach(span => {
      span.style.cursor = "pointer";
      span.onclick = () => new Audio(span.dataset.audio).play();
    });
  } else {
    textPara.textContent = screen.text;
  }

  screenContainer.appendChild(textPara);
}

  
    if (screen.audio) {
      const audio = new Audio(screen.audio);
      setTimeout(() => audio.play(), 500);
      screenContainer.addEventListener("click", () => audio.play());
    }
  
    prevButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === screens.length - 1;

    if (screen.type === "mic" && screen.toys) {
      const instruction = document.createElement("p");
      instruction.className = "lesson-text";
      instruction.textContent = screen.text;
      screenContainer.appendChild(instruction);
    
      const toyGrid = document.createElement("div");
      toyGrid.className = "toy-grid";
    
      screen.toys.forEach((toy, index) => {
        const toyCard = document.createElement("div");
        toyCard.className = "toy-card";
    
        const img = document.createElement("img");
        img.src = toy.image;
        img.className = "toy-image";
    
        const micArea = document.createElement("div");
        micArea.className = "mic-control";
    
        const askBtn = document.createElement("button");
        askBtn.textContent = "❓ What is this?";
        askBtn.onclick = () => {
          new Audio("Audio/what_is_this.mp3").play(); // You’ll need to add this audio
        };
    
        const recordBtn = document.createElement("button");
        recordBtn.textContent = "🎙️ Record";
        const playBtn = document.createElement("button");
        playBtn.textContent = "▶️ Play";
        playBtn.disabled = true;
    
        let audioBlob = null;
    
        recordBtn.onclick = async () => {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          const chunks = [];
    
          recorder.ondataavailable = e => chunks.push(e.data);
          recorder.onstop = () => {
            audioBlob = new Blob(chunks, { type: "audio/webm" });
            playBtn.disabled = false;
          };
    
          recorder.start();
          setTimeout(() => recorder.stop(), 5000);
        };
    
        playBtn.onclick = () => {
          if (audioBlob) {
            const url = URL.createObjectURL(audioBlob);
            new Audio(url).play();
          }
        };
    
        micArea.appendChild(askBtn);
        micArea.appendChild(recordBtn);
        micArea.appendChild(playBtn);
    
        toyCard.appendChild(img);
        toyCard.appendChild(micArea);
        toyGrid.appendChild(toyCard);
      });
    
      screenContainer.appendChild(toyGrid);
    }
    
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
  
  renderScreen();
  