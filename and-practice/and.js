// Speak Up • Unit 3 Practice (This / That)

// Default data (fallback)
let ITEMS = [
{ image: 'Images/u3_01_cat.png', answer: 'This is a cat.', vo: 'Audio/Unit3/this_apple.mp3' },
{ image: 'Images/u3_02_kite.png', answer: 'That is a kite.', vo: 'Audio/Unit3/this_book.mp3' },
{ image: 'Images/u3_03_dog.png', answer: 'This is a dog.', vo: 'Audio/Unit3/that_car.mp3' },
{ image: 'Images/u3_04_duck.png', answer: 'That is a duck.', vo: 'Audio/Unit3/this_pen.mp3' },
{ image: 'Images/u3_05_bee.png', answer: 'This is a bee.', vo: 'Audio/Unit3/that_tree.mp3' },
{ image: 'Images/u3_06_bird.png', answer: 'That is a bird.', vo: 'Audio/Unit3/this_bag.mp3' },
{ image: 'Images/u3_07_frog.png', answer: 'That is a frog.', vo: 'Audio/Unit3/that_house.mp3' },
{ image: 'Images/u3_08_snake.png', answer: 'That is an snake.', vo: 'Audio/Unit3/this_egg.mp3' },
{ image: 'Images/u3_09_tortoise.png', answer: 'This is a tortoise.', vo: 'Audio/Unit3/that_bike.mp3' },
{ image: 'Images/u3_10_tiger.png', answer: 'That is a tiger.', vo: 'Audio/Unit3/this_phone.mp3' },
{ image: 'Images/u3_11_butterfly.png', answer: 'This is a butterfly.', vo: 'Audio/Unit3/that_boat.mp3' },
];

const els = {
    stage:        document.getElementById('stage'),
    progress:     document.getElementById('progress'),
    img:          document.getElementById('itemImage'),
    prompt:       document.getElementById('prompt'),
    answerText:   document.getElementById('answerText'),
    btnAnswer:    document.getElementById('btnAnswer'),
    btnNext:      document.getElementById('btnNext'),
    btnRestart:   document.getElementById('btnRestart'),
    overlay:      document.getElementById('overlay'),
    overlayNext:  document.getElementById('overlayNext'),
    bannerText:   document.getElementById('bannerText'),
    confetti:     document.getElementById('confetti'),
    outro:        document.getElementById('outro'),
    outroHome:    document.getElementById('outroHome'),
    outroRestart: document.getElementById('outroRestart'),
    vo:           document.getElementById('vo'),
  };
  

const CHECKPOINTS = new Set([3,6,9]);
const LINES = {
3: ['Great job!', 'Nice start!', 'Well done!'],
6: ['Keep going!', 'You’re doing great!', 'Super!'],
9: ['Almost there!', 'So close!', 'Fantastic effort!']
};

let idx = 0; // current item index
let phase = 'prompt'; // 'prompt' | 'answer' | 'reward' | 'outro'

// —————— Boot: try JSON, otherwise fallback ——————
fetch('units/unit3.json', { cache:'no-store' })
.then(r => r.ok ? r.json() : Promise.reject('no-json'))
.then(json => {
if(Array.isArray(json?.items) && json.items.length) {
ITEMS = json.items.map(it => ({
image: it.image,
answer: it.answer,
vo: it.vo
}));
}
})
.catch(()=>{})
.finally(() => { renderItem(); wireEvents(); });

function updateProgress(){ els.progress.textContent = `${idx+1} / ${ITEMS.length}`; }

function renderItem(){
phase = 'prompt';
els.prompt.textContent = 'Say the sentence!';
els.answerText.textContent = '';
els.btnAnswer.disabled = false;
els.btnNext.disabled = true;
els.img.src = ITEMS[idx].image;
updateProgress();
stopVO();
}

function revealAnswer(){
if(phase !== 'prompt') return;
phase = 'answer';
const a = ITEMS[idx].answer;
els.answerText.textContent = a;
playVO(ITEMS[idx].vo);
els.btnAnswer.disabled = true;
els.btnNext.disabled = false;
}

function next(){
if(phase === 'answer'){
const human = idx + 1;
if(CHECKPOINTS.has(human)) { showReward(human); return; }
advance();
} else if (phase === 'reward'){
hideReward(); advance();
}
}

function advance(){
idx++;
if(idx >= ITEMS.length){ showOutro(); }
else { renderItem(); }
}

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function showReward(humanIndex){
phase = 'reward';
const tierLines = LINES[humanIndex] || ['Great job!'];
els.bannerText.textContent = pick(tierLines);
els.overlay.classList.add('show');
spawnConfetti(60);
// Optionally: playVO(`Audio/Common/reward_${humanIndex}.mp3`)
}
function hideReward(){ els.overlay.classList.remove('show'); clearConfetti(); }

function showOutro(){
phase = 'outro';
els.stage.style.display = 'none';
els.outro.classList.add('show');
spawnConfetti(120);
// playVO('Audio/Unit3/outro.mp3');
}

function restart(){
stopVO(); idx = 0; phase = 'prompt';
els.outro.classList.remove('show');
els.stage.style.display = '';
clearConfetti(); renderItem();
}

// ——— VO helpers ———
function playVO(src){ if(!src) return; els.vo.src = src; els.vo.currentTime = 0; els.vo.play().catch(()=>{}); }
function stopVO(){ els.vo.pause(); try{ els.vo.currentTime = 0; }catch(e){} }

// ——— Confetti ———
const COLORS = ['#ffd166','#06d6a0','#118ab2','#ef476f','#8338ec'];
function spawnConfetti(n){
clearConfetti();
const W = window.innerWidth;
for(let i=0;i<n;i++){
const d = document.createElement('div');
d.className = 'piece';
d.style.left = Math.random()*W + 'px';
d.style.background = COLORS[i % COLORS.length];
d.style.animationDuration = (5 + Math.random()*3)+'s';
d.style.transform = `translateY(-10vh) rotate(${Math.random()*360}deg)`;
els.confetti.appendChild(d);
}
}
function clearConfetti(){ els.confetti.innerHTML = ''; }

// ——— Wiring ———
function wireEvents(){
els.btnAnswer.addEventListener('click', revealAnswer);
els.btnNext.addEventListener('click', next);
els.btnRestart.addEventListener('click', restart);
els.overlayNext.addEventListener('click', ()=>{ hideReward(); advance(); });
els.outroRestart.addEventListener('click', restart);
els.outroHome.addEventListener('click', ()=>{ window.location.href = 'index.html'; });
}
